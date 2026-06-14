package config

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config defines the configuration for the service
// loaded from a YAML file.
type Config struct {
	Server struct {
		Port string `yaml:"port"`
	} `yaml:"server"`
	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`
	Cache struct {
		TTL time.Duration `yaml:"ttl"`
	} `yaml:"cache"`
	Proxy struct {
		URL string `yaml:"url"`
	} `yaml:"proxy"`
	PackageManager struct {
		NPM      string `yaml:"npm" json:"npm"`
		PyPI     string `yaml:"pypi" json:"pypi"`
		Go       string `yaml:"go" json:"go"`
		Maven    string `yaml:"maven" json:"maven"`
		Cargo    string `yaml:"cargo" json:"cargo"`
		RubyGems string `yaml:"rubygems" json:"rubygems"`
		NuGet    string `yaml:"nuget" json:"nuget"`
		Composer string `yaml:"composer" json:"composer"`
	} `yaml:"package_manager"`
}

// Load reads the configuration from the specified path.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, err
	}
	applyDefaults(&c)
	return &c, nil
}

func applyDefaults(c *Config) {
	if c.Server.Port == "" {
		c.Server.Port = "8080"
	}
	if c.Cache.TTL == 0 {
		c.Cache.TTL = 24 * time.Hour
	}
	if c.PackageManager.NPM == "" {
		c.PackageManager.NPM = "https://api.deps.dev/v3"
	}
	if c.PackageManager.PyPI == "" {
		c.PackageManager.PyPI = "https://api.deps.dev/v3"
	}
	if c.PackageManager.Go == "" {
		c.PackageManager.Go = "https://api.deps.dev/v3"
	}
	if c.PackageManager.Maven == "" {
		c.PackageManager.Maven = "https://api.deps.dev/v3"
	}
	if c.PackageManager.Cargo == "" {
		c.PackageManager.Cargo = "https://api.deps.dev/v3"
	}
	if c.PackageManager.RubyGems == "" {
		c.PackageManager.RubyGems = "https://api.deps.dev/v3"
	}
	if c.PackageManager.NuGet == "" {
		c.PackageManager.NuGet = "https://api.deps.dev/v3"
	}
	if c.PackageManager.Composer == "" {
		c.PackageManager.Composer = "https://repo.packagist.org"
	}
}
