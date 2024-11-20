package repository

import (
	"log"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/mileusna/useragent"
)

type QueueData struct {
	geoInfo   *GeoInfo
	useragent useragent.UserAgent
	tracking  Tracking
}

type EVQueue struct {
	Chan      chan QueueData
	queueData []QueueData
	lock      sync.RWMutex
}

type Queries struct {
	DB    clickhouse.Conn
	Queue *EVQueue
}

func New(db clickhouse.Conn) *Queries {
	return &Queries{
		DB: db,
		Queue: &EVQueue{
			Chan: make(chan QueueData),
		},
	}
}

func (query *Queries) InitQueue() {
	timer := time.NewTimer(time.Second * 10)

	for {
		select {
		case data := <-query.Queue.Chan:
			query.Queue.lock.Lock()
			query.Queue.queueData = append(query.Queue.queueData, data)
			count := len(query.Queue.queueData)
			query.Queue.lock.Unlock()

			if count >= 15 {
				if err := query.InsertEvents(); err != nil {
					log.Println("error while inserting data: ", err)
				}
			}
		case <-timer.C:
			timer.Reset(time.Second * 10)
			query.Queue.lock.RLock()
			count := len(query.Queue.queueData)
			query.Queue.lock.RUnlock()
			if count > 0 {
				if err := query.InsertEvents(); err != nil {
					log.Println("error while inserting data: ", err)
				}
			}
		}
	}
}
