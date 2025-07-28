package npm

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

// NPM implements manager.Manager using the deps.dev API.
type NPM struct {
	BaseURL string
}

// Dependencies fetches dependency information from deps.dev.
func (n *NPM) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: n.BaseURL}
	pkg := name
	if namespace != "" {
		pkg = namespace + "/" + name
	}
	return client.GetDependencies(ctx, "npm", pkg, version)
}
