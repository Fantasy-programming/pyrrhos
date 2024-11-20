package config

type Config struct {
	Service
	Database
	Api
}

func New() *Config {
	return &Config{
		Api:      API(),
		Database: DB(),
		Service:  Services(),
	}
}
