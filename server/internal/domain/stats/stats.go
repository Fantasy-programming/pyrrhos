package stats

import (
	"net/http"

	"github.com/ClickHouse/clickhouse-go/v2"
	repository "github.com/Fantasy-Programming/pyrrhos/database"
	"github.com/go-chi/chi/v5"
)

type Stats struct {
	DB *repository.Queries
}

func New(colDB clickhouse.Conn) *Stats {
	db := repository.New(colDB)

	return &Stats{DB: db}
}

func (s *Stats) Register() http.Handler {
	router := chi.NewRouter()
	router.Post("/", s.ViewStats)
	return router
}
