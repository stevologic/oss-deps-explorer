package maven

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

// Maven implements manager.Manager using the deps.dev API.
type Maven struct {
	BaseURL string
}

// Dependencies fetches dependency data from deps.dev.
func (m *Maven) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	pkg := name
	if namespace != "" {
		pkg = namespace + ":" + name
	}
	client := &depsdev.Client{BaseURL: m.BaseURL}
	return client.GetDependencies(ctx, "maven", pkg, version)
}
