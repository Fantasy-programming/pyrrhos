package internal

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/Fantasy-Programming/pyrrhos/config"
	repository "github.com/Fantasy-Programming/pyrrhos/database"
	"github.com/Fantasy-Programming/pyrrhos/internal/domain/stats"
	"github.com/Fantasy-Programming/pyrrhos/internal/domain/tracking"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// user generates api key that is appended to X-API-KEY header
// This api key is used to access data related to the user
// if we have this api key in our thing (server ??) and it is valid then we continue (middleware)

// We use site_id to track website for the user
// The site_id created by the user isn't tied to the site_id of the db (so that it can be changed)
// How do we validate request ??

type Server struct {
	cfg        *config.Config
	httpServer *http.Server
	router     *chi.Mux
	columnDB   clickhouse.Conn
	mainDB     *pgx.Conn
	ip         string
}

func NewServer() *Server {
	return &Server{
		cfg:    config.New(),
		router: chi.NewRouter(),
		ip:     "",
	}
}

func (s *Server) Init() {
	s.ParseFlags()
	s.NewColumnarDB()
	s.NewDatabase()
	s.SetupRoutes()
}

func (s *Server) ParseFlags() {
	flag.StringVar(&s.ip, "ip", "", "force IP for request, useful in local")
	flag.Parse()
}

func (s *Server) NewColumnarDB() {
	addr := fmt.Sprintf(
		"%s:%d",
		s.cfg.AnalyticsDbHost,
		s.cfg.AnalyticsDbPort,
	)

	conn, err := clickhouse.Open(
		&clickhouse.Options{
			Addr: []string{addr},
			Auth: clickhouse.Auth{
				Database: s.cfg.AnalyticsDbName,
				Username: s.cfg.AnalyticsDbUser,
				Password: s.cfg.AnalyticsDbPass,
			},
		},
	)

	if err != nil {
		log.Fatal(err)
	} else if err := conn.Ping(context.Background()); err != nil {
		log.Fatal(err)
	} else if err := repository.EnsureTable(conn); err != nil {
		log.Fatal(err)
	}

	s.columnDB = conn
}

func (s *Server) NewDatabase() {
	dsn := fmt.Sprintf("postgres://%s:%d/%s?sslmode=%s&user=%s&password=%s", s.cfg.MainDbHost, s.cfg.MainDbPort, s.cfg.MainDbName, s.cfg.MainDbSslMode, s.cfg.MainDbUser, s.cfg.MainDbPass)

	conn, err := pgx.Connect(context.Background(), dsn)
	if err != nil {
		log.Fatal(err)
	}

	if err := conn.Ping(context.Background()); err != nil {
		log.Fatal(err)
	}

	s.mainDB = conn
}

func (s *Server) SetupRoutes() {
	trackingDomain := tracking.New(s.columnDB, s.ip)
	statDomain := stats.New(s.columnDB)
	s.router.Mount("/track", trackingDomain.Register())
	s.router.Mount("/stats", statDomain.Register())
}

func (s *Server) Run() {
	s.httpServer = &http.Server{
		Addr:              s.cfg.Host + ":" + s.cfg.Port,
		Handler:           s.router,
		ReadHeaderTimeout: s.cfg.ReadHeaderTimeout,
	}

	go func() {
		start(s)
	}()

	_ = gracefulShutdown(context.Background(), s)
}

func gracefulShutdown(ctx context.Context, s *Server) error {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit

	log.Println("Shutting down...")

	ctx, shutdown := context.WithTimeout(ctx, 30*time.Second)
	defer shutdown()

	err := s.httpServer.Shutdown(ctx)
	if err != nil {
		log.Println(err)
	}

	s.closeResources(ctx)

	return nil
}

func (s *Server) closeResources(ctx context.Context) {
	_ = s.columnDB.Close()
	_ = s.mainDB.Close(ctx)
}

func start(s *Server) {
	log.Printf("Serving at %s:%s\n", s.cfg.Host, s.cfg.Port)
	err := s.httpServer.ListenAndServe()
	if err != nil {
		log.Fatal(err)
	}
}
