package config

import (
	"time"

	"github.com/kelseyhightower/envconfig"
)

type Database struct {
	MainDbUser                   string        `split_words:"true" default:"postgres"`
	MainDbDriver                 string        `split_words:"true" required:"true"`
	AnalyticsDbUser              string        `split_words:"true" default:"default"`
	AnalyticsDbPass              string        `split_words:"true" default:""`
	AnalyticsDbDriver            string        `split_words:"true" default:"clickhouse"`
	MainDbSslMode                string        `split_words:"true" default:"disable"`
	AnalyticsDbName              string        `split_words:"true" default:"analytics"`
	MainDbName                   string        `split_words:"true" default:"pyrrhos"`
	AnalyticsDbHost              string        `split_words:"true" default:"localhost"`
	MainDbPass                   string        `split_words:"true" default:"password"`
	MainDbHost                   string        `split_words:"true" default:"localhost"`
	MainDbMaxConnectionPool      int           `split_words:"true" default:"4"`
	MainDbMaxIdleConnections     int           `split_words:"true" default:"4"`
	MainDbConnectionsMaxLifeTime time.Duration `split_words:"true" default:"300s"`
	MainDbPort                   uint16        `split_words:"true" default:"5432"`
	AnalyticsDbPort              uint16        `split_words:"true" default:"9000"`
}

func DB() Database {
	var db Database
	envconfig.MustProcess("", &db)

	return db
}
