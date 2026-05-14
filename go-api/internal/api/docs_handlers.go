package api

import "net/http"

func (s *Server) apiDoc(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"openapi": "3.0.0",
		"info": map[string]any{
			"title":       "Comfy Deploy Go API",
			"version":     "0.0.1",
			"description": "Go backend API for ComfyUI workflow upload, deployment, runs, outputs, machines, API keys, auth grants, and public share pages.",
		},
		"servers": []map[string]any{{"url": "/api"}},
		"security": []map[string]any{
			{"bearerAuth": []string{}},
		},
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"bearerAuth": map[string]any{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT/API Key",
					"description":  "Use an API key created in /api-keys. Browser console requests can also use same-origin Basic Auth in local mode.",
				},
			},
		},
		"paths": map[string]any{
			"/run": map[string]any{
				"post": endpointDoc("Create a workflow run", true,
					map[string]any{"deployment_id": "uuid", "workflow_version_id": "uuid", "machine_id": "uuid", "inputs": map[string]any{}, "run_origin": "manual|api|public-share"},
					map[string]any{"run_id": "uuid"}),
				"get": endpointDoc("Get a run by query string. Compatible with the original API polling shape.", true,
					map[string]any{"run_id": "uuid"},
					map[string]any{"id": "uuid", "status": "not-started|running|uploading|success|failed", "outputs": []any{map[string]any{"data": map[string]any{"images": []any{}}}}}),
			},
			"/run/{run_id}": map[string]any{
				"get": endpointDoc("Get one run record by path id.", true, nil, map[string]any{"id": "uuid", "status": "running"}),
			},
			"/run/{run_id}/outputs": map[string]any{
				"get": endpointDoc("List all staged outputs for a run.", true, nil, []any{map[string]any{"id": "uuid", "run_id": "uuid", "data": map[string]any{}}}),
			},
			"/upload-url": map[string]any{
				"get": endpointDoc("Create a signed upload URL for user input files.", true,
					map[string]any{"type": "image/png|image/jpg|image/jpeg", "file_size": "bytes"},
					map[string]any{"upload_url": "signed PUT URL", "file_id": "img-...", "download_url": "public or signed URL", "include_acl": true}),
			},
			"/workflow": map[string]any{
				"post": endpointDoc("Upload a new workflow or create a new workflow version from the ComfyUI plugin.", true,
					map[string]any{"workflow_id": "uuid optional", "workflow_name": "required for new workflow", "workflow": map[string]any{}, "workflow_api": map[string]any{}, "snapshot": map[string]any{}, "comment": "optional"},
					map[string]any{"workflow_id": "uuid", "version": 1}),
			},
			"/workflows": map[string]any{
				"get": endpointDoc("List workflows visible to the current API key/user.", true,
					map[string]any{"limit": 20, "offset": 0, "search": "optional"},
					[]any{map[string]any{"id": "uuid", "name": "Workflow", "versions": []any{}, "deployments": []any{}}}),
			},
			"/workflow/{workflow_id}": map[string]any{
				"get":    endpointDoc("Get workflow detail.", true, nil, map[string]any{"id": "uuid", "versions": []any{}}),
				"delete": endpointDoc("Delete workflow.", true, nil, map[string]any{"deleted": true}),
			},
			"/workflow/{workflow_id}/versions": map[string]any{
				"get": endpointDoc("List workflow versions.", true, map[string]any{"limit": 20, "offset": 0}, []any{map[string]any{"id": "uuid", "version": 1}}),
			},
			"/workflow/{workflow_id}/version/{version}": map[string]any{
				"get": endpointDoc("Get workflow version by version number.", true, nil, map[string]any{"id": "uuid", "workflow_api": map[string]any{}}),
			},
			"/workflow-version/{version_id}": map[string]any{
				"get": endpointDoc("Get workflow version by id.", true, nil, map[string]any{"id": "uuid", "workflow_api": map[string]any{}}),
			},
			"/workflow/{workflow_id}/deployments": map[string]any{
				"get": endpointDoc("List deployments for a workflow.", true, nil, []any{map[string]any{"id": "uuid", "environment": "production|staging|public-share"}}),
				"post": endpointDoc("Create or update a deployment for an environment.", true,
					map[string]any{"version_id": "uuid", "machine_id": "uuid", "environment": "production|staging|public-share"},
					map[string]any{"id": "uuid", "environment": "production"}),
			},
			"/deployments": map[string]any{
				"get": endpointDoc("List all deployments.", true, nil, []any{map[string]any{"id": "uuid"}}),
			},
			"/deployments/{deployment_id}": map[string]any{
				"delete": endpointDoc("Delete a deployment.", true, nil, map[string]any{"deleted": true}),
			},
			"/machines": map[string]any{
				"get": endpointDoc("List machines.", true, nil, []any{map[string]any{"id": "uuid", "name": "Machine", "type": "classic"}}),
				"post": endpointDoc("Create a machine.", true,
					map[string]any{"name": "Machine", "endpoint": "https://comfy.example.com", "auth_token": "optional", "type": "classic", "status": "ready", "snapshot": map[string]any{}, "models": []any{}, "gpu": "T4"},
					map[string]any{"id": "uuid", "status": "ready"}),
			},
			"/machines/{machine_id}": map[string]any{
				"get":    endpointDoc("Get machine detail.", true, nil, map[string]any{"id": "uuid"}),
				"patch":  endpointDoc("Update machine detail.", true, map[string]any{"name": "Machine", "endpoint": "https://comfy.example.com"}, map[string]any{"id": "uuid"}),
				"delete": endpointDoc("Disable machine.", true, nil, map[string]any{"disabled": true}),
			},
			"/api-keys": map[string]any{
				"get":  endpointDoc("List API keys.", true, nil, []any{map[string]any{"id": "uuid", "masked_key": "****abcd"}}),
				"post": endpointDoc("Create API key. The full key is returned here and can be fetched later in local Go mode.", true, map[string]any{"name": "My API Key"}, map[string]any{"id": "uuid", "key": "jwt"}),
			},
			"/api-keys/{api_key_id}": map[string]any{
				"get":    endpointDoc("Get one API key.", true, nil, map[string]any{"id": "uuid", "key": "jwt"}),
				"delete": endpointDoc("Revoke API key.", true, nil, map[string]any{"revoked": true}),
			},
			"/auth-request/{request_id}": map[string]any{
				"post": endpointDoc("Grant a ComfyUI plugin auth request from the browser console.", true, nil, map[string]any{"message": "success"}),
			},
			"/auth-response/{request_id}": map[string]any{
				"get": endpointDoc("Poll auth grant response from the ComfyUI plugin.", false, nil, map[string]any{"api_key": "jwt", "name": "Local Admin"}),
			},
			"/update-run": map[string]any{
				"post": endpointDoc("Internal callback from ComfyUI/plugin to update run status or append staged output.", false,
					map[string]any{"run_id": "uuid", "status": "running|uploading|success|failed", "output_data": map[string]any{}, "node_meta": map[string]any{}, "gpu_event_id": "optional"},
					map[string]any{"message": "success"}),
			},
			"/file-upload": map[string]any{
				"get": endpointDoc("Internal callback helper returning a signed PUT URL for run output files.", false,
					map[string]any{"file_name": "output.webp", "run_id": "uuid", "type": "image/webp"},
					map[string]any{"url": "signed PUT URL", "include_acl": true}),
			},
			"/view": map[string]any{
				"get": endpointDoc("Redirect to a signed read URL for a stored file.", false, map[string]any{"file": "outputs/runs/<run_id>/image.webp"}, nil),
			},
			"/share/{share_id}": map[string]any{
				"get": endpointDoc("Get public share page data.", false, nil, map[string]any{"workflow_name": "Workflow", "deployment": map[string]any{}}),
			},
			"/share/{share_id}/clone-workflow": map[string]any{
				"post": endpointDoc("Clone public share workflow into current account.", false, nil, map[string]any{"workflow_id": "uuid"}),
			},
			"/share/{share_id}/clone-machine": map[string]any{
				"post": endpointDoc("Clone public share machine into current account.", false, nil, map[string]any{"machine_id": "uuid"}),
			},
			"/share/{share_id}/settings": map[string]any{
				"patch":  endpointDoc("Update share settings.", false, map[string]any{"description": "text", "showcase_media": []any{}}, map[string]any{"message": "Info Updated"}),
				"delete": endpointDoc("Delete share deployment/settings.", false, nil, map[string]any{"deleted": true}),
			},
		},
	})
}

func endpointDoc(summary string, bearer bool, request any, response any) map[string]any {
	doc := map[string]any{
		"summary": summary,
		"responses": map[string]any{
			"200": map[string]any{
				"description": "OK",
				"content":     jsonExample(response),
			},
		},
	}
	if bearer {
		doc["security"] = []map[string]any{{"bearerAuth": []string{}}}
	} else {
		doc["security"] = []map[string]any{}
	}
	if request != nil {
		doc["x-request-example"] = request
	}
	return doc
}

func jsonExample(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	return map[string]any{
		"application/json": map[string]any{
			"example": value,
		},
	}
}
