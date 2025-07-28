package manager

import "context"

// Manager defines how to fetch dependencies for a given package coordinate.
type Manager interface {
	// Dependencies returns the dependency tree for the package and the
	// repository URL if known.
	Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error)
}
