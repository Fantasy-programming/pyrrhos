package repository

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func EnsureTable(db clickhouse.Conn) error {
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
	return db.Exec(context.Background(), qry)
}

func nowToInt() uint32 {
	now := time.Now().Format("20060102")
	i, err := strconv.ParseInt(now, 10, 32)
	if err != nil {
		log.Fatal(err)
	}

	return uint32(i)
}
