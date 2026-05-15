package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
)

type externalInputKind struct {
	InputID   string
	ClassType string
}

func (s *Server) normalizeRunInputs(r *http.Request, runID string, workflowAPI json.RawMessage, inputs map[string]any) (map[string]any, error) {
	if len(inputs) == 0 {
		return inputs, nil
	}
	kinds := externalInputKinds(workflowAPI)
	normalized := make(map[string]any, len(inputs))
	for key, value := range inputs {
		kind := kinds[key]
		updated, err := s.normalizeInputValue(r, runID, key, kind, value)
		if err != nil {
			return nil, err
		}
		normalized[key] = updated
	}
	return normalized, nil
}

func (s *Server) normalizeInputValue(r *http.Request, runID string, inputID string, kind externalInputKind, value any) (any, error) {
	if value == nil || !isAssetInput(kind.ClassType) {
		return value, nil
	}
	asset, ok, err := parseInlineAsset(value)
	if err != nil || !ok {
		return value, err
	}
	if int64(len(asset.Data)) > s.cfg.MaxUploadBytes {
		return nil, errors.New("input asset exceeds max upload size")
	}
	ext := extensionForContentType(asset.ContentType, asset.Filename)
	key := "inputs/runs/" + runID + "/" + safePathPart(inputID) + ext
	if err := s.storage.PutObject(r.Context(), key, asset.ContentType, asset.Data, true); err != nil {
		return nil, err
	}
	return s.storage.PublicURL(key), nil
}

type inlineAsset struct {
	Data        []byte
	ContentType string
	Filename    string
}

func parseInlineAsset(value any) (inlineAsset, bool, error) {
	switch typed := value.(type) {
	case string:
		return parseInlineAssetString(typed, "", "")
	case map[string]any:
		return parseInlineAssetObject(typed)
	default:
		return inlineAsset{}, false, nil
	}
}

func parseInlineAssetObject(object map[string]any) (inlineAsset, bool, error) {
	filename, _ := object["filename"].(string)
	if filename == "" {
		filename, _ = object["name"].(string)
	}
	contentType, _ := object["mime_type"].(string)
	if contentType == "" {
		contentType, _ = object["type"].(string)
	}
	for _, key := range []string{"data_url", "dataURL", "url"} {
		if raw, ok := object[key].(string); ok && strings.HasPrefix(raw, "data:") {
			return parseInlineAssetString(raw, contentType, filename)
		}
	}
	for _, key := range []string{"base64", "data", "content"} {
		if raw, ok := object[key].(string); ok && raw != "" {
			return parseInlineAssetString(raw, contentType, filename)
		}
	}
	return inlineAsset{}, false, nil
}

func parseInlineAssetString(raw string, fallbackType string, filename string) (inlineAsset, bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return inlineAsset{}, false, nil
	}
	contentType := strings.TrimSpace(fallbackType)
	payload := strings.TrimSpace(raw)
	if strings.HasPrefix(raw, "data:") {
		parts := strings.SplitN(raw, ",", 2)
		if len(parts) != 2 {
			return inlineAsset{}, false, errors.New("invalid data URL")
		}
		meta := strings.TrimPrefix(parts[0], "data:")
		if semi := strings.Index(meta, ";"); semi >= 0 {
			contentType = meta[:semi]
		} else {
			contentType = meta
		}
		payload = parts[1]
	}
	if !looksLikeBase64(payload) {
		return inlineAsset{}, false, nil
	}
	payload = strings.NewReplacer("\n", "", "\r", "", " ", "").Replace(payload)
	data, err := decodeBase64(payload)
	if err != nil {
		return inlineAsset{}, false, err
	}
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	return inlineAsset{Data: data, ContentType: contentType, Filename: filename}, true, nil
}

func decodeBase64(payload string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		data, err = base64.RawStdEncoding.DecodeString(payload)
	}
	if err != nil {
		data, err = base64.URLEncoding.DecodeString(payload)
	}
	if err != nil {
		data, err = base64.RawURLEncoding.DecodeString(payload)
	}
	return data, err
}

func externalInputKinds(workflowAPI json.RawMessage) map[string]externalInputKind {
	kinds := map[string]externalInputKind{}
	var graph map[string]map[string]any
	if err := json.Unmarshal(workflowAPI, &graph); err != nil {
		return kinds
	}
	for _, node := range graph {
		rawInputs, ok := node["inputs"].(map[string]any)
		if !ok {
			continue
		}
		inputID, _ := rawInputs["input_id"].(string)
		classType, _ := node["class_type"].(string)
		if inputID != "" {
			kinds[inputID] = externalInputKind{InputID: inputID, ClassType: classType}
		}
	}
	return kinds
}

func isAssetInput(classType string) bool {
	switch classType {
	case "ComfyUIDeployExternalImage", "ComfyUIDeployExternalVideo", "ComfyUIDeployExternalAudio", "ComfyUIDeployExternalFile", "ComfyUIDeployExternalEXR", "ComfyUIDeployExternalFaceModel":
		return true
	default:
		return false
	}
}

func extensionForContentType(contentType string, filename string) string {
	if ext := filepath.Ext(filename); ext != "" {
		return ext
	}
	if ext, err := mime.ExtensionsByType(contentType); err == nil && len(ext) > 0 {
		return ext[0]
	}
	return ".bin"
}

func looksLikeBase64(value string) bool {
	if len(value) < 32 {
		return false
	}
	return regexp.MustCompile(`^[A-Za-z0-9+/=_-]+$`).MatchString(value)
}

func safePathPart(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = regexp.MustCompile(`[^a-z0-9._-]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" {
		return "input"
	}
	return value
}
