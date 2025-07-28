package rubygems

import (
	"context"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

type RubyGems struct {
	BaseURL string
}

func (r *RubyGems) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: r.BaseURL}
	// namespace unused for RubyGems
	return client.GetDependencies(ctx, "rubygems", name, version)
}
