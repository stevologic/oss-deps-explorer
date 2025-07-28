package cargo

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

// Cargo implements manager.Manager using the deps.dev API.
type Cargo struct {
	BaseURL string
}

// Dependencies fetches dependency data from deps.dev.
func (c *Cargo) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: c.BaseURL}
	// namespace is unused for Cargo
	return client.GetDependencies(ctx, "cargo", name, version)
}
