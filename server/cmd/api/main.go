package main

import (
	"github.com/Fantasy-Programming/pyrrhos/internal"
)

func main() {
	server := internal.NewServer()
	server.Init()
	server.Run()
}
