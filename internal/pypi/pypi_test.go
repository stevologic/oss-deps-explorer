package pypi

import "testing"

func TestParseRequirement(t *testing.T) {
	cases := []struct {
		in   string
		name string
		ver  string
	}{
		{"PySocks!=1.5.7,>=1.5.6; extra == \"socks\"", "PySocks", "1.5.6"},
		{"certifi>=2017.4.17", "certifi", "2017.4.17"},
		{"chardet<6,>=3.0.2; extra == \"use-chardet-on-py3\"", "chardet", "3.0.2"},
		{"charset_normalizer<4,>=2", "charset_normalizer", "2"},
		{"idna<4,>=2.5", "idna", "2.5"},
		{"urllib3<3,>=1.21.1", "urllib3", "1.21.1"},
	}
	for _, c := range cases {
		n, v := parseRequirement(c.in)
		if n != c.name || v != c.ver {
			t.Errorf("parseRequirement(%q)=(%q,%q) want (%q,%q)", c.in, n, v, c.name, c.ver)
		}
	}
}
