package config

import "github.com/kelseyhightower/envconfig"

type Service struct {
	EchoIpHost string `split_words:"true" required:"true"`
}

func Services() Service {
	var service Service
	envconfig.MustProcess("SRV", &service)
	return service
}
