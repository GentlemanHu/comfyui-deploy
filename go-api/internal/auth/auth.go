package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	UserID string
	OrgID  string
}

type Claims struct {
	UserID string `json:"user_id,omitempty"`
	OrgID  string `json:"org_id,omitempty"`
	jwt.RegisteredClaims
}

func Sign(secret string, user User, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: user.UserID,
		OrgID:  user.OrgID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func Parse(secret, tokenValue string) (User, error) {
	claims := Claims{}
	token, err := jwt.ParseWithClaims(tokenValue, &claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("invalid signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return User{}, errors.New("invalid or expired token")
	}
	if claims.UserID == "" && claims.OrgID == "" {
		return User{}, errors.New("invalid token user")
	}
	return User{UserID: claims.UserID, OrgID: claims.OrgID}, nil
}

func BearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(header) < 8 || !strings.EqualFold(header[:7], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
