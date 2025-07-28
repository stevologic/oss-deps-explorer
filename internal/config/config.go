package config

import (
	"io/ioutil"
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
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, err
	}
	return &c, nil
}
