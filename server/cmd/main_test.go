package main

import "testing"

func TestDecodeData(t *testing.T) {
	payload, err := decodeData("eyJ0cmFja2luZyI6eyJ0eXBlIjoicGFnZSIsImlkZW50aXR5IjoiIiwiaXNUb3VjaCI6ZmFsc2UsInVhIjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyOS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiZXZlbnQiOiIvIiwiY2F0ZWdvcnkiOiJQYWdlIHZpZXdzIiwicmVmZXJyZXIiOiIifSwic2l0ZV9pZCI6ImZ1Y2sifQ==")

	if err != nil {
		t.Fatal(err)
	} else if payload.SiteID != "fuck" {
		t.Errorf("expected 'test' got %s", payload.SiteID)
	}
}
