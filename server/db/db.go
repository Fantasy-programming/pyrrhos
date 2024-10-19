package db

import (
	"context"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/mileusna/useragent"
)

type QData struct {
	geo *GeoInfo
	ua  useragent.UserAgent
	trk Tracking
}

type Events struct {
	DB   clickhouse.Conn
	Ch   chan QData
	q    []QData
	lock sync.RWMutex
}

type TrackingData struct {
	Type          string `json:"type"`
	Identity      string `json:"identity"`
	UserAgent     string `json:"ua"`
	Event         string `json:"event"`
	Category      string `json:"category"`
	Referrer      string `json:"referrer"`
	ReferrerHost  string
	IsTouchDevice bool `json:"isTouch"`
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
	conn, err := clickhouse.Open(
		&clickhouse.Options{
			Addr: []string{"127.0.0.1:9000"},
			Auth: clickhouse.Auth{
				Database: "default",
				Username: "default",
				Password: "",
			},
		},
	)

	if err != nil {
		return err
	} else if err := conn.Ping(context.Background()); err != nil {
		return err
	}

	e.DB = conn
	return nil
}

func (e *Events) EnsureTable() error {
	qry := `
   CREATE TABLE IF NOT EXISTS events (
   site_id String NOT NULL,
   occured_at UInt32 NOT NULL,
   type String NOT NULL,
   user_id String NOT NULL,
   event String NOT NULL,
   category String NOT NULL,
   referrer String NOT NULL,
   referrer_domain String NOT NULL,
   is_touch BOOLEAN NOT NULL,
   browser_name String NOT NULL,
   os_name String NOT NULL,
   device_type String NOT NULL,
   country String NOT NULL,
   region String NOT NULL,
   timestamp DateTime DEFAULT now()
   )
   ENGINE MergeTree
   ORDER BY (site_id, occured_at);
  `
	return e.DB.Exec(context.Background(), qry)
}

func (e *Events) Add(trk Tracking, ua useragent.UserAgent, geo *GeoInfo) {
	e.Ch <- QData{geo, ua, trk}
}

func (e *Events) Run() {
	timer := time.NewTimer(time.Second * 10)

	for {
		select {
		case data := <-e.Ch:
			e.lock.Lock()
			e.q = append(e.q, data)
			c := len(e.q)
			e.lock.Unlock()

			if c >= 15 {
				if err := e.Insert(); err != nil {
					log.Println("error while inserting data: ", err)
				}
			}
		case <-timer.C:
			timer.Reset(time.Second * 10)
			e.lock.RLock()
			c := len(e.q)
			e.lock.RUnlock()
			if c > 0 {
				if err := e.Insert(); err != nil {
					log.Println("error while inserting data: ", err)
				}
			}
		}
	}
}

func (e *Events) Insert() error {
	var tmp []QData
	e.lock.Lock()
	tmp = append(tmp, e.q...)
	e.q = nil
	e.lock.Unlock()

	query := `INSERT INTO events (
		site_id, occured_at, type, user_id, event, category, referrer, referrer_domain, is_touch, browser_name, os_name, device_type, country, region
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
	);`

	batch, err := e.DB.PrepareBatch(context.Background(), query)
	if err != nil {
		return err
	}

	for _, qd := range tmp {
		err := batch.Append(
			qd.trk.SiteID,
			nowToInt(),
			qd.trk.Action.Type,
			qd.trk.Action.Identity,
			qd.trk.Action.Event,
			qd.trk.Action.Category,
			qd.trk.Action.Referrer,
			qd.trk.Action.ReferrerHost,
			qd.trk.Action.IsTouchDevice,
			qd.ua.Name,
			qd.ua.OS,
			qd.ua.Device,
			qd.geo.Country,
			qd.geo.RegionName,
		)
		if err != nil {
			return err
		}
	}

	return batch.Send()
}

func nowToInt() uint32 {
	now := time.Now().Format("20060102")
	i, err := strconv.ParseInt(now, 10, 32)
	if err != nil {
		log.Fatal(err)
	}

	return uint32(i)
}
