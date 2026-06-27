package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/example/oss-deps-explorer/internal/mcpserver"
)

func main() {
	defaultAPI := os.Getenv("OSS_DEPS_EXPLORER_API")
	if defaultAPI == "" {
		defaultAPI = mcpserver.DefaultAPIBase
	}

	var apiBase string
	var timeout time.Duration
	flag.StringVar(&apiBase, "api", defaultAPI, "oss-deps-explorer API base URL")
	flag.DurationVar(&timeout, "timeout", 60*time.Second, "per-tool request timeout")
	flag.Parse()

	logger := log.New(os.Stderr, "oss-deps-mcp: ", log.LstdFlags)
	client := mcpserver.NewHTTPExplorerClient(apiBase, timeout)
	server := mcpserver.New(client)
	server.SetTimeout(timeout)

	if err := server.Serve(context.Background(), os.Stdin, os.Stdout); err != nil {
		logger.Printf("server stopped: %v", err)
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
