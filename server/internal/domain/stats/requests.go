package stats

import (
	"encoding/json"
	"net/http"

	repository "github.com/Fantasy-Programming/pyrrhos/database"
)

func (s *Stats) ViewStats(w http.ResponseWriter, r *http.Request) {
	var data repository.MetricData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	defer r.Body.Close()

	if len(data.What) == 0 {
		data.What = "pv"
	}

	var metrics []repository.Metric
	var err error

	switch data.What {
	case "pv":
		metrics, err = s.DB.GetPageViews(data)
	case "uv":
		metrics, err = s.DB.GetUnique(data)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	b, err := json.Marshal(metrics)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}
