package db

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mileusna/useragent"
)

type Events struct {
	DB *pgx.Conn
}

type TrackingData struct {
	Type          string `json:"type"`
	Identity      string `json:"identity"`
	UserAgent     string `json:"ua"`
	Event         string `json:"event"`
	Category      string `json:"category"`
	Referrer      string `json:"referrer"`
	IsTouchDevice bool   `json:"isTouch"`
}

type Tracking struct {
	SiteID string       `json:"site_id"`
	Action TrackingData `json:"tracking"`
}

type GeoInfo struct {
	IP         string  `json:"ip"`
	Country    string  `json:"country"`
	CountryISO string  `json:"country_iso"`
	RegionName string  `json:"region_name"`
	RegionCode string  `json:"region_code"`
	City       string  `json:"city"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
}

func (e *Events) Open() error {
	conn, err := pgx.Connect(
		context.Background(),
		"postgres://test:test123@localhost:5432/pyrrhos",
	)

	if err != nil {
		return err
	} else if err := conn.Ping(context.Background()); err != nil {
		return err
	}

	e.DB = conn
	return nil
}

func (e *Events) Add(trk Tracking, ua useragent.UserAgent, geo *GeoInfo) error {
	query := `INSERT INTO events (
		site_id, occured_at, type, user_id, event, category, referrer, is_touch, browser_name, os_name, device_type, country, region
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
	);`

	_, err := e.DB.Exec(context.Background(), query,
		trk.SiteID,
		nowToInt(),
		trk.Action.Type,
		trk.Action.Identity,
		trk.Action.Event,
		trk.Action.Category,
		trk.Action.Referrer,
		trk.Action.IsTouchDevice,
		ua.Name,
		ua.OS,
		ua.Device,
		geo.Country,
		geo.RegionName,
	)

	return err
}

func nowToInt() uint32 {
	now := time.Now().Format("20060102")
	i, err := strconv.ParseInt(now, 10, 32)
	if err != nil {
		log.Fatal(err)
	}

	return uint32(i)
}
