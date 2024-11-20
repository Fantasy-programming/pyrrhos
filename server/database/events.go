package repository

import (
	"context"

	"github.com/mileusna/useragent"
)

func (q *Queries) CreateEvent(trk Tracking, ua useragent.UserAgent, geo *GeoInfo) {
	q.Queue.Chan <- QueueData{geo, ua, trk}
}

// InsertEvents in the queue
func (query *Queries) InsertEvents() error {
	var tmp []QueueData

	query.Queue.lock.Lock()
	tmp = append(tmp, query.Queue.queueData...)
	query.Queue.queueData = nil
	query.Queue.lock.Unlock()

	cmd := `INSERT INTO events (
		site_id, occured_at, type, user_id, event, category, referrer, referrer_domain, is_touch, browser_name, os_name, device_type, country, region
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
	);`

	batch, err := query.DB.PrepareBatch(context.Background(), cmd)
	if err != nil {
		return err
	}

	for _, queueData := range tmp {
		err := batch.Append(
			queueData.tracking.SiteID,
			nowToInt(),
			queueData.tracking.Action.Type,
			queueData.tracking.Action.Identity,
			queueData.tracking.Action.Event,
			queueData.tracking.Action.Category,
			queueData.tracking.Action.Referrer,
			queueData.tracking.Action.ReferrerHost,
			queueData.tracking.Action.IsTouchDevice,
			queueData.useragent.Name,
			queueData.useragent.OS,
			queueData.useragent.Device,
			queueData.geoInfo.Country,
			queueData.geoInfo.RegionName,
		)
		if err != nil {
			return err
		}
	}

	return batch.Send()
}

func (query *Queries) GetStats(qry string, site_id string, start uint32, end uint32) ([]Metric, error) {
	rows, err := query.DB.Query(context.Background(), qry, site_id, start, end)
	if err != nil {
		return nil, err
	}

	var metrics []Metric
	for rows.Next() {
		var m Metric
		if err := rows.Scan(&m.OccuredAt, &m.Value, &m.Count); err != nil {
			return nil, err
		}

		metrics = append(metrics, m)
	}

	return metrics, rows.Err()
}

func (query *Queries) GetUnique(data MetricData) ([]Metric, error) {
	qry := `
  SELECT occured_at, user_id, COUNT(*)
  FROM events
  WHERE site_id = $1
  GROUP BY occured_at, user_id, event
  HAVING occured_at BETWEEN $2 AND $3;
  `

	return query.GetStats(qry, data.SiteID, data.Start, data.End)
}

func (query *Queries) GetPageViews(data MetricData) ([]Metric, error) {
	qry := `
  SELECT occured_at, event, COUNT(*)
  FROM events
  WHERE site_id = $1
  GROUP BY occured_at, event
  HAVING occured_at BETWEEN $2 AND $3;
  `

	return query.GetStats(qry, data.SiteID, data.Start, data.End)
}
