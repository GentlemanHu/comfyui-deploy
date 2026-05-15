package storage

import (
	"bytes"
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/config"
)

type S3 struct {
	cfg    config.Config
	base   *s3.Client
	client *s3.PresignClient
}

func NewS3(cfg config.Config) *S3 {
	base := s3.New(s3.Options{
		Region:       cfg.SpacesRegion,
		BaseEndpoint: aws.String(cfg.SpacesPublicEndpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.SpacesKey, cfg.SpacesSecret, ""),
		UsePathStyle: cfg.SpacesForcePathStyle,
	})
	return &S3{cfg: cfg, base: base, client: s3.NewPresignClient(base)}
}

func (s *S3) PresignPut(ctx context.Context, key, contentType string, public bool) (string, error) {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.cfg.SpacesBucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}
	if public {
		input.ACL = "public-read"
	}
	result, err := s.client.PresignPutObject(ctx, input, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

func (s *S3) PresignGet(ctx context.Context, key string, expires time.Duration) (string, error) {
	result, err := s.client.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.SpacesBucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", err
	}
	return s.replaceCDN(result.URL), nil
}

func (s *S3) PutObject(ctx context.Context, key, contentType string, body []byte, public bool) error {
	input := &s3.PutObjectInput{
		Bucket:        aws.String(s.cfg.SpacesBucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(body),
		ContentLength: aws.Int64(int64(len(body))),
		ContentType:   aws.String(contentType),
	}
	if public {
		input.ACL = "public-read"
	}
	_, err := s.base.PutObject(ctx, input)
	return err
}

func (s *S3) PublicURL(key string) string {
	base := strings.TrimRight(s.cfg.SpacesEndpointCDN, "/")
	if s.cfg.SpacesCDNNoBucket {
		return base + "/" + strings.TrimLeft(key, "/")
	}
	return base + "/" + s.cfg.SpacesBucket + "/" + strings.TrimLeft(key, "/")
}

func (s *S3) replaceCDN(raw string) string {
	if s.cfg.SpacesEndpointCDN == "" || s.cfg.SpacesPublicEndpoint == s.cfg.SpacesEndpointCDN {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	cdn, err := url.Parse(s.cfg.SpacesEndpointCDN)
	if err != nil {
		return raw
	}
	parsed.Scheme = cdn.Scheme
	parsed.Host = cdn.Host
	if cdn.Path != "" && cdn.Path != "/" {
		parsed.Path = strings.TrimRight(cdn.Path, "/") + parsed.Path
	}
	return parsed.String()
}
