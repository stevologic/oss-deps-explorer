package gomod

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

// Go implements manager.Manager using the deps.dev API.
type Go struct {
	BaseURL string
}

// Dependencies fetches dependency data from deps.dev.
func (g *Go) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	modulePath := name
	if namespace != "" {
		modulePath = namespace + "/" + name
	}
	client := &depsdev.Client{BaseURL: g.BaseURL}
	return client.GetDependencies(ctx, "go", modulePath, version)
}
