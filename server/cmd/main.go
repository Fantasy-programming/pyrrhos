package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/Fantasy-Programming/pyrrhos/db"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/mileusna/useragent"
)

var (
	events  *db.Events = &db.Events{Ch: make(chan db.QData)}
	forceIP string
)

func main() {
	flag.StringVar(&forceIP, "ip", "", "force IP for request, useful in local")
	flag.Parse()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/track", track)

	if err := events.Open(); err != nil {
		log.Fatal(err)
	} else if err := events.EnsureTable(); err != nil {
		log.Fatal(err)
	}

	go events.Run()
	log.Println("listening on port 9876")
	http.ListenAndServe(":9876", r)
}

func track(w http.ResponseWriter, r *http.Request) {
	defer w.WriteHeader(http.StatusOK)

	rawData := r.URL.Query().Get("data")

	if rawData == "" {
		fmt.Print("malformated request")
	}

	trkData, err := decodeData(rawData)
	if err != nil {
		fmt.Println(err)
	}

	ua := useragent.Parse(trkData.Action.UserAgent)

	headers := []string{"X-Forward-For", "X-Real-IP"}

	ip, err := ipFromRequest(headers, r)
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

	go events.Add(trkData, ua, geoInfo)
}

func decodeData(raw string) (data db.Tracking, err error) {
	b, err := base64.StdEncoding.DecodeString(raw)
	data = db.Tracking{}

	if err != nil {
		return data, err
	}

	err = json.Unmarshal(b, &data)
	return data, err
}

func ipFromRequest(headers []string, r *http.Request) (net.IP, error) {
	remoteIP := ""

	for _, header := range headers {
		remoteIP = r.Header.Get(header)

		if http.CanonicalHeaderKey(header) == "X-Forwarded-For" {
			remoteIP = ipFromForwardedForHeader(remoteIP)
		}

		if remoteIP != "" {
			break
		}

	}

	if remoteIP == "" {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return nil, err
		}

		remoteIP = host
	}

	if len(forceIP) > 0 {
		remoteIP = forceIP
	}

	ip := net.ParseIP(remoteIP)

	if ip == nil {
		return nil, fmt.Errorf("could not parse IP: %s", remoteIP)
	}

	return ip, nil
}

func ipFromForwardedForHeader(v string) string {
	sep := strings.Index(v, ",")
	if sep == -1 {
		return v
	}
	return v[:sep]
}

func getGeoInfo(ip string) (*db.GeoInfo, error) {
	req, err := http.NewRequest("GET", "http://localhost:3002/json?ip="+ip, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var info db.GeoInfo
	err = json.NewDecoder(resp.Body).Decode(&info)
	return &info, err
}
