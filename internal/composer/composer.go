package composer

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

type Composer struct {
	BaseURL string
}

func (c *Composer) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	pkg := name
	if namespace != "" {
		pkg = namespace + "/" + name
	}
	client := &depsdev.Client{BaseURL: c.BaseURL}
	return client.GetDependencies(ctx, "composer", pkg, version)
}
