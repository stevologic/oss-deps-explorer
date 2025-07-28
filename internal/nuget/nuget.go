package nuget

import (
	"context"
	"strings"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

type NuGet struct {
	BaseURL string
}

func (n *NuGet) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: n.BaseURL}
	return client.GetDependencies(ctx, "nuget", strings.ToLower(name), version)
}
