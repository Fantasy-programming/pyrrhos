package tracking

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/mileusna/useragent"
)

func (t *Tracking) track(w http.ResponseWriter, r *http.Request) {
	defer w.WriteHeader(http.StatusOK)

	rawData := r.URL.Query().Get("data")

	if rawData == "" {
		fmt.Print("malformated request")
		return
	}

	trkData, err := decodeData(rawData)
	if err != nil {
		fmt.Println(err)
		return
	}

	ua := useragent.Parse(trkData.Action.UserAgent)

	headers := []string{"X-Forward-For", "X-Real-IP"}

	ip, err := ipFromRequest(headers, r, t.IP)
	if err != nil {
		fmt.Println("error getting IP: ", err)
		return
	}

	geoInfo, err := getGeoInfo(ip.String())
	if err != nil {
		fmt.Println("error getting geo info", err)
		return
	}

	if len(trkData.Action.Referrer) > 0 {
		u, err := url.Parse(trkData.Action.Referrer)
		if err == nil {
			trkData.Action.ReferrerHost = u.Host
		}
	}

	go t.DB.CreateEvent(trkData, ua, geoInfo)
}
