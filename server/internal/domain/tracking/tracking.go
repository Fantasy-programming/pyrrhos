package tracking

import (
	"net/http"

	"github.com/ClickHouse/clickhouse-go/v2"
	repository "github.com/Fantasy-Programming/pyrrhos/database"
	"github.com/go-chi/chi/v5"
)

type Tracking struct {
	DB *repository.Queries
	IP string
}

func New(colDB clickhouse.Conn, ip string) *Tracking {
	db := repository.New(colDB)

	// Start the queue
	go db.InitQueue()

	return &Tracking{
		DB: db,
		IP: ip,
	}
}

func (t *Tracking) Register() http.Handler {
	router := chi.NewRouter()
	router.Get("/", t.track)
	return router
}
