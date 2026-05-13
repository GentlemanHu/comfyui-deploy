package store

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

type Store struct {
	DB *sql.DB
}

func Open(ctx context.Context, postgresURL string) (*Store, error) {
	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error {
	return s.DB.Close()
}
