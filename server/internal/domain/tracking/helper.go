package tracking

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	repository "github.com/Fantasy-Programming/pyrrhos/database"
)

func decodeData(raw string) (data repository.Tracking, err error) {
	b, err := base64.StdEncoding.DecodeString(raw)
	data = repository.Tracking{}

	if err != nil {
		return data, err
	}

	err = json.Unmarshal(b, &data)
	return data, err
}

func ipFromRequest(headers []string, r *http.Request, overwriteIP string) (net.IP, error) {
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

	if len(overwriteIP) > 0 {
		remoteIP = overwriteIP
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

// TODO: Change to prod echoip
func getGeoInfo(ip string) (*repository.GeoInfo, error) {
	req, err := http.NewRequest("GET", "http://localhost:3002/json?ip="+ip, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var info repository.GeoInfo
	err = json.NewDecoder(resp.Body).Decode(&info)
	return &info, err
}
