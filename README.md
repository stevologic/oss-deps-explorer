# oss-deps-explorer

`oss-deps-explorer` is a lightweight web application that exposes a REST API and optional browser UI for exploring package dependencies. The service proxies multiple package ecosystems and returns dependencies for a requested package. Dependency data is fetched from the stable [deps.dev](https://deps.dev) v3 API for npm, PyPI, Go, Maven, Cargo, RubyGems, and NuGet, and from Packagist for Composer. Responses are cached in Redis for 24 hours when Redis is available.



<img width="1495" height="1328" alt="image" src="https://github.com/user-attachments/assets/cd662656-877c-4883-84db-88ffe62921e8" />




## Architecture

At startup the service registers an implementation for each supported package manager. Each implementation conforms to a simple `Manager` interface. Requests are served by a Go HTTP server using Gorilla Mux. Dependency graphs are cached in Redis according to the `cache.ttl` setting when Redis is reachable; otherwise the service continues without cache. An optional web front-end consumes the same API to visualize dependencies in the browser.

Optional features include:

* Recursive dependency resolution with the `-recursive` flag.
* Vulnerability lookups from [OSV.dev](https://osv.dev) via the `-vuln` flag.
* Repository health details from OpenSSF Scorecard with `-scorecard`.
* Repository URLs cached alongside dependency data for faster Scorecard lookups.
* GraphViz visual output when `-graph` is supplied or `graph=true` is passed for dependency lookup requests.

Dependencies can also be fetched using a [package URL](https://github.com/package-url/purl-spec) via the `/api/purl/{purl}` endpoint.

Deps.dev API base URLs are exposed via `/api/config`. Package name suggestions can be requested from `/api/suggest/{manager}/{query}`, and version suggestions can be requested from `/api/versions?manager=<manager>&name=<name>[&namespace=<ns>]` for every package manager in the UI.
### Supported package managers

| Manager | Path component mapping | Notes |
|---------|-----------------------|-------|
| `npm`   | namespace = scope, name = package | Namespace may be empty for unscoped packages |
| `pypi`  | name = package | Namespace is ignored |
| `go`    | namespace + name form the module path | Example: `github.com` as namespace and `gorilla/mux` as name |
| `maven` | namespace = groupId, name = artifactId | Uses Maven Central POM files |
| `cargo` | name = crate | Namespace is ignored |
| `rubygems` | name = gem | Namespace is ignored |
| `nuget` | name = package ID | Namespace is ignored |
| `composer` | namespace = vendor, name = package | Uses Packagist API |

For npm, PyPI, Maven, and Cargo, deps.dev provides resolved dependency graph data. For Go, RubyGems, and NuGet, the service uses the current deps.dev requirements endpoint and returns direct requirements. Composer uses Packagist metadata and resolves common Composer version constraints on a best-effort basis for recursive lookups.

## Configuration

Configuration is provided via a YAML file. An example `config.yaml` is included:

```yaml
server:
  port: "8080"
redis:
  addr: "redis:6379"
  password: ""
  db: 0
cache:
  ttl: 24h
proxy:
  url: ""
package_manager:
  npm: "https://api.deps.dev/v3"
  pypi: "https://api.deps.dev/v3"
  go: "https://api.deps.dev/v3"
  maven: "https://api.deps.dev/v3"
  cargo: "https://api.deps.dev/v3"
  rubygems: "https://api.deps.dev/v3"
  nuget: "https://api.deps.dev/v3"
  composer: "https://repo.packagist.org"
```

## Running locally

Build the binary and run it directly:

```bash
go build -o oss-deps-explorer ./cmd/oss-deps-explorer
./oss-deps-explorer -config config.yaml
```

The service listens on the port specified in `config.yaml` (default `8080`).

### Repository metadata utility

Use the `repometa` command to fetch basic information about a GitHub
repository without any authentication:

```bash
go run ./cmd/repometa <owner>/<repo>
```

The output includes description, license, open and closed pull requests,
commit counts and other details.

### MCP server for agent workflows

The project includes a companion Model Context Protocol server for agents that
need dependency intelligence without scraping the UI. The MCP server is a stdio
process that calls the running `oss-deps-explorer` API, so agents use the same
dependency parsing, OSV lookups, repository metadata, and Scorecard data as the
web app.

Start the API first:

```bash
docker-compose up --build api redis
```

Then run the MCP server:

```bash
go run ./cmd/oss-deps-mcp -api http://localhost:8080
```

You can also set the API URL with `OSS_DEPS_EXPLORER_API`:

```bash
OSS_DEPS_EXPLORER_API=http://localhost:8080 go run ./cmd/oss-deps-mcp
```

Build a standalone binary:

```bash
go build -o oss-deps-mcp ./cmd/oss-deps-mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "oss-deps-explorer": {
      "command": "go",
      "args": [
        "run",
        "./cmd/oss-deps-mcp",
        "-api",
        "http://localhost:8080"
      ],
      "env": {
        "OSS_DEPS_EXPLORER_API": "http://localhost:8080"
      }
    }
  }
}
```

The server exposes read-only tools:

| Tool | Purpose |
|------|---------|
| `search_packages` | Search supported ecosystems before deeper analysis |
| `research_dependencies` | Resolve direct/transitive dependencies, OSV status, parent paths, and optional Scorecard data |
| `assess_package_reputation` | Summarize repository metadata and OpenSSF Scorecard reputation signals |
| `plan_vulnerability_remediation` | Produce upgrade and override guidance from OSV advisories, fixed versions, and dependency paths |

Example tool argument for transitive dependency research:

```json
{
  "manager": "npm",
  "name": "axios",
  "version": "1.13.0",
  "recursive": true,
  "vulnerabilities": true,
  "scorecard": true
}
```

### Running on Windows

Build a Windows binary by setting the `GOOS` environment variable:

```bash
GOOS=windows go build -o oss-deps-explorer.exe ./cmd/oss-deps-explorer
oss-deps-explorer.exe -config config.yaml
```

Alternatively run the service using Docker Desktop:

```bash
docker-compose up --build
```

If you have WSL available, you can also follow the Linux instructions inside
your WSL environment.

## Running with Docker


The repository contains Dockerfiles for the API and UI as well as a `docker-compose.yml` file to make running the services easy:


```bash
docker-compose up --build
```


The API will then be available on `localhost:8080` and the UI on `localhost:8081`.
Nodes in the UI's dependency graph link to the corresponding package page for
each supported registry when available.

### Dependency Card

Clicking a node reveals additional repository details pulled from GitHub's
public API (no authentication required). The card displays:

- Repository description
- Primary language
- Archived status
- Creation and update timestamps
- Default branch
- Watcher or subscriber count
- Star and fork counts
- Open issue count
- License information
- Counts of open and closed pull requests
- Total commit count and the date of the latest commit
- Highest vulnerability score from OSV (hover for details)


### Deploying with Helm

A minimal Helm chart is provided under `helm/oss-deps-explorer`. Install it with:

```bash
helm install deps-explorer ./helm/oss-deps-explorer
```

The chart exposes the service on port `8080` by default.

## Command line flags

The binary accepts the following flags:

| Flag | Description |
|------|-------------|
| `-config` | Path to the YAML configuration file |
| `-recursive` | When set, fetches transitive dependencies by repeatedly querying each dependency |
| `-vuln` | Include vulnerability information from OSV.dev |
| `-scorecard` | Include OpenSSF Scorecard data |
| `-graph` | Output a GraphViz dot representation instead of JSON |

## API Usage
```

GET /api/dependencies/{manager}/{namespace}/{name}/{version}
GET /api/dependencies/{manager}/{name}/{version}
GET /api/purl/{purl}
GET /api/config
GET /api/suggest/{manager}/{query}
GET /api/versions?manager=<manager>&name=<name>[&namespace=<ns>]
GET /api/repo/{repo}
GET /api/github/dependencies?repo=<owner>/<repo>

GET /api/lookup?manager=<manager>&name=<name>&version=<version>[&namespace=<ns>][&recursive=true][&vuln=true][&scorecard=true][&graph=true]

```

Example for npm (no namespace):

```
curl http://localhost:8080/api/dependencies/npm/express/4.18.2
curl http://localhost:8080/api/purl/pkg:npm/express@4.18.2
```

Optional boolean query parameters `recursive`, `vuln`, `scorecard`, and `graph` can override the
server flags per request:

```
curl "http://localhost:8080/api/dependencies/npm/express/4.18.2?recursive=true&vuln=true&scorecard=true"
curl "http://localhost:8080/api/dependencies/npm/express/4.18.2?graph=true"
```

The response JSON has the simple shape:

```json
{
  "dependencies": {
    "<package>": "<version>"
  },
  "repositories": {
    "<package>": "<repo url>"
  }
}
```

When running with the `-recursive` flag, the response also includes a `parents`
object mapping each dependency to the package or packages that introduced it.
Direct dependencies map to an array containing an empty string. If any transitive dependency cannot be
resolved, the response contains an `errors` array describing what failed. When
the `-vuln` flag is supplied, a `vulnerabilities` object is included with
OSV.dev vulnerability information for the resolved packages. When the `-scorecard`
flag is used, a `scorecards` object provides OpenSSF Scorecard results for any
packages backed by a GitHub repository.

The `/lookup` endpoint exposes the same functionality using query parameters instead of path segments.
When `graph=true` is requested, the response is GraphViz DOT with content type
`text/vnd.graphviz`. Recursive graph exports use the `parents` data to preserve
direct and transitive edges instead of flattening every package under the root.
DOT output declares package nodes with version attributes, so dependency-free
packages and version inventory remain visible in graph tooling. Nodes include
OSV status colors and an embedded legend when vulnerability context is exported.
The UI security triage panel can also export the current analysis as JSON,
CycloneDX SBOM, GraphViz DOT, or vulnerable-package CSV.

The `/api/github/dependencies` endpoint imports GitHub dependency graph SBOM
data for a repository and returns analyzable package URLs grouped by supported
package manager. Each package includes cleaned license fields when GitHub's
SPDX SBOM includes `licenseConcluded` or `licenseDeclared`, with `license`
preferring the concluded value and falling back to the declared value. The UI
repository import view exposes license summary filters, license chips on
packages, missing-license isolation, and filtered CSV inventory exports with
license and OSV triage columns for compliance handoff. The same filtered
repository package view can also export CycloneDX JSON with GitHub license
metadata and OSV status properties for SBOM workflows.

Example:

```bash
curl "http://localhost:8080/api/lookup?manager=npm&name=express&version=4.18.2&recursive=true&vuln=true&scorecard=true"
```

## Example requests

Below are sample invocations for each supported manager with shortened output:

```bash
# npm
curl -s http://localhost:8080/api/dependencies/npm/express/4.18.2 | head -c 80
{"dependencies":{"accepts":"~1.3.8",...}}
curl -s http://localhost:8080/api/dependencies/npm/@babel/core/7.21.0 | head -c 80
{"dependencies":{"@ampproject/remapping":"^2.2.0",...}}

# pypi
curl -s http://localhost:8080/api/dependencies/pypi/requests/2.31.0 | head -c 80
{"dependencies":{"PySocks (!=1.5.7,>=1.5.6) ; extra == 'socks',...}}
curl -s http://localhost:8080/api/dependencies/pypi/urllib3/2.2.0 | head -c 80
{"dependencies":{"brotli>=1.0.9; (platform_python_implementation == 'CPython') and extra == 'brotli',...}}

# go
curl -s http://localhost:8080/api/dependencies/go/github.com/gorilla/mux/v1.8.1 | head -c 80
{"dependencies":{}}
curl -s http://localhost:8080/api/dependencies/go/github.com/stretchr/testify/v1.8.2 | head -c 80
{"dependencies":{"github.com/davecgh/go-spew":"v1.1.1",...}}

# maven
curl -s http://localhost:8080/api/dependencies/maven/org.apache.commons/commons-lang3/3.12.0 | head -c 80
{"dependencies":{"com.google.code.findbugs:jsr305":"3.0.2",...}}
curl -s http://localhost:8080/api/dependencies/maven/junit/junit/4.13.2 | head -c 80
{"dependencies":{"org.hamcrest:hamcrest-core":"${hamcrestVersion}",...}}

# cargo
curl -s http://localhost:8080/api/dependencies/cargo/rand/0.8.5 | head -c 80
{"dependencies":{"bincode":"^1.2.1",...}}
curl -s http://localhost:8080/api/dependencies/cargo/serde/1.0.200 | head -c 80
{"dependencies":{"serde_derive":"^1"}}
```

### Full output example

The following shows the complete JSON returned for one of the above requests:

```bash
curl -s http://localhost:8080/api/dependencies/npm/express/4.18.2 | jq
{
  "dependencies": {
    "qs": "6.11.0",
    "depd": "2.0.0",
    "etag": "~1.8.1",
    "send": "0.18.0",
    "vary": "~1.1.2",
    "debug": "2.6.9",
    "fresh": "0.5.2",
    "cookie": "0.5.0",
    "accepts": "~1.3.8",
    "methods": "~1.1.2",
    "type-is": "~1.6.18",
    "parseurl": "~1.3.3",
    "statuses": "2.0.1",
    "encodeurl": "~1.0.2",
    "proxy-addr": "~2.0.7",
    "body-parser": "1.20.1",
    "escape-html": "~1.0.3",
    "http-errors": "2.0.0",
    "on-finished": "2.4.1",
    "safe-buffer": "5.2.1",
    "utils-merge": "1.0.1",
    "content-type": "~1.0.4",
    "finalhandler": "1.2.0",
    "range-parser": "~1.2.1",
    "serve-static": "1.15.0",
    "array-flatten": "1.1.1",
    "path-to-regexp": "0.1.7",
    "setprototypeof": "1.2.0",
    "cookie-signature": "1.0.6",
    "merge-descriptors": "1.0.1",
    "content-disposition": "0.5.4"
  },
  "repositories": {
    "express": "github.com/expressjs/express"
  },
  "vulnerabilities": {
    "express": [
      { "id": "GHSA-xxxx" }
    ]
  }
}
```

### Recursive dependency example

Start the server with the `-recursive` flag to follow transitive dependencies:

```bash
oss-deps-explorer -config config.yaml -recursive -vuln -scorecard
```

Example requests with the expanded output:

```bash
# npm
curl -s http://localhost:8080/api/dependencies/npm/express/4.18.2 | head -c 80
# maven
curl -s http://localhost:8080/api/dependencies/maven/org.apache.commons/commons-lang3/3.12.0 | head -c 80
# go
curl -s http://localhost:8080/api/dependencies/go/github.com/stretchr/testify/v1.8.2 | head -c 80
```

Any dependencies that fail to resolve will appear in an `errors` array in the JSON response.

## Troubleshooting

If the API returns `package not found` for a version that you believe exists,
verify that the version is present in the deps.dev dataset:

```bash
curl https://api.deps.dev/v3/systems/<manager>/packages/<package>/versions/<ver>:dependencies
```

For Go, RubyGems, and NuGet, check the deps.dev requirements endpoint instead:

```bash
curl https://api.deps.dev/v3/systems/<manager>/packages/<package>/versions/<ver>:requirements
```

If this request fails or returns `403 Forbidden`, your environment may block
outbound HTTPS requests. Configure an HTTP proxy by setting `proxy.url` in
`config.yaml` or the `HTTP_PROXY` environment variable so the service can reach
`api.deps.dev`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. This project is released under the [MIT License](LICENSE).


