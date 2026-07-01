const e = React.createElement;

const pmDisplayNames = {
  npm: "NPM",
  pypi: "PyPI",
  go: "Go modules",
  maven: "Maven",
  cargo: "Cargo",
  rubygems: "RubyGems",
  nuget: "NuGet",
  composer: "Composer",
};

const iconManagers = ["npm", "pypi", "go", "maven", "cargo"];

const formatNumber = (n) => (n >= 1000 ? n.toLocaleString("en-US") : n);

const validPackageManagers = new Set(Object.keys(pmDisplayNames));

const splitDeepLinkName = (mgr, nsVal, nameVal) => {
  const rawName = String(nameVal || "").trim();
  const namespace = String(nsVal || "").trim();
  if (!rawName) return { namespace, name: "" };
  if (namespace) return { namespace, name: rawName };
  if (mgr === "maven" && rawName.includes(":")) {
    const [group, artifact] = rawName.split(":", 2);
    return { namespace: group, name: artifact };
  }
  if ((mgr === "npm" || mgr === "composer") && rawName.includes("/")) {
    const idx = rawName.indexOf("/");
    return { namespace: rawName.slice(0, idx), name: rawName.slice(idx + 1) };
  }
  if (mgr === "go" && rawName.includes("/")) {
    const idx = rawName.lastIndexOf("/");
    return { namespace: rawName.slice(0, idx), name: rawName.slice(idx + 1) };
  }
  return { namespace: "", name: rawName };
};

const parsePackageDeepLink = (search = window.location.search) => {
  const params = new URLSearchParams(search);
  const managerParam = params.get("manager") || params.get("pm") || "npm";
  const manager = validPackageManagers.has(managerParam) ? managerParam : "npm";
  const rawName =
    params.get("name") || params.get("package") || params.get("pkg") || "";
  const parsed = splitDeepLinkName(
    manager,
    params.get("namespace") || params.get("ns") || "",
    rawName,
  );
  if (!parsed.name) return null;
  return {
    manager,
    namespace: parsed.namespace,
    name: parsed.name,
    version: params.get("version") || params.get("ver") || "",
  };
};

const buildPackageDeepLink = ({ manager, namespace, name, version }) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("manager", manager || "npm");
  if (namespace) url.searchParams.set("namespace", namespace);
  url.searchParams.set("name", name || "");
  if (version) url.searchParams.set("version", version);
  return url.toString();
};

const extractAdvisoryId = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(
    /(CVE-\d{4}-\d{4,}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|OSV-\d{4}-\d+|PYSEC-\d{4}-\d+)/i,
  );
  return (match ? match[1] : raw).trim().toUpperCase();
};

const parseCveDeepLink = (search = window.location.search) => {
  const params = new URLSearchParams(search);
  const id =
    params.get("cve") ||
    params.get("advisory") ||
    params.get("vulnerability") ||
    params.get("vuln") ||
    "";
  const normalized = extractAdvisoryId(id);
  return normalized ? { id: normalized } : null;
};

const buildCveDeepLink = (id) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("cve", extractAdvisoryId(id));
  return url.toString();
};

const parseGithubRepoDeepLink = (search = window.location.search) => {
  const params = new URLSearchParams(search);
  const repo =
    params.get("repo") ||
    params.get("repository") ||
    params.get("github_repo") ||
    "";
  const trimmed = repo.trim();
  return trimmed ? { repo: trimmed } : null;
};

const encodeGithubRepoParam = (repo) =>
  encodeURIComponent(String(repo || "").trim()).replace(/%2F/gi, "/");

const buildGithubRepoDeepLink = (repo) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  const encodedRepo = encodeGithubRepoParam(repo);
  if (encodedRepo) url.search = `?repo=${encodedRepo}`;
  return url.toString();
};

const ecosystemToManager = {
  npm: "npm",
  pypi: "pypi",
  pyPI: "pypi",
  "PyPI": "pypi",
  go: "go",
  Go: "go",
  maven: "maven",
  Maven: "maven",
  "crates.io": "cargo",
  crates: "cargo",
  RubyGems: "rubygems",
  rubygems: "rubygems",
  NuGet: "nuget",
  nuget: "nuget",
  Packagist: "composer",
  packagist: "composer",
};

const wellKnownPackages = {
  npm: [
    { name: "react" },
    { name: "axios" },
    { name: "express" },
    { name: "lodash" },
    { name: "typescript" },
    { name: "vite" },
    { name: "next" },
    { namespace: "@angular", name: "core" },
    { name: "vue" },
    { name: "webpack" },
    { name: "eslint" },
    { name: "jest" },
    { name: "zod" },
    { name: "mongoose" },
    { name: "tailwindcss" },
    { name: "chalk" },
  ],
  pypi: [
    { name: "requests" },
    { name: "django" },
    { name: "flask" },
    { name: "fastapi" },
    { name: "numpy" },
    { name: "pandas" },
    { name: "pydantic" },
    { name: "boto3" },
    { name: "sqlalchemy" },
    { name: "pytest" },
    { name: "celery" },
    { name: "cryptography" },
    { name: "pillow" },
    { name: "scikit-learn" },
    { name: "tensorflow" },
    { name: "torch" },
  ],
  go: [
    { namespace: "github.com/gin-gonic", name: "gin" },
    { namespace: "github.com/spf13", name: "cobra" },
    { namespace: "golang.org/x", name: "net" },
    { namespace: "google.golang.org", name: "grpc" },
    { namespace: "github.com/stretchr", name: "testify" },
    { namespace: "github.com/go-chi", name: "chi/v5" },
    { namespace: "github.com/gorilla", name: "mux" },
    { namespace: "github.com/sirupsen", name: "logrus" },
    { namespace: "github.com/joho", name: "godotenv" },
    { namespace: "github.com/redis", name: "go-redis/v9" },
    { namespace: "gorm.io", name: "gorm" },
    { namespace: "go.uber.org", name: "zap" },
  ],
  maven: [
    { namespace: "org.apache.logging.log4j", name: "log4j-core" },
    { namespace: "org.springframework", name: "spring-core" },
    { namespace: "com.fasterxml.jackson.core", name: "jackson-databind" },
    { namespace: "org.apache.commons", name: "commons-lang3" },
    { namespace: "com.google.guava", name: "guava" },
    { namespace: "junit", name: "junit" },
    { namespace: "org.springframework.boot", name: "spring-boot-starter-web" },
    { namespace: "org.slf4j", name: "slf4j-api" },
    { namespace: "ch.qos.logback", name: "logback-classic" },
    { namespace: "org.hibernate.orm", name: "hibernate-core" },
    { namespace: "com.squareup.okhttp3", name: "okhttp" },
    { namespace: "org.mockito", name: "mockito-core" },
    { namespace: "org.junit.jupiter", name: "junit-jupiter-api" },
    { namespace: "org.yaml", name: "snakeyaml" },
  ],
  cargo: [
    { name: "serde" },
    { name: "tokio" },
    { name: "rand" },
    { name: "reqwest" },
    { name: "clap" },
    { name: "anyhow" },
    { name: "thiserror" },
    { name: "regex" },
    { name: "tracing" },
    { name: "axum" },
    { name: "hyper" },
    { name: "sqlx" },
    { name: "uuid" },
    { name: "chrono" },
    { name: "log" },
  ],
  rubygems: [
    { name: "rails" },
    { name: "rack" },
    { name: "nokogiri" },
    { name: "sidekiq" },
    { name: "puma" },
    { name: "devise" },
    { name: "rspec" },
    { name: "rubocop" },
    { name: "sinatra" },
    { name: "faraday" },
    { name: "activerecord" },
    { name: "redis" },
    { name: "jwt" },
    { name: "pg" },
  ],
  nuget: [
    { name: "Newtonsoft.Json" },
    { name: "Serilog" },
    { name: "Microsoft.Extensions.Logging" },
    { name: "Dapper" },
    { name: "NUnit" },
    { name: "AutoMapper" },
    { name: "Polly" },
    { name: "Microsoft.EntityFrameworkCore" },
    { name: "Microsoft.AspNetCore.Authentication.JwtBearer" },
    { name: "FluentValidation" },
    { name: "Moq" },
    { name: "xunit" },
    { name: "Npgsql" },
    { name: "Swashbuckle.AspNetCore" },
    { name: "RestSharp" },
  ],
  composer: [
    { namespace: "laravel", name: "framework" },
    { namespace: "symfony", name: "console" },
    { namespace: "guzzlehttp", name: "guzzle" },
    { namespace: "twig", name: "twig" },
    { namespace: "phpunit", name: "phpunit" },
    { namespace: "doctrine", name: "orm" },
    { namespace: "psr", name: "log" },
    { namespace: "monolog", name: "monolog" },
    { namespace: "symfony", name: "http-foundation" },
    { namespace: "symfony", name: "routing" },
    { namespace: "composer", name: "semver" },
    { namespace: "vlucas", name: "phpdotenv" },
    { namespace: "nesbot", name: "carbon" },
    { namespace: "phpstan", name: "phpstan" },
    { namespace: "fakerphp", name: "faker" },
  ],
};

const permissiveLicenseIds = new Set([
  "0BSD",
  "AFL-2.1",
  "AFL-3.0",
  "Apache-1.1",
  "Apache-2.0",
  "Artistic-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-2-Clause-FreeBSD",
  "BSD-2-Clause-Patent",
  "BSD-3-Clause",
  "BSD-3-Clause-Clear",
  "BSD-4-Clause",
  "BSL-1.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MulanPSL-2.0",
  "NCSA",
  "OFL-1.1",
  "PostgreSQL",
  "Python-2.0",
  "Unlicense",
  "WTFPL",
  "Zlib",
]);

const copyleftLicensePrefixes = ["AGPL-", "GPL-", "LGPL-"];
const reciprocalLicensePrefixes = [
  "CDDL-",
  "CPL-",
  "EPL-",
  "EUPL-",
  "MPL-",
  "OSL-",
];
const reviewLicenseIds = new Set([
  "BSD-3-Clause-No-Nuclear-License",
  "CC-BY-NC-4.0",
  "LicenseRef-scancode-proprietary-license",
  "NONE",
  "NOASSERTION",
  "UNLICENSED",
]);

const githubLicenseExpressionTokens = (expression) =>
  String(expression || "")
    .replace(/[(),]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        !["AND", "OR", "WITH"].includes(token.toUpperCase()),
    );

const isLicenseExceptionToken = (token) => /exception/i.test(token);
const hasLicensePrefix = (token, prefixes) =>
  prefixes.some((prefix) => token.toUpperCase().startsWith(prefix));
const isCopyleftLicenseToken = (token) =>
  hasLicensePrefix(token, copyleftLicensePrefixes);
const isReciprocalLicenseToken = (token) =>
  hasLicensePrefix(token, reciprocalLicensePrefixes);
const isPermissiveLicenseToken = (token) =>
  permissiveLicenseIds.has(token.replace(/\+$/, ""));
const isReviewLicenseToken = (token) => {
  const normalized = token.replace(/\+$/, "");
  return (
    reviewLicenseIds.has(normalized) ||
    /^LicenseRef-/i.test(normalized) ||
    /^SEE-?LICENSE-?IN/i.test(normalized)
  );
};

const githubLicensePolicyFromExpression = (expression) => {
  const license = String(expression || "").trim();
  if (!license) {
    return {
      status: "missing",
      label: "Missing SPDX",
      shortLabel: "Missing",
      detail: "No SPDX license metadata was returned by GitHub.",
    };
  }
  const tokens = githubLicenseExpressionTokens(license);
  if (tokens.length === 0) {
    return {
      status: "missing",
      label: "Missing SPDX",
      shortLabel: "Missing",
      detail: "No SPDX license metadata was returned by GitHub.",
    };
  }

  const hasCopyleft = tokens.some(isCopyleftLicenseToken);
  const hasReciprocal = tokens.some(isReciprocalLicenseToken);
  const hasReview = tokens.some(isReviewLicenseToken);
  const hasPermissive = tokens.some(isPermissiveLicenseToken);
  const hasChoice = /\bOR\b/i.test(license);

  if (hasReview) {
    return {
      status: "review",
      label: "Needs review",
      shortLabel: "Review",
      detail: `${license} uses custom, proprietary, or unresolved license metadata.`,
    };
  }
  if (hasCopyleft && hasChoice && hasPermissive) {
    return {
      status: "review",
      label: "Dual-license review",
      shortLabel: "Review",
      detail: `${license} includes a copyleft option and should be reviewed before use.`,
    };
  }
  if (hasCopyleft) {
    return {
      status: "copyleft",
      label: "Copyleft",
      shortLabel: "Copyleft",
      detail: `${license} includes GPL-family copyleft terms.`,
    };
  }
  if (hasReciprocal) {
    return {
      status: "review",
      label: "Reciprocal review",
      shortLabel: "Review",
      detail: `${license} includes reciprocal license terms that may need policy review.`,
    };
  }
  if (
    tokens.every(
      (token) =>
        isPermissiveLicenseToken(token) || isLicenseExceptionToken(token),
    )
  ) {
    return {
      status: "permissive",
      label: "Permissive",
      shortLabel: "Permissive",
      detail: `${license} is commonly treated as permissive.`,
    };
  }
  return {
    status: "review",
    label: "Needs review",
    shortLabel: "Review",
    detail: `${license} is not in the built-in permissive license allowlist.`,
  };
};

function App() {
  const apiOrigin =
    window.location.port === "8081"
      ? window.location.origin.replace("8081", "8080")
      : window.location.origin;
  const initialDeepLink = React.useMemo(() => parsePackageDeepLink(), []);
  const initialCveDeepLink = React.useMemo(() => parseCveDeepLink(), []);
  const initialRepoDeepLink = React.useMemo(() => parseGithubRepoDeepLink(), []);
  const initialDeepLinkRef = React.useRef(initialDeepLink);
  const initialCveDeepLinkRef = React.useRef(initialCveDeepLink);
  const initialRepoDeepLinkRef = React.useRef(initialRepoDeepLink);
  const deepLinkLoadedRef = React.useRef(false);
  const [searchMode, setSearchMode] = React.useState(
    initialCveDeepLink
      ? "cve"
      : initialRepoDeepLink
        ? "repository"
        : "package",
  );
  const [manager, setManager] = React.useState(
    initialDeepLink?.manager || "npm",
  );
  const [namespace, setNamespace] = React.useState(
    initialDeepLink?.namespace || "",
  );
  const [name, setName] = React.useState(initialDeepLink?.name || "");
  const [version, setVersion] = React.useState(initialDeepLink?.version || "");
  const [latestVersions, setLatestVersions] = React.useState([]);
  const [versionsToShow, setVersionsToShow] = React.useState(5);
  const VERSION_SUGGESTION_PAGE_SIZE = 5;
  const MAX_SUGGESTED_VERSIONS = 24;
  const PACKAGE_SUGGESTION_LIMIT = 16;
  const [versionRisk, setVersionRisk] = React.useState({});
  const versionRiskCacheRef = React.useRef(new Map());
  const [deps, setDeps] = React.useState([]);
  const [packageChainDeps, setPackageChainDeps] = React.useState({});
  const [packageChainLoading, setPackageChainLoading] = React.useState(false);
  const [packageChainActiveKey, setPackageChainActiveKey] = React.useState("");
  const [packageChainProgress, setPackageChainProgress] = React.useState("");
  const [packageChainError, setPackageChainError] = React.useState("");
  const packageChainAbortRef = React.useRef(null);
  const [history, setHistory] = React.useState([]);
  const [nameSuggestions, setNameSuggestions] = React.useState([]);
  const [packageTypeaheadOpen, setPackageTypeaheadOpen] =
    React.useState(false);
  const [packageTypeaheadActive, setPackageTypeaheadActive] =
    React.useState(0);
  const packageSuggestionSuppressUntilRef = React.useRef(0);
  const packageSuggestionSuppressTimerRef = React.useRef(null);
  const [packageSuggestionsSuppressed, setPackageSuggestionsSuppressed] =
    React.useState(false);
  const suppressPackageSuggestionsBriefly = React.useCallback(() => {
    packageSuggestionSuppressUntilRef.current = Date.now() + 450;
    setPackageSuggestionsSuppressed(true);
    if (packageSuggestionSuppressTimerRef.current) {
      clearTimeout(packageSuggestionSuppressTimerRef.current);
    }
    packageSuggestionSuppressTimerRef.current = setTimeout(() => {
      if (Date.now() >= packageSuggestionSuppressUntilRef.current) {
        setPackageSuggestionsSuppressed(false);
        packageSuggestionSuppressTimerRef.current = null;
      }
    }, 475);
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [statusMessages, setStatusMessages] = React.useState([]);
  const [statusIdx, setStatusIdx] = React.useState(0);
  const [statusKey, setStatusKey] = React.useState(0);
  const statusIntervalRef = React.useRef(null);
  const [alerts, setAlerts] = React.useState([]);
  const addAlert = React.useCallback((msg) => {
    setAlerts((prev) => [...prev, msg]);
  }, []);
  const [bellBounce, setBellBounce] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState({});
  const [collapsed, setCollapsed] = React.useState({});
  const [dependencyListFilter, setDependencyListFilter] = React.useState("all");
  const [consoleLines, setConsoleLines] = React.useState([]);
  const [showConsole, setShowConsole] = React.useState(false);
  const consoleBoxRef = React.useRef(null);
  const [showMcpInfo, setShowMcpInfo] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState(() => {
    const stored = localStorage.getItem("appearanceMode");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const nodesRef = React.useRef(null);
  const labelsRef = React.useRef(null);
  const centeredRef = React.useRef(false);
  const graphSizeRef = React.useRef({ width: 0, height: 0 });
  const packageGraphPositionsRef = React.useRef({
    height: 0,
    positions: new Map(),
    width: 0,
  });
  const packageGraphFitSignatureRef = React.useRef("");
  const repoGraphRef = React.useRef(null);
  const [graphResizeKey, setGraphResizeKey] = React.useState(0);
  const uniqueFormName = React.useMemo(() => `form-${Date.now()}`, []);
  const abortRef = React.useRef({ controller: null, timer: null });
  const [pmURLs, setPmURLs] = React.useState({});
  const [cacheStatus, setCacheStatus] = React.useState("");
  const [scorecards, setScorecards] = React.useState({});
  const [rootScore, setRootScore] = React.useState(null);
  const [rootCves, setRootCves] = React.useState([]);
  const [rootVulnerabilities, setRootVulnerabilities] = React.useState([]);
  const [vulnerabilityStatus, setVulnerabilityStatus] = React.useState({});
  const [submittedName, setSubmittedName] = React.useState("");
  const [submittedVersion, setSubmittedVersion] = React.useState("");
  const [submittedNamespace, setSubmittedNamespace] = React.useState("");
  const [submittedManager, setSubmittedManager] = React.useState(manager);
  const [shareStatus, setShareStatus] = React.useState("");
  const shareStatusTimerRef = React.useRef(null);
  const [githubRepoShareStatus, setGithubRepoShareStatus] =
    React.useState("");
  const githubRepoShareStatusTimerRef = React.useRef(null);
  const [githubRepoBriefStatus, setGithubRepoBriefStatus] = React.useState("");
  const githubRepoBriefStatusTimerRef = React.useRef(null);
  const [repos, setRepos] = React.useState({});
  const [repoMeta, setRepoMeta] = React.useState({});
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = React.useState(
    initialRepoDeepLink?.repo || "",
  );
  const [githubRepoLoading, setGithubRepoLoading] = React.useState(false);
  const [githubRepoResult, setGithubRepoResult] = React.useState(null);
  const [githubRepoError, setGithubRepoError] = React.useState("");
  const [githubRepoFilter, setGithubRepoFilter] = React.useState("");
  const [githubRepoStatusFilter, setGithubRepoStatusFilter] =
    React.useState("all");
  const [githubRepoVulnStatus, setGithubRepoVulnStatus] = React.useState({});
  const [githubRepoVulnLoading, setGithubRepoVulnLoading] =
    React.useState(false);
  const [githubRepoVulnProgress, setGithubRepoVulnProgress] =
    React.useState("");
  const [selectedGithubRepoPackage, setSelectedGithubRepoPackage] =
    React.useState(null);
  const [githubRepoGraphExpanded, setGithubRepoGraphExpanded] =
    React.useState(false);
  const [githubRepoTransitiveDeps, setGithubRepoTransitiveDeps] =
    React.useState({});
  const [githubRepoTransitiveLoading, setGithubRepoTransitiveLoading] =
    React.useState(false);
  const [githubRepoTransitiveMode, setGithubRepoTransitiveMode] =
    React.useState("");
  const [githubRepoTransitiveActiveKey, setGithubRepoTransitiveActiveKey] =
    React.useState("");
  const [githubRepoTransitiveProgress, setGithubRepoTransitiveProgress] =
    React.useState("");
  const [githubRepoTransitiveError, setGithubRepoTransitiveError] =
    React.useState("");
  const [githubRepoTreeCollapsed, setGithubRepoTreeCollapsed] =
    React.useState({});
  const githubRepoTransitiveAbortRef = React.useRef(null);
  const githubRepoGraphPositionsRef = React.useRef({
    height: 0,
    positions: new Map(),
    width: 0,
  });
  const githubRepoGraphAnchorsRef = React.useRef({
    height: 0,
    positions: new Map(),
    width: 0,
  });
  const [cveQuery, setCveQuery] = React.useState(
    initialCveDeepLink?.id || "",
  );
  const [cveLoading, setCveLoading] = React.useState(false);
  const [cveResult, setCveResult] = React.useState(null);
  const [cveError, setCveError] = React.useState("");
  const [cveSubmitted, setCveSubmitted] = React.useState(false);
  const showResults = formSubmitted && !loading;
  const showPackageResults = searchMode === "package" && showResults;
  const includeVuln = true;
  const includeScorecard = true;
  const showVersionSuggestions =
    !packageTypeaheadOpen && !version && latestVersions.length > 0;

  const MAX_CONSOLE_LINES = 20;

  const addConsoleLines = (text) => {
    const lines = text.trim().split("\n").slice(0, MAX_CONSOLE_LINES);
    setConsoleLines((prev) => {
      const merged = [...prev, ...lines];
      return merged.slice(-MAX_CONSOLE_LINES);
    });
  };

  const fetchInternal = (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (method === 'GET') {
      addConsoleLines(`> GET ${url}`);
    } else {
      addConsoleLines(`> ${method} ${url}`);
    }
    return fetch(url, opts);
  };

  const normalizePackageVersion = (value) =>
    String(value || "")
      .trim()
      .replace(/^v(?=\d)/i, "");

  const packageHasExactVersion = (value) => {
    const versionValue = normalizePackageVersion(value);
    return Boolean(
      versionValue &&
        versionValue.toLowerCase() !== "latest" &&
        !/[<>=*|,\s]/.test(versionValue),
    );
  };

  const packageDependencyApiUrl = (
    mgr,
    nsVal,
    nameVal,
    versionValue,
    { recursive = true, vuln = true, scorecard = true } = {},
  ) => {
    const versionPart = normalizePackageVersion(versionValue);
    if (!mgr || !nameVal || !packageHasExactVersion(versionPart)) return "";
    const enc = encodeURIComponent;
    const base = `${apiOrigin}/api/dependencies/${enc(mgr)}`;
    let path = "";
    if (mgr === "go") {
      const modulePath = nsVal ? `${nsVal}/${nameVal}` : nameVal;
      path = `${base}/${modulePath.split("/").map(enc).join("/")}/${enc(versionPart)}`;
    } else {
      path = nsVal
        ? `${base}/${enc(nsVal)}/${enc(nameVal)}/${enc(versionPart)}`
        : `${base}/${enc(nameVal)}/${enc(versionPart)}`;
    }
    return `${path}?recursive=${recursive ? "true" : "false"}&vuln=${
      vuln ? "true" : "false"
    }&scorecard=${scorecard ? "true" : "false"}`;
  };

  React.useLayoutEffect(() => {
    if (!showConsole) return undefined;
    const el = consoleBoxRef.current;
    if (!el) return undefined;
    const scrollToEnd = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToEnd();
    const frame = window.requestAnimationFrame(scrollToEnd);
    return () => window.cancelAnimationFrame(frame);
  }, [consoleLines, showConsole]);

  React.useEffect(() => {
    document.documentElement.dataset.theme = appearanceMode;
    localStorage.setItem("appearanceMode", appearanceMode);
  }, [appearanceMode]);

  React.useEffect(() => {
    if (!githubRepoGraphExpanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setGithubRepoGraphExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [githubRepoGraphExpanded]);

  const toggleCve = (key) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleNode = (key, defaultCollapsed = false) => {
    setCollapsed((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? defaultCollapsed),
    }));
  };

  const parseCvssVector = (vector) => {
    const parts = vector.split("/");
    const m = {};
    parts.forEach((p) => {
      const idx = p.indexOf(":");
      if (idx > 0) m[p.slice(0, idx)] = p.slice(idx + 1);
    });
    if (m.CVSS === "4.0") {
      return parseCvss4Vector(m);
    }
    const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[m.AV] || 0;
    const ac = { L: 0.77, H: 0.44 }[m.AC] || 0;
    const ui = { N: 0.85, R: 0.62 }[m.UI] || 0;
    const prU = { N: 0.85, L: 0.62, H: 0.27 };
    const prC = { N: 0.85, L: 0.68, H: 0.5 };
    const pr = (m.S === "C" ? prC[m.PR] : prU[m.PR]) || 0;
    const ci = { N: 0, L: 0.22, H: 0.56 };
    const C = ci[m.C] || 0;
    const I = ci[m.I] || 0;
    const A = ci[m.A] || 0;
    const iscBase = 1 - (1 - C) * (1 - I) * (1 - A);
    const impact =
      m.S === "C"
        ? 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15)
        : 6.42 * iscBase;
    if (impact <= 0) return 0;
    const exploit = 8.22 * av * ac * pr * ui;
    const score =
      m.S === "C"
        ? Math.min(1.08 * (impact + exploit), 10)
        : Math.min(impact + exploit, 10);
    return Math.ceil(score * 10) / 10;
  };

  const parseCvss4Vector = (m) => {
    const exploit = [
      { N: 0.9, A: 0.62, L: 0.45, P: 0.2 }[m.AV] || 0,
      { L: 0.77, H: 0.44 }[m.AC] || 0,
      { N: 0.85, P: 0.62 }[m.AT] || 0,
      { N: 0.85, L: 0.62, H: 0.27 }[m.PR] || 0,
      { N: 0.85, P: 0.62, A: 0.45 }[m.UI] || 0,
    ].reduce((sum, value) => sum + value, 0) / 5;
    const impactValue = { H: 0.9, L: 0.4, N: 0 };
    const vulnerableImpact = Math.max(
      impactValue[m.VC] || 0,
      impactValue[m.VI] || 0,
      impactValue[m.VA] || 0,
    );
    const subsequentImpact = Math.max(
      impactValue[m.SC] || 0,
      impactValue[m.SI] || 0,
      impactValue[m.SA] || 0,
    );
    const impact = Math.max(vulnerableImpact, subsequentImpact * 0.9);
    if (impact <= 0) return 0;
    return Math.min(10, Math.ceil((impact * 6 + exploit * 4) * 10) / 10);
  };

  const severityTextScore = (value) => {
    const label = String(value || "").trim().toUpperCase();
    if (label === "CRITICAL") return 9.5;
    if (label === "HIGH") return 8;
    if (label === "MODERATE" || label === "MEDIUM") return 5.5;
    if (label === "LOW") return 3;
    return NaN;
  };

  const severityScore = (sev) => {
    if (!sev || sev.score === undefined) return NaN;
    if (typeof sev.score === "number") return sev.score;
    const num = parseFloat(sev.score);
    if (!isNaN(num)) return num;
    if (typeof sev.score === "string" && sev.score.startsWith("CVSS:")) {
      return parseCvssVector(sev.score);
    }
    return severityTextScore(sev.score);
  };

  const vulnerabilityScore = (vuln) => {
    let maxScore = 0;
    if (Array.isArray(vuln.severity)) {
      vuln.severity.forEach((severity) => {
        const score = severityScore(severity);
        if (!isNaN(score) && score > maxScore) maxScore = score;
      });
    }
    const textScore = severityTextScore(
      vuln.database_specific && vuln.database_specific.severity,
    );
    if (!isNaN(textScore) && textScore > maxScore) maxScore = textScore;
    return maxScore;
  };

  const compactText = (value, maxLength = 260) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3).trim()}...`;
  };

  const vulnerabilityDescription = (vuln) =>
    compactText(vuln.summary) || compactText(vuln.details);

  const advisoryIds = (vuln) => {
    const ids = [];
    if (Array.isArray(vuln.aliases)) {
      vuln.aliases.forEach((alias) => {
        if (typeof alias === "string") ids.push(alias);
      });
    }
    if (typeof vuln.id === "string") ids.push(vuln.id);
    return ids;
  };

  const preferAdvisoryDescription = (current, next) => {
    if (!current) return next || "";
    if (!next) return current;
    if (next.length > current.length && current.length < 80) return next;
    return current;
  };

  const mergeAdvisory = (map, advisory) => {
    if (!advisory || !advisory.id) return;
    const current = map.get(advisory.id) || {
      id: advisory.id,
      score: 0,
      description: "",
      sourceId: "",
    };
    map.set(advisory.id, {
      ...current,
      score: Math.max(Number(current.score) || 0, Number(advisory.score) || 0),
      description: preferAdvisoryDescription(
        current.description,
        advisory.description,
      ),
      sourceId: current.sourceId || advisory.sourceId || "",
    });
  };

  const advisoryDescriptionGroups = (advisories) => {
    const groups = new Map();
    (advisories || []).forEach((advisory) => {
      if (!advisory.description) return;
      const key = advisory.description;
      if (!groups.has(key)) {
        groups.set(key, {
          description: advisory.description,
          ids: [],
          score: 0,
        });
      }
      const group = groups.get(key);
      group.score = Math.max(group.score, Number(advisory.score) || 0);
      if (!group.ids.includes(advisory.id)) group.ids.push(advisory.id);
    });
    return Array.from(groups.values())
      .sort(
        (a, b) =>
          b.score - a.score || a.description.localeCompare(b.description),
      )
      .slice(0, 3);
  };

  const summarizeVulnerabilities = (vulnList) => {
    const advisoryMap = new Map();
    let maxScore = 0;
    vulnList.forEach((vuln) => {
      const score = vulnerabilityScore(vuln);
      if (score > maxScore) maxScore = score;
      const description = vulnerabilityDescription(vuln);
      advisoryIds(vuln).forEach((id) => {
        mergeAdvisory(advisoryMap, {
          id,
          score,
          description,
          sourceId: vuln.id || id,
        });
      });
    });
    const advisories = Array.from(advisoryMap.values())
      .sort(
        (a, b) =>
          (Number(b.score) || 0) - (Number(a.score) || 0) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5)
      .map((advisory) => ({
        id: advisory.id,
        score: advisory.score,
        description: advisory.description,
        sourceId: advisory.sourceId,
      }));
    return { maxScore, advisories, risk: riskFromScore(maxScore) };
  };

  const maxAdvisoryScore = (advisories) =>
    Math.max(
      0,
      ...(Array.isArray(advisories)
        ? advisories.map((c) => Number(c.score) || 0)
        : []),
    );

  const riskColors = {
    low: "var(--success-color)",
    medium: "var(--warning-color)",
    high: "var(--error-color)",
    critical: "var(--error-color)",
  };

  const osvStatusRank = {
    no_advisory: 1,
    not_checked: 2,
    unknown: 3,
    vulnerable: 4,
  };

  const isUnresolvedOsvStatus = (status) =>
    status && (status.status === "unknown" || status.status === "not_checked");

  const preferOsvStatus = (current, next) => {
    if (!next || !next.status) return current || null;
    if (!current || !current.status) return next;
    const nextRank = osvStatusRank[next.status] || 0;
    const currentRank = osvStatusRank[current.status] || 0;
    if (nextRank > currentRank) return next;
    if (nextRank === currentRank && next.error && !current.error) {
      return { ...current, error: next.error };
    }
    return current;
  };

  const osvStatusLabel = (status) => {
    if (!includeVuln) return "OSV not checked";
    if (!status || !status.status) return "OSV status unavailable";
    if (status.status === "vulnerable") {
      const count = Number(status.advisory_count) || 0;
      return `OSV advisory found${count > 1 ? ` (${count})` : ""}`;
    }
    if (status.status === "no_advisory") {
      return "OSV checked: no advisory returned for this resolved version";
    }
    if (status.status === "not_checked") {
      return `OSV not checked${status.error ? `: ${status.error}` : ""}`;
    }
    return `OSV status unknown${status.error ? `: ${status.error}` : ""}`;
  };

  const riskDotClass = (dep) => {
    if (includeVuln && dep.risk) return `risk-dot risk-${dep.risk}`;
    if (includeVuln && dep.osvStatus?.status === "no_advisory") {
      return "risk-dot risk-no-advisory";
    }
    if (includeVuln && isUnresolvedOsvStatus(dep.osvStatus)) {
      return "risk-dot risk-unknown";
    }
    return "risk-dot risk-none";
  };

  const riskDotTitle = (dep) => {
    if (includeVuln && dep.risk) {
      return `${osvStatusLabel(dep.osvStatus)}. Highest severity: ${dep.risk}`;
    }
    return osvStatusLabel(dep.osvStatus);
  };

  const resolveColor = (color) => {
    if (color && color.startsWith("var(")) {
      const name = color.slice(4, -1);
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    }
    return color;
  };

  const getNodeColor = (d) => {
    if (d.root) {
      if (includeVuln && d.risk && riskColors[d.risk]) {
        return riskColors[d.risk];
      }
      if (includeVuln && isUnresolvedOsvStatus(d.osvStatus)) {
        return "var(--unknown-color)";
      }
      return "#ffffff";
    }
    if (includeVuln && d.risk && riskColors[d.risk]) {
      return riskColors[d.risk];
    }
    if (includeVuln && isUnresolvedOsvStatus(d.osvStatus)) {
      return "var(--unknown-color)";
    }
    return d.transitive ? "#555" : "#999";
  };

  const riskFromScore = (score) => {
    if (score >= 9) return "critical";
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    if (score > 0) return "low";
    return null;
  };

  const riskRank = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const higherRisk = (current, next) => {
    if (!current) return next || null;
    if (!next) return current;
    return (riskRank[next] || 0) > (riskRank[current] || 0) ? next : current;
  };

  const normalizeDependencyRisks = (list) => {
    const byPackageVersion = new Map();
    list.forEach((dep) => {
      const key = `${dep.name}@${dep.version}`;
      if (!byPackageVersion.has(key)) {
        byPackageVersion.set(key, {
          risk: null,
          maxScore: 0,
          advisories: new Map(),
          vulnerabilities: new Map(),
          osvStatus: null,
        });
      }
      const merged = byPackageVersion.get(key);
      merged.osvStatus = preferOsvStatus(merged.osvStatus, dep.osvStatus);
      const advisoryScores = Array.isArray(dep.cves)
        ? dep.cves.map((c) => Number(c.score) || 0)
        : [];
      const depScore = Math.max(
        Number(dep.maxScore) || 0,
        ...advisoryScores,
      );
      const advisoryRisk = riskFromScore(depScore);
      merged.maxScore = Math.max(merged.maxScore, depScore);
      merged.risk = higherRisk(merged.risk, dep.risk || advisoryRisk);
      if (Array.isArray(dep.cves)) {
        dep.cves.forEach((c) => {
          if (!c || !c.id) return;
          mergeAdvisory(merged.advisories, c);
        });
      }
      if (Array.isArray(dep.vulnerabilities)) {
        dep.vulnerabilities.forEach((vuln, idx) => {
          if (!vuln) return;
          const vulnKey = vuln.id || `${key}:vulnerability:${idx}`;
          merged.vulnerabilities.set(vulnKey, vuln);
        });
      }
    });
    return list.map((dep) => {
      const merged = byPackageVersion.get(`${dep.name}@${dep.version}`);
      if (!merged) return dep;
      const cves = Array.from(merged.advisories.values())
        .sort(
          (a, b) =>
            (Number(b.score) || 0) - (Number(a.score) || 0) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 5)
        .map((advisory) => ({
          id: advisory.id,
          score: advisory.score,
          description: advisory.description,
          sourceId: advisory.sourceId,
        }));
      return {
        ...dep,
        risk: merged.risk,
        maxScore: merged.maxScore,
        cves,
        vulnerabilities: Array.from(merged.vulnerabilities.values()),
        osvStatus: merged.osvStatus || dep.osvStatus || null,
      };
    });
  };

  const compareDependencyRisk = (a, b) => {
    const riskDiff = (riskRank[b.risk] || 0) - (riskRank[a.risk] || 0);
    if (riskDiff !== 0) return riskDiff;
    const scoreA = Math.max(
      0,
      ...(Array.isArray(a.cves || a.advisories)
        ? (a.cves || a.advisories).map((c) => Number(c.score) || 0)
        : []),
    );
    const scoreB = Math.max(
      0,
      ...(Array.isArray(b.cves || b.advisories)
        ? (b.cves || b.advisories).map((c) => Number(c.score) || 0)
        : []),
    );
    if (scoreB !== scoreA) return scoreB - scoreA;
    return `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`);
  };

  const safeFilenamePart = (value) =>
    String(value || "dependency-analysis").replace(/[^a-z0-9_.-]+/gi, "_");

  const downloadText = (filename, mimeType, text) => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const csvValue = (value) => {
    const str = String(value === undefined || value === null ? "" : value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const dotQuote = (value) => JSON.stringify(String(value || ""));

  const graphVizColor = (record) => {
    if (record.risk === "critical") return "#ef4444";
    if (record.risk === "high") return "#f97316";
    if (record.risk === "medium") return "#f59e0b";
    if (record.risk === "low") return "#facc15";
    if (record.osvStatus?.status === "no_advisory") return "#22c55e";
    if (isUnresolvedOsvStatus(record.osvStatus)) return "#d4a83a";
    return "#94a3b8";
  };

  const graphVizLegendEntries = [
    ["critical risk", "#ef4444"],
    ["high risk", "#f97316"],
    ["medium risk", "#f59e0b"],
    ["low risk", "#facc15"],
    ["no OSV advisory", "#22c55e"],
    ["unresolved OSV", "#d4a83a"],
    ["not checked", "#94a3b8"],
  ];

  const buildGraphVizDot = (analysis) => {
    const records = new Map();
    const recordKey = (record) => `${record.name}@${record.version || ""}`;
    const addRecord = (record) => {
      if (!record || !record.name) return;
      const key = recordKey(record);
      records.set(key, { ...records.get(key), ...record });
    };
    addRecord({
      name: analysis.root.fullName || analysis.root.name,
      version: analysis.root.version,
      scope: "root",
      risk: analysis.root.risk,
      osvStatus: analysis.root.osvStatus,
    });
    (analysis.components || []).forEach(addRecord);
    const edges = [];
    (analysis.dependencyGraph || []).forEach((entry) => {
      addRecord({ name: entry.name, version: entry.version });
      (entry.dependsOn || []).forEach((dep) => {
        addRecord({ name: dep.name, version: dep.version });
        edges.push([recordKey(entry), recordKey(dep)]);
      });
    });

    const lines = [
      "digraph deps {",
      "    graph [rankdir=LR]",
      "    node [shape=box style=\"rounded,filled\" fontname=\"Inter, Arial\"]",
      "    edge [color=\"#64748b\"]",
    ];
    Array.from(records.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([id, record]) => {
        const attrs = [
          `label=${dotQuote(`${record.name}\\n${record.version || ""}`)}`,
          `fillcolor=${dotQuote(graphVizColor(record))}`,
          `scope=${dotQuote(record.scope || "")}`,
          `risk=${dotQuote(record.risk || "")}`,
          `osv_status=${dotQuote(record.osvStatus?.status || "not_checked")}`,
        ];
        lines.push(`    ${dotQuote(id)} [${attrs.join(" ")}]`);
      });
    edges
      .sort(([aFrom, aTo], [bFrom, bTo]) =>
        aFrom === bFrom ? aTo.localeCompare(bTo) : aFrom.localeCompare(bFrom),
      )
      .forEach(([from, to]) => {
        lines.push(`    ${dotQuote(from)} -> ${dotQuote(to)}`);
      });
    lines.push("    subgraph cluster_legend {");
    lines.push(`        label=${dotQuote("Risk / OSV status")}`);
    lines.push(`        color=${dotQuote("#cbd5e1")}`);
    lines.push(`        style=${dotQuote("rounded")}`);
    graphVizLegendEntries.forEach(([label, color], index) => {
      lines.push(
        `        ${dotQuote(`__legend_${index}`)} [label=${dotQuote(label)} style=${dotQuote("filled")} fillcolor=${dotQuote(color)}]`,
      );
    });
    lines.push("    }");
    lines.push("}");
    return `${lines.join("\n")}\n`;
  };

  const purlEncode = (value) =>
    encodeURIComponent(String(value || "")).replace(/%2F/g, "/");

  const splitPackageForPurl = (mgr, pkg) => {
    if (mgr === "maven" && pkg.includes(":")) {
      const [group, artifact] = pkg.split(":", 2);
      return { group, name: artifact };
    }
    if (
      (mgr === "npm" || mgr === "composer") &&
      pkg.includes("/") &&
      !pkg.startsWith("http")
    ) {
      const idx = pkg.indexOf("/");
      return { group: pkg.slice(0, idx), name: pkg.slice(idx + 1) };
    }
    return { group: "", name: pkg };
  };

  const packagePurl = (mgr, pkg, version) => {
    const { group, name } = splitPackageForPurl(mgr, pkg);
    const encodedVersion = purlEncode(version);
    switch (mgr) {
      case "maven":
        return group
          ? `pkg:maven/${purlEncode(group)}/${purlEncode(name)}@${encodedVersion}`
          : `pkg:maven/${purlEncode(name)}@${encodedVersion}`;
      case "npm":
        return group
          ? `pkg:npm/${purlEncode(group)}/${purlEncode(name)}@${encodedVersion}`
          : `pkg:npm/${purlEncode(name)}@${encodedVersion}`;
      case "pypi":
        return `pkg:pypi/${purlEncode(name)}@${encodedVersion}`;
      case "go":
        return `pkg:golang/${purlEncode(pkg)}@${encodedVersion}`;
      case "cargo":
        return `pkg:cargo/${purlEncode(name)}@${encodedVersion}`;
      case "rubygems":
        return `pkg:gem/${purlEncode(name)}@${encodedVersion}`;
      case "nuget":
        return `pkg:nuget/${purlEncode(name)}@${encodedVersion}`;
      case "composer":
        return group
          ? `pkg:composer/${purlEncode(group)}/${purlEncode(name)}@${encodedVersion}`
          : `pkg:composer/${purlEncode(name)}@${encodedVersion}`;
      default:
        return `pkg:generic/${purlEncode(pkg)}@${encodedVersion}`;
    }
  };

  const componentBomRef = (mgr, pkg, version) =>
    packagePurl(mgr, pkg, version);

  const cycloneSeverity = (score) => {
    const risk = riskFromScore(score);
    return risk || "unknown";
  };

  const cycloneRatingMethod = (type) => {
    if (!type) return undefined;
    const normalized = String(type).toUpperCase();
    if (normalized.includes("CVSS_V4")) return "CVSSv4";
    if (normalized.includes("CVSS_V3")) return "CVSSv3";
    if (normalized.includes("CVSS_V2")) return "CVSSv2";
    return "other";
  };

  const vulnerabilityRatings = (vuln, fallbackScore) => {
    const ratings = [];
    if (Array.isArray(vuln.severity)) {
      vuln.severity.forEach((severity) => {
        const score = severityScore(severity);
        if (isNaN(score) || score <= 0) return;
        const rating = {
          score,
          severity: cycloneSeverity(score),
        };
        const method = cycloneRatingMethod(severity.type);
        if (method) rating.method = method;
        if (severity.score) rating.vector = severity.score;
        ratings.push(rating);
      });
    }
    const dbSeverity =
      vuln.database_specific && vuln.database_specific.severity;
    const textScore = severityTextScore(dbSeverity);
    if (!isNaN(textScore) && textScore > 0) {
      ratings.push({
        score: textScore,
        severity: cycloneSeverity(textScore),
        method: "other",
        source: { name: "OSV database_specific.severity" },
      });
    }
    if (ratings.length === 0 && fallbackScore > 0) {
      ratings.push({
        score: fallbackScore,
        severity: cycloneSeverity(fallbackScore),
        method: "other",
      });
    }
    return ratings;
  };

  const vulnerabilityCwes = (vuln) => {
    const cwes =
      vuln.database_specific && Array.isArray(vuln.database_specific.cwe_ids)
        ? vuln.database_specific.cwe_ids
        : [];
    return cwes
      .map((cwe) => Number(String(cwe).replace(/^CWE-/i, "")))
      .filter((num) => Number.isInteger(num) && num > 0);
  };

  const buildCycloneDxBom = (analysis) => {
    const mgr = analysis.manager;
    const serial =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const componentMap = new Map();
    const componentRefFor = (pkg, version) => componentBomRef(mgr, pkg, version);
    const toComponent = (record, type = "library") => {
      const { group, name } = splitPackageForPurl(mgr, record.name);
      const purl = packagePurl(mgr, record.name, record.version);
      const component = {
        type,
        "bom-ref": purl,
        name,
        version: String(record.version || ""),
        purl,
        properties: [
          { name: "oss-deps-explorer:package-manager", value: mgr },
          {
            name: "oss-deps-explorer:osv-status",
            value: record.osvStatus?.status || "not_checked",
          },
        ],
      };
      if (group) component.group = group;
      if (record.scope) {
        component.scope =
          record.scope === "runtime" || record.scope === "optional"
            ? record.scope
            : "required";
        component.properties.push({
          name: "oss-deps-explorer:dependency-scope",
          value: record.scope,
        });
      }
      if (record.registryUrl) {
        component.externalReferences = [
          { type: "distribution", url: record.registryUrl },
        ];
      }
      return component;
    };

    const addComponent = (record, type = "library") => {
      const ref = componentRefFor(record.name, record.version);
      if (!componentMap.has(ref)) {
        componentMap.set(ref, toComponent(record, type));
      }
      return ref;
    };

    const rootRecord = {
      name: analysis.root.fullName || analysis.root.name,
      version: analysis.root.version,
      scope: "root",
      osvStatus: analysis.root.osvStatus,
      registryUrl: analysis.root.registryUrl,
    };
    const rootRef = addComponent(rootRecord, "library");
    const dependencyRefs = [];
    (analysis.components || []).forEach((component) => {
      const ref = addComponent(component);
      if (ref !== rootRef) dependencyRefs.push(ref);
    });

    const dependencyEntries = (analysis.dependencyGraph || []).map((edge) => ({
      ref: componentRefFor(edge.name, edge.version),
      dependsOn: (edge.dependsOn || []).map((dep) =>
        componentRefFor(dep.name, dep.version),
      ),
    }));
    if (!dependencyEntries.some((entry) => entry.ref === rootRef)) {
      dependencyEntries.unshift({ ref: rootRef, dependsOn: dependencyRefs });
    }

    const vulnerabilityMap = new Map();
    const addVulnerabilities = (record) => {
      const affectedRef = componentRefFor(record.name, record.version);
      const vulnerabilities = Array.isArray(record.vulnerabilities)
        ? record.vulnerabilities
        : [];
      vulnerabilities.forEach((vuln) => {
        const id =
          vuln.id ||
          (Array.isArray(vuln.aliases) && vuln.aliases[0]) ||
          `${affectedRef}:vulnerability`;
        if (!vulnerabilityMap.has(id)) {
          const score = vulnerabilityScore(vuln);
          const vulnRecord = {
            "bom-ref": `vulnerability:${id}`,
            id,
            source: {
              name: "OSV",
              url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}`,
            },
            affects: [],
          };
          const ratings = vulnerabilityRatings(vuln, score);
          if (ratings.length > 0) vulnRecord.ratings = ratings;
          const cwes = vulnerabilityCwes(vuln);
          if (cwes.length > 0) vulnRecord.cwes = cwes;
          if (vuln.summary) vulnRecord.description = vuln.summary;
          if (vuln.details) vulnRecord.detail = vuln.details;
          if (vuln.published) vulnRecord.published = vuln.published;
          if (vuln.modified) vulnRecord.updated = vuln.modified;
          if (Array.isArray(vuln.references) && vuln.references.length > 0) {
            vulnRecord.advisories = vuln.references
              .filter((ref) => ref && ref.url)
              .map((ref) => ({
                title: ref.type || "reference",
                url: ref.url,
              }));
          }
          const aliases = Array.isArray(vuln.aliases) ? vuln.aliases : [];
          if (aliases.length > 0) {
            vulnRecord.properties = aliases.map((alias) => ({
              name: "osv:alias",
              value: alias,
            }));
          }
          vulnerabilityMap.set(id, vulnRecord);
        }
        const vulnRecord = vulnerabilityMap.get(id);
        if (!vulnRecord.affects.some((affect) => affect.ref === affectedRef)) {
          vulnRecord.affects.push({ ref: affectedRef });
        }
      });
    };

    addVulnerabilities({
      name: rootRecord.name,
      version: rootRecord.version,
      vulnerabilities: analysis.root.vulnerabilities,
    });
    (analysis.components || []).forEach(addVulnerabilities);

    return {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: `urn:uuid:${serial}`,
      version: 1,
      metadata: {
        timestamp: analysis.generatedAt,
        tools: {
          components: [
            {
              type: "application",
              name: "OSS Dependency Explorer",
            },
          ],
        },
        component: componentMap.get(rootRef),
      },
      components: Array.from(componentMap.entries())
        .filter(([ref]) => ref !== rootRef)
        .map(([, component]) => component),
      dependencies: dependencyEntries,
      vulnerabilities: Array.from(vulnerabilityMap.values()),
      properties: [
        {
          name: "oss-deps-explorer:direct-packages",
          value: String(analysis.totals.directPackages),
        },
        {
          name: "oss-deps-explorer:transitive-packages",
          value: String(analysis.totals.transitivePackages),
        },
      ],
    };
  };

  const exportSecurityAnalysis = (analysis, format) => {
    const baseName = safeFilenamePart(
      `${analysis.manager}-${analysis.root.name}-${analysis.root.version}`,
    );
    if (format === "json") {
      downloadText(
        `${baseName}-dependency-risk.json`,
        "application/json",
        JSON.stringify(analysis, null, 2),
      );
      return;
    }
    if (format === "cyclonedx") {
      downloadText(
        `${baseName}-cyclonedx.json`,
        "application/vnd.cyclonedx+json",
        JSON.stringify(buildCycloneDxBom(analysis), null, 2),
      );
      return;
    }
    if (format === "graphviz") {
      downloadText(
        `${baseName}-dependency-graph.dot`,
        "text/vnd.graphviz",
        buildGraphVizDot(analysis),
      );
      return;
    }
    const rows = [
      [
        "scope",
        "package",
        "version",
        "risk",
        "max_score",
        "osv_status",
        "osv_error",
        "advisories",
        "advisory_descriptions",
        "registry_url",
        "parent_count",
        "parents",
      ],
      ...analysis.findings.map((finding) => [
        finding.scope,
        finding.name,
        finding.version,
        finding.risk || "",
        finding.maxScore || "",
        finding.osvStatus?.status || "",
        finding.osvStatus?.error || "",
        finding.advisories.map((a) => a.id).join(";"),
        advisoryDescriptionGroups(finding.advisories)
          .map((group) => `${group.ids.join("/")}: ${group.description}`)
          .join(" | "),
        finding.registryUrl || "",
        finding.parents.length,
        finding.parents.join(";"),
      ]),
    ];
    downloadText(
      `${baseName}-vulnerabilities.csv`,
      "text/csv",
      rows.map((row) => row.map(csvValue).join(",")).join("\n"),
    );
  };

  const barColor = (score) => {
    if (score === 0 || score === -1) return "var(--neutral-dark-color)";
    if (score < 0) return "var(--neutral-color)";
    if (score <= 4) return "var(--error-color)";
    if (score <= 7) return "var(--warning-color)";
    return "var(--success-color)";
  };

  const graphNeutralLabelColor = () =>
    appearanceMode === "dark" ? "#c9d1d9" : "#334155";

  const graphSearchLabelColor = () =>
    appearanceMode === "dark" ? "#f87171" : "#b42318";

  const graphLabelHaloColor = () =>
    appearanceMode === "dark"
      ? "rgba(2, 6, 12, 0.76)"
      : "rgba(255, 255, 255, 0.96)";

  const graphLabelShadowColor = () =>
    appearanceMode === "dark" ? "#02060c" : "#475467";

  const graphLabelShadowOpacity = () =>
    appearanceMode === "dark" ? 0.42 : 0.14;

  const graphLabelStrokeWidth = (compact = false) =>
    compact ? 2.8 : appearanceMode === "dark" ? 3 : 3.6;

  const graphBaseLabelColor = (d) => {
    if (includeVuln && (d.risk || isUnresolvedOsvStatus(d.osvStatus))) {
      return resolveColor(getNodeColor(d));
    }
    return graphNeutralLabelColor();
  };

  React.useEffect(() => {
    if (!nodesRef.current || !labelsRef.current) return;
    const term = search.toLowerCase();
    nodesRef.current
      .attr("stroke", (d) =>
        term && d.id.toLowerCase().includes(term)
          ? "#f00"
          : d.root
            ? "#00e5ff"
            : "#fff",
      )
      .attr("stroke-width", (d) =>
        term && d.id.toLowerCase().includes(term) ? 3 : 1.5,
      );
    labelsRef.current
      .attr("fill", (d) =>
        term && d.id.toLowerCase().includes(term)
          ? graphSearchLabelColor()
          : graphBaseLabelColor(d),
      )
      .attr("stroke", graphLabelHaloColor())
      .style("display", (d) => {
        const matches = term && d.id.toLowerCase().includes(term);
        return matches || d.labelBaseVisible ? null : "none";
      });
  }, [search, appearanceMode, includeVuln]);

  React.useEffect(() => {
    if (!name || version) {
      setLatestVersions([]);
      setVersionsToShow(5);
      setVersionRisk({});
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      getLatestVersions().then((vers) => {
        if (!cancelled) setLatestVersions(vers);
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, namespace, manager, version]);

  React.useEffect(() => {
    setVersionsToShow(5);
  }, [latestVersions]);

  React.useEffect(() => {
    if (!name) {
      setNameSuggestions([]);
      setPackageTypeaheadActive(0);
      return;
    }
    let cancelled = false;
    setPackageTypeaheadActive(0);
    const timer = setTimeout(() => {
      fetchInternal(`${apiOrigin}/api/suggest/${manager}/${encodeURIComponent(name)}`)
        .then((resp) => (resp.ok ? resp.json() : []))
        .then((data) => {
          if (!cancelled) {
            const suggestions = data.map((d) => {
              if (typeof d === "string") {
                const parsed = parsePackageInput(manager, "", d);
                return {
                  value: packageDisplayName(parsed, manager),
                  label: packageDisplayName(parsed, manager),
                  namespace: parsed.namespace || "",
                  name: parsed.name,
                };
              }
              const value =
                d.namespace && manager === "maven"
                  ? `${d.namespace}:${d.name}`
                  : d.namespace && manager === "composer"
                    ? `${d.namespace}/${d.name}`
                    : d.namespace && manager === "npm"
                      ? `${d.namespace}/${d.name}`
                      : d.name;
              const label = d.namespace ? `${d.namespace}/${d.name}` : d.name;
              return {
                value,
                label: d.version ? `${label} (${d.version})` : label,
                namespace: d.namespace || "",
                name: d.name,
                version: d.version || "",
              };
            });
            setNameSuggestions(suggestions);
          }
        })
        .catch((err) =>
          addConsoleLines(
            `! Suggest failed: ${err && err.message ? err.message : err}`,
          ),
        );
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, manager]);

  React.useEffect(() => {
    const errHandler = (e) => {
      let msg =
        e.message || (e.reason && e.reason.message) || String(e.reason || e);
      addAlert(msg);
    };
    window.addEventListener("error", errHandler);
    window.addEventListener("unhandledrejection", errHandler);
    return () => {
      window.removeEventListener("error", errHandler);
      window.removeEventListener("unhandledrejection", errHandler);
    };
  }, []);

  React.useEffect(() => {
    const origError = console.error;
    console.error = (...args) => {
      origError.apply(console, args);
      const msg = args.map((a) => (a && a.message) || a).join(" ");
      addAlert(String(msg));
    };
    return () => {
      console.error = origError;
    };
  }, []);

  React.useEffect(() => {
    fetchInternal(`${apiOrigin}/api/config`)
      .then((resp) => (resp.ok ? resp.json() : {}))
      .then((data) => setPmURLs(data))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const key = formatPackage(
      submittedManager,
      submittedNamespace,
      submittedName,
    );
    const repo = repos[key];
    if (repo && !repoMeta[repo]) {
      fetchInternal(`${apiOrigin}/api/repo/${repo}`)
        .then((resp) => (resp.ok ? resp.json() : {}))
        .then((data) => {
          setRepoMeta((prev) => ({ ...prev, [repo]: data }));
        })
        .catch(() => {});
    }
  }, [repos, submittedManager, submittedNamespace, submittedName]);

  React.useEffect(() => {
    if (alerts.length > 0) {
      setBellBounce(true);
      const t = setTimeout(() => setBellBounce(false), 1000);
      return () => clearTimeout(t);
    }
  }, [alerts]);


  React.useEffect(() => {
    if (loading && statusMessages.length > 1) {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = setInterval(() => {
        setStatusIdx((idx) => {
          const next = (idx + 1) % statusMessages.length;
          setStatus(statusMessages[next]);
          setStatusKey((k) => k + 1);
          return next;
        });
      }, 2000);
    } else {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    }
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [loading, statusMessages]);

  React.useEffect(() => {
    if (!showPackageResults) return;
    const graphEl = document.getElementById("graph");
    if (!graphEl) return;

    let resizeTimer = null;
    const updateGraphSize = () => {
      const width = Math.round(graphEl.clientWidth);
      const height = Math.round(graphEl.clientHeight);
      if (!width || !height) return;

      const last = graphSizeRef.current;
      if (
        Math.abs(width - last.width) < 2 &&
        Math.abs(height - last.height) < 2
      ) {
        return;
      }

      graphSizeRef.current = { width, height };
      centeredRef.current = false;
      setGraphResizeKey((key) => key + 1);
    };
    const scheduleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateGraphSize, 150);
    };

    updateGraphSize();

    let observer = null;
    if ("ResizeObserver" in window) {
      observer = new ResizeObserver(scheduleResize);
      observer.observe(graphEl);
    } else {
      window.addEventListener("resize", scheduleResize);
    }

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", scheduleResize);
      }
    };
  }, [showPackageResults]);

  React.useEffect(() => {
    if (!showPackageResults) return;
    const graphDeps = mergePackageChainDeps(deps, packageChainDeps);
    const direct = {};
    graphDeps.forEach((d) => {
      if (!d.transitive) direct[d.name] = d.version;
    });
    const rootRisk = rootScore !== null ? riskFromScore(rootScore) : null;
    const rootKey = formatPackage(
      submittedManager,
      submittedNamespace,
      submittedName,
    );
    const rootOsvStatus = vulnerabilityStatus[rootKey] || null;
    buildGraph(graphDeps, rootKey || submittedName, submittedVersion, direct, rootRisk, rootOsvStatus);
  }, [
    showPackageResults,
    deps,
    packageChainDeps,
    packageChainLoading,
    submittedName,
    submittedVersion,
    submittedNamespace,
    submittedManager,
    rootScore,
    includeVuln,
    appearanceMode,
    vulnerabilityStatus,
    graphResizeKey,
  ]);

  React.useEffect(
    () => () => {
      if (shareStatusTimerRef.current) {
        clearTimeout(shareStatusTimerRef.current);
      }
      if (githubRepoShareStatusTimerRef.current) {
        clearTimeout(githubRepoShareStatusTimerRef.current);
      }
      if (githubRepoBriefStatusTimerRef.current) {
        clearTimeout(githubRepoBriefStatusTimerRef.current);
      }
      if (packageSuggestionSuppressTimerRef.current) {
        clearTimeout(packageSuggestionSuppressTimerRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!showMcpInfo) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowMcpInfo(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showMcpInfo]);

  const updatePackageDeepLink = React.useCallback((details) => {
    if (!details || !details.name) return "";
    const url = buildPackageDeepLink(details);
    window.history.replaceState({ package: details }, "", url);
    return url;
  }, []);

  const updateCveDeepLink = React.useCallback((id) => {
    const normalized = extractAdvisoryId(id);
    if (!normalized) return "";
    const url = buildCveDeepLink(normalized);
    window.history.replaceState({ cve: normalized }, "", url);
    return url;
  }, []);

  const updateGithubRepoDeepLink = React.useCallback((repo) => {
    const normalized = String(repo || "").trim();
    if (!normalized) return "";
    const url = buildGithubRepoDeepLink(normalized);
    window.history.replaceState({ repository: normalized }, "", url);
    return url;
  }, []);

  const copyTextToClipboard = async (text) => {
    const copyWithSelection = (value) => {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.top = "-1000px";
      input.style.left = "-1000px";
      document.body.appendChild(input);
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      const copied = document.execCommand("copy");
      input.remove();
      return copied;
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("clipboard timeout")), 500),
          ),
        ]);
        return true;
      }
    } catch (_) {
      // Fall back to a selection-based copy path below.
    }

    try {
      return copyWithSelection(text);
    } catch (_) {
      return false;
    }
  };

  const parsePackageInput = (mgr, nsVal, nameVal) => {
    if (nsVal) return { namespace: nsVal, name: nameVal };
    if (mgr === "maven" && nameVal.includes(":")) {
      const [resolvedNs, resolvedName] = nameVal.split(":", 2);
      return { namespace: resolvedNs, name: resolvedName };
    }
    if ((mgr === "composer" || mgr === "npm") && nameVal.includes("/")) {
      const idx = nameVal.indexOf("/");
      return { namespace: nameVal.slice(0, idx), name: nameVal.slice(idx + 1) };
    }
    return { namespace: nsVal, name: nameVal };
  };

  const packageDisplayName = (pkg, mgr = manager) => {
    if (pkg.value) return pkg.value;
    if (!pkg.namespace) return pkg.name;
    if (mgr === "maven") return `${pkg.namespace}:${pkg.name}`;
    return `${pkg.namespace}/${pkg.name}`;
  };

  const githubPackageLabel = (pkg) =>
    pkg.display || packageDisplayName(pkg, pkg.manager);

  const githubPackageLicense = (pkg) =>
    String(pkg?.license || pkg?.license_concluded || pkg?.license_declared || "")
      .trim();

  const githubPackageLicensePolicy = (pkg) =>
    githubLicensePolicyFromExpression(githubPackageLicense(pkg));

  const githubPackageLicenseTitle = (pkg) => {
    const concluded = String(pkg?.license_concluded || "").trim();
    const declared = String(pkg?.license_declared || "").trim();
    if (concluded && declared && concluded !== declared) {
      return `Concluded: ${concluded}; declared: ${declared}`;
    }
    if (concluded) return `Concluded license: ${concluded}`;
    if (declared) return `Declared license: ${declared}`;
    return "No SPDX license returned by GitHub dependency graph";
  };

  const githubRepoPackageKey = (pkg) =>
    [
      pkg?.purl,
      pkg?.spdx_id,
      pkg?.manager,
      pkg?.namespace,
      pkg?.name,
      pkg?.version,
    ]
      .filter(Boolean)
      .join("|");

  const normalizeGithubRepoVersion = (value) =>
    String(value || "")
      .trim()
      .replace(/^v(?=\d)/i, "");

  const githubRepoPackageIdentityKey = (pkg) =>
    [
      pkg?.manager,
      pkg?.namespace || "",
      pkg?.name,
      normalizeGithubRepoVersion(pkg?.version),
    ]
      .filter((part) => part !== undefined && part !== null)
      .join("|");

  const githubPackageSearchText = (pkg) => {
    const policy = githubPackageLicensePolicy(pkg);
    return [
      githubPackageLabel(pkg),
      pkg.version,
      pkg.manager,
      pmDisplayNames[pkg.manager],
      githubPackageLicense(pkg),
      policy.label,
      policy.status,
      policy.detail,
      pkg.license_concluded,
      pkg.license_declared,
      pkg.purl,
      pkg.spdx_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const githubUnsupportedPackageLabel = (pkg) =>
    pkg?.display ||
    pkg?.name ||
    pkg?.purl ||
    pkg?.spdx_id ||
    "Unsupported dependency";

  const githubUnsupportedPackageSearchText = (pkg) => {
    const policy = githubPackageLicensePolicy(pkg);
    return [
      githubUnsupportedPackageLabel(pkg),
      pkg?.version,
      githubPackageLicense(pkg),
      policy.label,
      policy.status,
      policy.detail,
      pkg?.license_concluded,
      pkg?.license_declared,
      pkg?.purl,
      pkg?.spdx_id,
      ...(pkg?.external_refs || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const applyPackageSuggestion = (pkg) => {
    if (Date.now() < packageSuggestionSuppressUntilRef.current) return;
    const parsed = parsePackageInput(
      manager,
      pkg.namespace || "",
      pkg.name || pkg.value || "",
    );
    setPackageSuggestionsSuppressed(false);
    setNamespace(parsed.namespace || "");
    setName(parsed.name || "");
    setVersion("");
    setLatestVersions([]);
    setVersionRisk({});
    setVersionsToShow(5);
    setPackageTypeaheadOpen(false);
    setPackageTypeaheadActive(0);
  };

  const getVersionInfo = async (
    mgrOverride = null,
    nsOverride = null,
    nameOverride = null,
    syncFields = false,
  ) => {
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    const rawNs = nsOverride !== null ? nsOverride : namespace;
    const rawName = nameOverride !== null ? nameOverride : name;
    const parsed = parsePackageInput(mgrVal, rawNs, rawName);
    if (!parsed.name) return null;
    const params = new URLSearchParams({
      manager: mgrVal,
      name: parsed.name,
    });
    if (parsed.namespace) params.set("namespace", parsed.namespace);
    const nsVal = nsOverride !== null ? nsOverride : namespace;
    try {
      const resp = await fetchInternal(`${apiOrigin}/api/versions?${params}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (syncFields) {
        if (data.namespace !== undefined && data.namespace !== nsVal) {
          setNamespace(data.namespace || "");
        }
        if (data.name && data.name !== rawName) {
          setName(data.name);
        }
      }
      return data;
    } catch (err) {
      addConsoleLines(
        `! Version lookup failed: ${err && err.message ? err.message : err}`,
      );
      return null;
    }
  };

  const getLatestVersion = async (
    nsOverride = null,
    nameOverride = null,
    mgrOverride = null,
  ) => {
    const info = await getVersionInfo(mgrOverride, nsOverride, nameOverride, true);
    return (info && (info.latest || (info.versions && info.versions[0]))) || "";
  };

  const getLatestVersions = async (
    mgrOverride = null,
    nsOverride = null,
    nameOverride = null,
  ) => {
    const info = await getVersionInfo(mgrOverride, nsOverride, nameOverride, true);
    return (info && Array.isArray(info.versions) && info.versions) || [];
  };

  const queryOsvVulns = async (mgr, pkg, ver) => {
    const ecoMap = {
      npm: "npm",
      pypi: "PyPI",
      go: "Go",
      maven: "Maven",
      cargo: "crates.io",
      rubygems: "RubyGems",
      nuget: "NuGet",
      composer: "Packagist",
    };
    const ecosystem = ecoMap[mgr];
    if (!ecosystem) {
      return {
        vulns: [],
        status: {
          status: "not_checked",
          checked: false,
          advisory_count: 0,
          error: "unsupported OSV ecosystem",
        },
      };
    }
    if (!String(ver || "").trim()) {
      return {
        vulns: [],
        status: {
          status: "not_checked",
          checked: false,
          advisory_count: 0,
          error: "no resolved version",
        },
      };
    }
    try {
      const resp = await fetch("https://api.osv.dev/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package: { name: pkg, ecosystem },
          version: ver,
        }),
      });
      if (!resp.ok) {
        return {
          vulns: [],
          status: {
            status: "unknown",
            checked: false,
            advisory_count: 0,
            error: `osv.dev returned status ${resp.status}`,
          },
        };
      }
      const data = await resp.json();
      const vulns = Array.isArray(data.vulns) ? data.vulns : [];
      return {
        vulns,
        status: {
          status: vulns.length > 0 ? "vulnerable" : "no_advisory",
          checked: true,
          advisory_count: vulns.length,
        },
      };
    } catch (err) {
      addConsoleLines(
        `! OSV query failed: ${err && err.message ? err.message : err}`,
      );
      return {
        vulns: [],
        status: {
          status: "unknown",
          checked: false,
          advisory_count: 0,
          error: err && err.message ? err.message : "OSV query failed",
        },
      };
    }
  };

  const fetchOsvVulns = async (mgr, pkg, ver) => {
    const result = await queryOsvVulns(mgr, pkg, ver);
    return result.vulns;
  };

  const managerForOsvEcosystem = (ecosystem) => {
    const raw = String(ecosystem || "");
    return ecosystemToManager[raw] || ecosystemToManager[raw.toLowerCase()] || "";
  };

  const affectedPackageDetails = (affected) => {
    const pkg = affected && affected.package ? affected.package : {};
    const managerForPackage = managerForOsvEcosystem(pkg.ecosystem);
    if (!managerForPackage || !pkg.name) return null;
    const parsed = splitDeepLinkName(managerForPackage, "", pkg.name);
    return {
      manager: managerForPackage,
      managerLabel: pmDisplayNames[managerForPackage] || pkg.ecosystem,
      ecosystem: pkg.ecosystem || "",
      packageName: pkg.name,
      namespace: parsed.namespace || "",
      name: parsed.name || pkg.name,
      purl: pkg.purl || "",
    };
  };

  const affectedFixedVersions = (affected) => {
    const versions = [];
    (affected?.ranges || []).forEach((range) => {
      (range.events || []).forEach((event) => {
        if (event.fixed && !versions.includes(event.fixed)) {
          versions.push(event.fixed);
        }
      });
    });
    return versions;
  };

  const preferredAffectedVersion = (affected) => {
    const fixed = affectedFixedVersions(affected);
    if (fixed.length > 0) return fixed[0];
    const listed = Array.isArray(affected?.versions) ? affected.versions : [];
    return listed.length > 0 ? listed[listed.length - 1] : "";
  };

  const affectedVersionSummaries = (affected) => {
    if (Array.isArray(affected?.database_specific?.version_ranges)) {
      return affected.database_specific.version_ranges.filter(Boolean).slice(0, 4);
    }
    const fixed = affectedFixedVersions(affected);
    if (fixed.length > 0) return fixed.slice(0, 4).map((ver) => `Fixed in ${ver}`);
    const listed = Array.isArray(affected?.versions) ? affected.versions : [];
    if (listed.length === 0) return ["No fixed version listed"];
    return listed.slice(0, 4).map((ver) => `${ver} affected`);
  };

  const cleanAffectedVersionToken = (value) =>
    String(value || "")
      .trim()
      .replace(/^[<>=~^\s]+/, "")
      .replace(/[),.;:]+$/, "");

  const versionFromAffectedSummary = (summary) => {
    const text = String(summary || "").trim();
    if (!text || /no fixed version listed/i.test(text)) return "";
    const fixed = text.match(/^Fixed in\s+(.+)$/i);
    if (fixed) return cleanAffectedVersionToken(fixed[1]);
    const upperBound = text.match(/(?:<=|<)\s*([^\s,;]+)/);
    if (upperBound) return cleanAffectedVersionToken(upperBound[1]);
    const affected = text.match(/^(.+?)\s+affected$/i);
    if (affected) return cleanAffectedVersionToken(affected[1]);
    return "";
  };

  const remediationRecordDetails = (affected, idx) => {
    const details = affectedPackageDetails(affected);
    const display = affectedDisplayDetails(affected);
    const fixedVersions = affectedFixedVersions(affected);
    const versionSummaries = affectedVersionSummaries(affected);
    const versionForLink = preferredAffectedVersion(affected);
    const packageName = display.packageName || "Affected product";
    const localLink = details
      ? buildPackageDeepLink({
          manager: details.manager,
          namespace: details.namespace,
          name: details.name,
          version: versionForLink,
        })
      : "";
    return {
      key: `${packageName}-${display.managerLabel || display.ecosystem || "source"}-${idx}`,
      affected,
      details,
      display,
      fixedVersions,
      versionSummaries,
      versionForLink,
      packageName,
      localLink,
      hasFix: fixedVersions.length > 0,
    };
  };

  const affectedHasSupportedPackage = (affected) =>
    Boolean(affectedPackageDetails(affected));

  const affectedDisplayDetails = (affected) => {
    const supported = affectedPackageDetails(affected);
    if (supported) {
      return {
        ...supported,
        repo: "",
        collectionURL: "",
        modules: [],
        programFiles: [],
      };
    }
    const pkg = affected?.package || {};
    const meta = affected?.database_specific || {};
    const label = meta.vendor || pkg.ecosystem || "NVD";
    return {
      manager: "",
      managerLabel: label,
      ecosystem: pkg.ecosystem || label,
      packageName: pkg.name || meta.product || "Affected product",
      namespace: "",
      name: pkg.name || meta.product || "",
      purl: pkg.purl || "",
      product: meta.product || "",
      repo: meta.repo || "",
      collectionURL: meta.collectionURL || "",
      modules: Array.isArray(meta.modules) ? meta.modules : [],
      programFiles: Array.isArray(meta.programFiles) ? meta.programFiles : [],
    };
  };

  const nvdCvssMetrics = (metrics = {}) => {
    const groups = [
      ["cvssMetricV40", "CVSS 4.0"],
      ["cvssMetricV31", "CVSS 3.1"],
      ["cvssMetricV30", "CVSS 3.0"],
      ["cvssMetricV2", "CVSS 2.0"],
    ];
    const entries = [];
    groups.forEach(([key, label]) => {
      (metrics[key] || []).forEach((metric) => {
        const data = metric.cvssData || {};
        const score = Number(data.baseScore);
        entries.push({
          type: label,
          score: Number.isFinite(score) ? score : data.baseScore || "",
          severity: data.baseSeverity || metric.baseSeverity || "",
          vector: data.vectorString || "",
          source: metric.source || "",
          role: metric.type || "",
          exploitabilityScore: metric.exploitabilityScore,
          impactScore: metric.impactScore,
        });
      });
    });
    return entries.sort(
      (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0),
    );
  };

  const englishNvdDescription = (cve) => {
    const descriptions = Array.isArray(cve?.descriptions) ? cve.descriptions : [];
    return (
      descriptions.find((desc) => desc.lang === "en")?.value ||
      descriptions[0]?.value ||
      ""
    );
  };

  const nvdWeaknesses = (cve) =>
    Array.from(
      new Set(
        (cve?.weaknesses || [])
          .flatMap((weakness) => weakness.description || [])
          .map((desc) => desc.value)
          .filter(
            (value) =>
              value &&
              !/^NVD-CWE-(?:noinfo|Other)$/i.test(String(value).trim()),
          ),
      ),
    );

  const nvdVersionRangeLabel = (version = {}) => {
    const start = version.version || version.versionStartIncluding || "unknown";
    const end =
      version.lessThan ||
      version.lessThanOrEqual ||
      version.versionEndExcluding ||
      version.versionEndIncluding ||
      "";
    if (end) {
      const op =
        version.lessThan || version.versionEndExcluding ? "<" : "<=";
      return `${start} ${op} ${end}`;
    }
    return `${start} ${version.status || "affected"}`;
  };

  const nvdAffectedRecords = (cve) => {
    const records = [];
    (cve?.affected || []).forEach((sourceGroup) => {
      (sourceGroup.affectedData || []).forEach((item) => {
        const versions = Array.isArray(item.versions) ? item.versions : [];
        const versionLabels = versions.map(nvdVersionRangeLabel);
        const packageName = item.packageName || item.product || item.vendor;
        records.push({
          package: {
            ecosystem: "NVD",
            name: packageName || "Affected product",
          },
          versions: versionLabels,
          ranges: versions.length
            ? [
                {
                  type: item.versionType || "range",
                  events: versions.flatMap((version) => {
                    const events = [];
                    if (version.version) events.push({ introduced: version.version });
                    if (version.lessThan) events.push({ fixed: version.lessThan });
                    if (version.lessThanOrEqual) {
                      events.push({ last_affected: version.lessThanOrEqual });
                    }
                    return events;
                  }),
                },
              ]
            : [],
          database_specific: {
            source: sourceGroup.source || "",
            vendor: item.vendor || "",
            product: item.product || "",
            defaultStatus: item.defaultStatus || "",
            collectionURL: item.collectionURL || "",
            repo: item.repo || "",
            modules: item.modules || [],
            programFiles: item.programFiles || [],
            version_ranges: versionLabels,
          },
        });
      });
    });

    (cve?.configurations || []).forEach((configuration) => {
      (configuration.nodes || []).forEach((node) => {
        (node.cpeMatch || [])
          .filter((match) => match.vulnerable)
          .forEach((match) => {
            const parts = String(match.criteria || "").split(":");
            const vendor = parts[3] || "";
            const product = parts[4] || "";
            const version = parts[5] || "";
            const range = [
              match.versionStartIncluding && `>= ${match.versionStartIncluding}`,
              match.versionStartExcluding && `> ${match.versionStartExcluding}`,
              match.versionEndIncluding && `<= ${match.versionEndIncluding}`,
              match.versionEndExcluding && `< ${match.versionEndExcluding}`,
            ].filter(Boolean);
            records.push({
              package: {
                ecosystem: "CPE",
                name: product || vendor || "Affected product",
              },
              versions: range.length ? range : version && version !== "*" ? [version] : [],
              database_specific: {
                source: "NVD CPE",
                vendor,
                product,
                version_ranges:
                  range.length ? [range.join(" ")] : version && version !== "*" ? [version] : [],
              },
            });
          });
      });
    });

    return records;
  };

  const nvdReferences = (cve) =>
    (cve?.references || [])
      .filter((ref) => ref && ref.url)
      .map((ref) => ({
        url: ref.url,
        type: Array.isArray(ref.tags) && ref.tags.length ? ref.tags[0] : "REFERENCE",
        source: ref.source || "",
      }));

  const transformNvdCve = (item, lookupNote = "") => {
    const cve = item?.cve || item || {};
    const metrics = nvdCvssMetrics(cve.metrics);
    const primaryMetric = metrics[0] || {};
    const weaknesses = nvdWeaknesses(cve);
    return {
      id: cve.id,
      summary: cve.id,
      details: englishNvdDescription(cve),
      aliases: [],
      affected: nvdAffectedRecords(cve),
      references: nvdReferences(cve),
      published: cve.published || "",
      modified: cve.lastModified || "",
      severity: metrics,
      database_specific: {
        source: "NVD",
        severity: primaryMetric.severity || "",
        status: cve.vulnStatus || "",
        sourceIdentifier: cve.sourceIdentifier || "",
        lookup_note: lookupNote,
      },
      weaknesses,
    };
  };

  const fetchNvdCve = async (id, lookupNote = "") => {
    if (!/^CVE-\d{4}-\d{4,}$/i.test(id)) return null;
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(id)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let resp;
    try {
      resp = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error("NVD lookup timed out. Try again or open the NVD link.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(text.trim() || `NVD lookup failed: ${resp.status}`);
    }
    const data = JSON.parse(text);
    const item = Array.isArray(data.vulnerabilities)
      ? data.vulnerabilities[0]
      : null;
    if (!item) return null;
    return transformNvdCve(item, lookupNote);
  };

  const mergeNvdIntoAdvisory = (advisory, nvdAdvisory) => {
    if (!nvdAdvisory) return advisory;
    const affected = Array.isArray(advisory?.affected) ? advisory.affected : [];
    const nvdAffected = Array.isArray(nvdAdvisory.affected)
      ? nvdAdvisory.affected
      : [];
    const severity = Array.isArray(advisory?.severity) ? advisory.severity : [];
    const references = Array.isArray(advisory?.references)
      ? advisory.references
      : [];
    return {
      ...advisory,
      details: advisory.details || nvdAdvisory.details,
      references: references.length ? references : nvdAdvisory.references,
      affected: affected.length ? affected : nvdAffected,
      severity: severity.length ? severity : nvdAdvisory.severity,
      database_specific: {
        ...(advisory.database_specific || {}),
        nvd_status: nvdAdvisory.database_specific?.status || "",
        nvd_source: nvdAdvisory.database_specific?.sourceIdentifier || "",
      },
      weaknesses: advisory.weaknesses || nvdAdvisory.weaknesses,
    };
  };

  const mergeAliasAffectedPackages = async (advisory) => {
    const affected = Array.isArray(advisory?.affected) ? advisory.affected : [];
    if (affected.some(affectedHasSupportedPackage)) return advisory;
    const aliases = Array.isArray(advisory?.aliases) ? advisory.aliases : [];
    const aliasCandidates = aliases
      .filter((alias) => alias && !/^CVE-/i.test(alias))
      .slice(0, 5);
    for (const alias of aliasCandidates) {
      try {
        const resp = await fetch(
          `https://api.osv.dev/v1/vulns/${encodeURIComponent(alias)}`,
        );
        if (!resp.ok) continue;
        const aliasData = await resp.json();
        const aliasAffected = Array.isArray(aliasData.affected)
          ? aliasData.affected
          : [];
        if (!aliasAffected.some(affectedHasSupportedPackage)) continue;
        return {
          ...advisory,
          affected: aliasAffected,
          aliases: Array.from(
            new Set([...(advisory.aliases || []), aliasData.id].filter(Boolean)),
          ),
        };
      } catch (err) {
        addConsoleLines(
          `! Alias lookup failed for ${alias}: ${
            err && err.message ? err.message : err
          }`,
        );
      }
    }
    return advisory;
  };

  const currentCveDeepLink = () =>
    buildCveDeepLink((cveResult && cveResult.id) || cveQuery);

  const copyCveDeepLink = async (event) => {
    event?.preventDefault?.();
    const url = currentCveDeepLink();
    setShareStatus("Copying...");
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
    const copied = await copyTextToClipboard(url);
    setShareStatus(copied ? "Copied" : "Link ready");
    shareStatusTimerRef.current = setTimeout(() => setShareStatus(""), 1800);
  };

  const currentGithubRepoDeepLink = () =>
    buildGithubRepoDeepLink(githubRepoResult?.repository || githubRepoUrl);

  const copyGithubRepoDeepLink = async (event) => {
    event?.preventDefault?.();
    const repo = githubRepoResult?.repository || githubRepoUrl;
    if (!repo) return;
    const url = currentGithubRepoDeepLink();
    setGithubRepoShareStatus("Copying...");
    if (githubRepoShareStatusTimerRef.current) {
      clearTimeout(githubRepoShareStatusTimerRef.current);
    }
    const copied = await copyTextToClipboard(url);
    setGithubRepoShareStatus(copied ? "Copied" : "Link ready");
    githubRepoShareStatusTimerRef.current = setTimeout(
      () => setGithubRepoShareStatus(""),
      1800,
    );
  };

  const analyzeAffectedPackage = (affected, forcedVersion = "") => {
    const details = affectedPackageDetails(affected);
    if (!details) return;
    const versionForLookup = forcedVersion || preferredAffectedVersion(affected);
    suppressPackageSuggestionsBriefly();
    setSearchMode("package");
    setManager(details.manager);
    setNamespace(details.namespace);
    setName(details.name);
    setVersion(versionForLookup);
    setLatestVersions([]);
    setVersionRisk({});
    setVersionsToShow(5);
    setNameSuggestions([]);
    setPackageTypeaheadOpen(false);
    setCveResult(null);
    setCveError("");
    setCveSubmitted(false);
    fetchDeps(
      null,
      versionForLookup || null,
      details.namespace,
      details.name,
      details.manager,
    );
  };

  const clearPackageResultState = () => {
    setDeps([]);
    setExpanded({});
    setCollapsed({});
    setDependencyListFilter("all");
    setSearch("");
    setCacheStatus("");
    setScorecards({});
    setRootScore(null);
    setRootCves([]);
    setRootVulnerabilities([]);
    setVulnerabilityStatus({});
    setRepos({});
    setFormSubmitted(false);
  };

  const fetchCve = async (evt, forcedId = null, options = {}) => {
    if (evt && evt.preventDefault) evt.preventDefault();
    const id = extractAdvisoryId(forcedId !== null ? forcedId : cveQuery);
    if (!id) return;
    if (abortRef.current.controller) abortRef.current.controller.abort();
    if (abortRef.current.timer) clearTimeout(abortRef.current.timer);
    abortRef.current = { controller: null, timer: null };
    setSearchMode("cve");
    setCveQuery(id);
    setCveSubmitted(true);
    setCveLoading(true);
    setCveError("");
    setCveResult(null);
    setLoading(false);
    setStatusMessages([]);
    setStatus("");
    setConsoleLines([]);
    setShowConsole(false);
    clearPackageResultState();
    try {
      const resp = await fetch(
        `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`,
      );
      const text = await resp.text();
      if (!resp.ok) {
        if (resp.status === 404 && /^CVE-/i.test(id)) {
          const nvdData = await fetchNvdCve(
            id,
            "OSV does not have this advisory yet, so this view is populated from NVD.",
          );
          if (nvdData) {
            setCveResult(nvdData);
            if (options.updateUrl !== false) updateCveDeepLink(nvdData.id || id);
            return;
          }
          throw new Error(`${id} was not found in OSV or NVD.`);
        }
        if (/^CVE-/i.test(id)) {
          const nvdData = await fetchNvdCve(
            id,
            `OSV returned status ${resp.status}, so this view is populated from NVD.`,
          );
          if (nvdData) {
            setCveResult(nvdData);
            if (options.updateUrl !== false) updateCveDeepLink(nvdData.id || id);
            return;
          }
        }
        throw new Error(text.trim() || `OSV lookup failed: ${resp.status}`);
      }
      let data = await mergeAliasAffectedPackages(JSON.parse(text));
      const affected = Array.isArray(data?.affected) ? data.affected : [];
      if (/^CVE-/i.test(id) && !affected.some(affectedHasSupportedPackage)) {
        try {
          const nvdData = await fetchNvdCve(id);
          data = mergeNvdIntoAdvisory(data, nvdData);
        } catch (nvdErr) {
          addConsoleLines(
            `! NVD enrichment failed: ${
              nvdErr && nvdErr.message ? nvdErr.message : nvdErr
            }`,
          );
        }
      }
      setCveResult(data);
      if (options.updateUrl !== false) {
        updateCveDeepLink(data.id || id);
      }
    } catch (err) {
      const message =
        err && err.message ? err.message : "Unable to look up that advisory.";
      setCveError(message);
      addAlert(message);
    } finally {
      setCveLoading(false);
    }
  };

  const handlePrimarySubmit = (evt) => {
    if (searchMode === "cve") {
      fetchCve(evt);
      return;
    }
    if (searchMode === "repository") {
      importGithubRepoDependencies(evt);
      return;
    }
    fetchDeps(evt);
  };

  const mapLimit = async (items, limit, mapper) => {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(limit, items.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
      }),
    );
    return results;
  };

  const versionRiskKey = (mgr, pkg, ver) => `${mgr}\u0000${pkg}\u0000${ver}`;

  const summarizeVersionRisk = (vulns) => {
    const summary = summarizeVulnerabilities(vulns);
    const advisoryIdsForVersion = summary.advisories
      .map((advisory) => advisory.id)
      .filter(Boolean);
    const cveIds = advisoryIdsForVersion
      .filter((id) => /^CVE-/i.test(id))
      .slice(0, 3);
    return {
      status: vulns.length > 0 ? "vulnerable" : "no_advisory",
      score: summary.maxScore,
      risk: summary.risk,
      advisoryCount: vulns.length,
      advisoryIds: advisoryIdsForVersion.slice(0, 5),
      cveIds,
    };
  };

  React.useEffect(() => {
    if (!showVersionSuggestions || !name || version) {
      setVersionRisk({});
      return;
    }
    const parsed = parsePackageInput(manager, namespace, name);
    if (!parsed.name) {
      setVersionRisk({});
      return;
    }
    const packageName = formatPackage(manager, parsed.namespace, parsed.name);
    const versionSuggestionLimit = Math.min(
      latestVersions.length,
      MAX_SUGGESTED_VERSIONS,
    );
    const visibleVersions = latestVersions
      .slice(0, Math.min(versionsToShow, versionSuggestionLimit))
      .filter(Boolean);
    if (visibleVersions.length === 0) {
      setVersionRisk({});
      return;
    }

    let cancelled = false;
    const missing = [];
    const nextRisk = {};
    visibleVersions.forEach((suggestedVersion) => {
      const key = versionRiskKey(manager, packageName, suggestedVersion);
      const cached = versionRiskCacheRef.current.get(key);
      if (cached) {
        nextRisk[suggestedVersion] = cached;
      } else {
        nextRisk[suggestedVersion] = { status: "checking" };
        missing.push({ key, version: suggestedVersion });
      }
    });
    setVersionRisk(nextRisk);

    if (missing.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      missing.map(async (item) => {
        const vulns = await fetchOsvVulns(manager, packageName, item.version);
        const record = summarizeVersionRisk(vulns);
        versionRiskCacheRef.current.set(item.key, record);
        return [item.version, record];
      }),
    ).then(() => {
      if (cancelled) return;
      setVersionRisk((current) => {
        const refreshed = {};
        visibleVersions.forEach((suggestedVersion) => {
          const key = versionRiskKey(manager, packageName, suggestedVersion);
          refreshed[suggestedVersion] =
            versionRiskCacheRef.current.get(key) ||
            current[suggestedVersion] ||
            { status: "checking" };
        });
        return refreshed;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    showVersionSuggestions,
    manager,
    namespace,
    name,
    version,
    latestVersions,
    versionsToShow,
  ]);

  const fetchDeps = async (
    evt,
    forcedVer = null,
    nsOverride = null,
    nameOverride = null,
    mgrOverride = null,
    clearInputs = false,
    options = {},
  ) => {
    if (evt && evt.preventDefault) evt.preventDefault();
    let nsVal = nsOverride !== null ? nsOverride : namespace;
    let nameVal = nameOverride !== null ? nameOverride : name;
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    if (evt) {
      setHistory((h) => [...h, { manager, namespace, name, version }]);
    }
    if (!nameVal) return;
    setSearchMode("package");
    setCveLoading(false);
    setCveResult(null);
    setCveError("");
    setCveSubmitted(false);
    centeredRef.current = false;
    if (packageChainAbortRef.current) {
      packageChainAbortRef.current.abort();
      packageChainAbortRef.current = null;
    }
    setPackageChainDeps({});
    setPackageChainLoading(false);
    setPackageChainActiveKey("");
    setPackageChainProgress("");
    setPackageChainError("");
    packageGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    packageGraphFitSignatureRef.current = "";
    setFormSubmitted(true);
    setLoading(true);
    setStatus("Determining version...");
    setConsoleLines([]);
    setShowConsole(false);
    setVulnerabilityStatus({});

    setCacheStatus("");


    let ver = forcedVer !== null ? forcedVer : version;
    const versionFailureMessage = `Could not resolve a version for ${formatPackage(
      mgrVal,
      nsVal,
      nameVal,
    )}. Enter a version or try again when the package registry is reachable.`;
    if (!ver) {
      const info = await getVersionInfo(mgrVal, nsVal, nameVal, true);
      if (info) {
        nsVal = info.namespace || "";
        nameVal = info.name || nameVal;
        ver = info.latest || (Array.isArray(info.versions) && info.versions[0]) || "";
      }
      if (!ver) {
        addAlert(versionFailureMessage);
        addConsoleLines(`! ${versionFailureMessage}`);
        setFormSubmitted(false);
        setStatus("");
        setLoading(false);
        return;
      }
      setVersion(ver);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      addAlert("Request timed out. Some dependencies may be missing.");
 
      controller.abort();
    }, 60000);
    abortRef.current = { controller, timer };

    try {
      let ver = forcedVer !== null ? forcedVer : version;
      if (!ver) {
        const info = await getVersionInfo(mgrVal, nsVal, nameVal, true);
        if (info) {
          nsVal = info.namespace || "";
          nameVal = info.name || nameVal;
          ver = info.latest || (Array.isArray(info.versions) && info.versions[0]) || "";
        }
        if (!ver) {
          addAlert(versionFailureMessage);
          addConsoleLines(`! ${versionFailureMessage}`);
          setFormSubmitted(false);
          return;
        }
        setVersion(ver);
      }

      const rootName = nameVal;
      let rootVersion = ver;
      setSubmittedName(rootName);
      setSubmittedVersion(rootVersion);
      setSubmittedNamespace(nsVal);
      setSubmittedManager(mgrVal);

      const urlDirect = packageDependencyApiUrl(mgrVal, nsVal, nameVal, ver, {
        recursive: false,
        vuln: true,
        scorecard: true,
      });
      const urlAll = packageDependencyApiUrl(mgrVal, nsVal, nameVal, ver, {
        recursive: true,
        vuln: true,
        scorecard: true,
      });

      const pmUrl = pmURLs[mgrVal] || "";
      const msgs = [
        `Fetching dependencies from ${pmUrl}`,
        "Fetching vulnerabilities from https://osv.dev",
        "Fetching reputation from https://api.securityscorecards.dev",
      ];
      setStatusMessages(msgs);
      setStatusIdx(0);
      setStatus(msgs[0]);
      setStatusKey((k) => k + 1);

      let directRes = {};
      let allRes = {};
      const fetchAndLog = async (url) => {
        addConsoleLines(`> GET ${url}`);
        const resp = await fetch(url, { signal: controller.signal });
        const cacheHeader = resp.headers.get("X-Cache-Status") || "";
        const text = await resp.text();
        addConsoleLines(text);
        if (!resp.ok) {
          const msg = resp.status === 404 ? "package not found" : text;
          throw new Error(msg || `request failed: ${resp.status}`);
        }
        try {
          return { data: JSON.parse(text), cache: cacheHeader };
        } catch (_) {
          return { data: {}, cache: cacheHeader };
        }
      };
      try {
        const resArr = await Promise.all([
          fetchAndLog(urlDirect),
          fetchAndLog(urlAll),
        ]);
        directRes = resArr[0].data;
        allRes = resArr[1].data;
        setCacheStatus(resArr[1].cache || resArr[0].cache);
      } catch (err) {
        if (err.name !== "AbortError") {
          const message =
            err && err.message ? err.message : "Unable to fetch dependency data.";
          addAlert(message);
          addConsoleLines(`! ${message}`);
        }
      }

      const resolvedRootVersion =
        allRes.resolved_version || directRes.resolved_version || rootVersion;
      if (resolvedRootVersion && resolvedRootVersion !== rootVersion) {
        rootVersion = resolvedRootVersion;
        ver = resolvedRootVersion;
        setVersion(resolvedRootVersion);
        setSubmittedVersion(resolvedRootVersion);
      }

      setStatusMessages([]);
      setStatus("Processing results...");

      const direct = directRes.dependencies || {};
      const all = allRes.dependencies || {};

      const parents = allRes.parents || {};
      let vulns = allRes.vulnerabilities || {};
      let vulnStatus =
        includeVuln && allRes.vulnerability_status
          ? { ...allRes.vulnerability_status }
          : {};
      const rootKey = formatPackage(mgrVal, nsVal, nameVal);
      if (includeVuln && (!vulnStatus[rootKey] || !vulns[rootKey])) {
        const extra = await queryOsvVulns(mgrVal, rootKey, ver);
        if (extra.vulns.length > 0) {
          vulns[rootKey] = extra.vulns;
        }
        vulnStatus[rootKey] = extra.status?.checked
          ? extra.status
          : preferOsvStatus(vulnStatus[rootKey], extra.status);
      }

      if (includeVuln) {
        const packagesNeedingOsv = Object.entries(all).filter(([pkg, depVer]) => {
          const status = vulnStatus[pkg];
          return (
            pkg &&
            depVer !== undefined &&
            (!status || status.status === "unknown" || status.status === "not_checked")
          );
        });
        if (packagesNeedingOsv.length > 0) {
          setStatus(
            `Resolving OSV status for ${packagesNeedingOsv.length} dependencies...`,
          );
          const resolvedStatuses = await mapLimit(
            packagesNeedingOsv,
            8,
            async ([pkg, depVer]) => {
              const resolved = await queryOsvVulns(mgrVal, pkg, depVer);
              return { pkg, resolved };
            },
          );
          resolvedStatuses.forEach(({ pkg, resolved }) => {
            if (!resolved) return;
            if (resolved.vulns.length > 0) {
              vulns[pkg] = resolved.vulns;
            }
            vulnStatus[pkg] = resolved.status?.checked
              ? resolved.status
              : preferOsvStatus(vulnStatus[pkg], resolved.status);
          });
        }
      }

      const depList = [];
      for (const [pkg, ver] of Object.entries(all)) {
        const plist = Array.isArray(parents[pkg])
          ? parents[pkg]
          : [parents[pkg] || ""];
        const vulnList = Array.isArray(vulns[pkg]) ? vulns[pkg] : [];
        const vulnSummary = summarizeVulnerabilities(vulnList);
        plist.forEach((p) => {
          depList.push({
            name: pkg,
            version: ver,
            transitive: !direct[pkg],
            parent: p,
            cves: vulnSummary.advisories,
            vulnerabilities: vulnList,
            risk: vulnSummary.risk,
            maxScore: vulnSummary.maxScore,
            osvStatus: vulnStatus[pkg] || null,
          });
        });
      }
      const rootKeyLookup = formatPackage(mgrVal, nsVal, nameVal);
      const rootVulnList = Array.isArray(vulns[rootKeyLookup])
        ? vulns[rootKeyLookup]
        : [];
      const rootSummary = summarizeVulnerabilities(rootVulnList);
      setRootScore(rootSummary.maxScore || null);
      setRootCves(rootSummary.advisories);
      setRootVulnerabilities(rootVulnList);
      setVulnerabilityStatus(vulnStatus);
      setDeps(normalizeDependencyRisks(depList));
      setRepos(allRes.repositories || {});
      setScorecards(allRes.scorecards || {});
      if (options.updateUrl !== false) {
        updatePackageDeepLink({
          manager: mgrVal,
          namespace: nsVal,
          name: rootName,
          version: rootVersion,
        });
      }

      // graph will be built after results are displayed

      if (clearInputs) {
        setNamespace("");
        setName("");
        setVersion("");
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = { controller: null, timer: null };
      setLoading(false);
      setStatusMessages([]);
      setStatus("");
    }
  };

  const importGithubRepoDependencies = async (
    evt,
    forcedRepo = null,
    options = {},
  ) => {
    if (evt && evt.preventDefault) evt.preventDefault();
    const repo = String(forcedRepo !== null ? forcedRepo : githubRepoUrl).trim();
    if (!repo || githubRepoLoading) return;
    setSearchMode("repository");
    setGithubRepoUrl(repo);
    setGithubRepoLoading(true);
    setGithubRepoError("");
    setGithubRepoResult(null);
    setGithubRepoVulnStatus({});
    setGithubRepoVulnLoading(false);
    setGithubRepoVulnProgress("");
    setGithubRepoStatusFilter("all");
    setSelectedGithubRepoPackage(null);
    setGithubRepoGraphExpanded(false);
    if (githubRepoTransitiveAbortRef.current) {
      githubRepoTransitiveAbortRef.current.abort();
      githubRepoTransitiveAbortRef.current = null;
    }
    setGithubRepoTransitiveDeps({});
    setGithubRepoTransitiveLoading(false);
    setGithubRepoTransitiveMode("");
    setGithubRepoTransitiveActiveKey("");
    setGithubRepoTransitiveProgress("");
    setGithubRepoTransitiveError("");
    setGithubRepoTreeCollapsed({});
    githubRepoGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    githubRepoGraphAnchorsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    try {
      const resp = await fetchInternal(
        `${apiOrigin}/api/github/dependencies?repo=${encodeURIComponent(repo)}`,
      );
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(text.trim() || `GitHub import failed: ${resp.status}`);
      }
      const data = JSON.parse(text);
      setGithubRepoResult(data);
      setGithubRepoFilter("");
      setGithubRepoStatusFilter("all");
      setSelectedGithubRepoPackage(null);
      if (options.updateUrl !== false) {
        updateGithubRepoDeepLink(data.repository || repo);
      }
      if (!data.packages || data.packages.length === 0) {
        setGithubRepoError(
          "No supported package dependencies were returned by GitHub's dependency graph.",
        );
      }
    } catch (err) {
      const message =
        err && err.message ? err.message : "Unable to import GitHub dependencies.";
      setGithubRepoError(message);
      addAlert(message);
    } finally {
      setGithubRepoLoading(false);
    }
  };

  const analyzeGithubDependency = (pkg) => {
    if (!pkg || !pkg.name || !pkg.manager) return;
    suppressPackageSuggestionsBriefly();
    setManager(pkg.manager);
    setNamespace(pkg.namespace || "");
    setName(pkg.name);
    setVersion(pkg.version || "");
    setLatestVersions([]);
    setVersionRisk({});
    setVersionsToShow(5);
    setNameSuggestions([]);
    setPackageTypeaheadOpen(false);
    fetchDeps(
      null,
      pkg.version || null,
      pkg.namespace || "",
      pkg.name,
      pkg.manager,
    );
  };

  React.useEffect(() => {
    if (deepLinkLoadedRef.current) return;
    const cveLink = initialCveDeepLinkRef.current;
    if (cveLink && cveLink.id) {
      deepLinkLoadedRef.current = true;
      setSearchMode("cve");
      setCveQuery(cveLink.id);
      fetchCve(null, cveLink.id, { updateUrl: false });
      return;
    }
    const repoLink = initialRepoDeepLinkRef.current;
    if (repoLink && repoLink.repo) {
      deepLinkLoadedRef.current = true;
      setSearchMode("repository");
      setGithubRepoUrl(repoLink.repo);
      importGithubRepoDependencies(null, repoLink.repo, { updateUrl: false });
      return;
    }
    const link = initialDeepLinkRef.current;
    if (!link || !link.name) return;
    deepLinkLoadedRef.current = true;
    setSearchMode("package");
    setManager(link.manager);
    setNamespace(link.namespace || "");
    setName(link.name);
    setVersion(link.version || "");
    fetchDeps(
      null,
      link.version || null,
      link.namespace || "",
      link.name,
      link.manager,
    );
  }, []);

  const cancelFetch = () => {
    if (abortRef.current.controller) abortRef.current.controller.abort();
    if (abortRef.current.timer) clearTimeout(abortRef.current.timer);
    abortRef.current = { controller: null, timer: null };
    setLoading(false);
    setStatusMessages([]);
    setStatus("");
  };

  const hasClearableFormState =
    Boolean(
      namespace ||
        name ||
        version ||
        search ||
        packageChainLoading ||
        packageChainActiveKey ||
        packageChainProgress ||
        packageChainError ||
        Object.keys(packageChainDeps).length > 0 ||
        cacheStatus ||
        githubRepoUrl ||
        githubRepoShareStatus ||
        githubRepoFilter ||
        githubRepoStatusFilter !== "all" ||
        githubRepoResult ||
        githubRepoError ||
        githubRepoGraphExpanded ||
        githubRepoTransitiveLoading ||
        githubRepoTransitiveMode ||
        githubRepoTransitiveActiveKey ||
        Object.keys(githubRepoTransitiveDeps).length > 0 ||
        githubRepoTransitiveProgress ||
        githubRepoTransitiveError ||
        Object.keys(githubRepoTreeCollapsed).length > 0 ||
        cveQuery ||
        cveResult ||
        cveError,
    ) ||
    formSubmitted ||
    cveSubmitted ||
    loading ||
    cveLoading ||
    githubRepoLoading ||
    latestVersions.length > 0 ||
    nameSuggestions.length > 0;

  const clearForm = () => {
    if (abortRef.current.controller) abortRef.current.controller.abort();
    if (abortRef.current.timer) clearTimeout(abortRef.current.timer);
    abortRef.current = { controller: null, timer: null };
    setNamespace("");
    setName("");
    setVersion("");
    setLatestVersions([]);
    setVersionRisk({});
    setVersionsToShow(5);
    setNameSuggestions([]);
    setDeps([]);
    if (packageChainAbortRef.current) {
      packageChainAbortRef.current.abort();
      packageChainAbortRef.current = null;
    }
    setPackageChainDeps({});
    setPackageChainLoading(false);
    setPackageChainActiveKey("");
    setPackageChainProgress("");
    setPackageChainError("");
    packageGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    packageGraphFitSignatureRef.current = "";
    setHistory([]);
    setExpanded({});
    setCollapsed({});
    setDependencyListFilter("all");
    setConsoleLines([]);
    setShowConsole(false);
    setAlerts([]);
    setBellBounce(false);
    setSearch("");
    setCacheStatus("");
    setScorecards({});
    setRootScore(null);
    setRootCves([]);
    setRootVulnerabilities([]);
    setVulnerabilityStatus({});
    setSubmittedName("");
    setSubmittedVersion("");
    setSubmittedNamespace("");
    setSubmittedManager(manager);
    setShareStatus("");
    if (githubRepoShareStatusTimerRef.current) {
      clearTimeout(githubRepoShareStatusTimerRef.current);
      githubRepoShareStatusTimerRef.current = null;
    }
    setGithubRepoShareStatus("");
    setRepos({});
    setGithubRepoUrl("");
    setGithubRepoLoading(false);
    setGithubRepoResult(null);
    setGithubRepoError("");
    setGithubRepoFilter("");
    setGithubRepoStatusFilter("all");
    setGithubRepoVulnStatus({});
    setGithubRepoVulnLoading(false);
    setGithubRepoVulnProgress("");
    setSelectedGithubRepoPackage(null);
    setGithubRepoGraphExpanded(false);
    if (githubRepoTransitiveAbortRef.current) {
      githubRepoTransitiveAbortRef.current.abort();
      githubRepoTransitiveAbortRef.current = null;
    }
    setGithubRepoTransitiveDeps({});
    setGithubRepoTransitiveLoading(false);
    setGithubRepoTransitiveMode("");
    setGithubRepoTransitiveActiveKey("");
    setGithubRepoTransitiveProgress("");
    setGithubRepoTransitiveError("");
    setGithubRepoTreeCollapsed({});
    githubRepoGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    githubRepoGraphAnchorsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    setCveQuery("");
    setCveLoading(false);
    setCveResult(null);
    setCveError("");
    setCveSubmitted(false);
    setSearchMode("package");
    setFormSubmitted(false);
    setLoading(false);
    setStatusMessages([]);
    setStatus("");
    window.history.replaceState({}, "", window.location.pathname);
  };

  const buildGraph = (
    list,
    rootName,
    rootVersion,
    direct,
    rootRisk,
    rootOsvStatus,
  ) => {
    const graphList = normalizeDependencyRisks(list);
    const nodes = [
      {
        id: `${rootName}@${rootVersion}`,
        root: true,
        risk: rootRisk,
        maxScore: rootScore || 0,
        osvStatus: rootOsvStatus,
      },
    ];
    const links = [];
    const linkKeys = new Set();
    const added = new Set([`${rootName}@${rootVersion}`]);
    const versionMap = {};
    const addLink = (source, target) => {
      if (!source || !target || source === target) return;
      const key = `${source}->${target}`;
      if (linkKeys.has(key)) return;
      linkKeys.add(key);
      links.push({ source, target });
    };
    graphList.forEach((d) => {
      versionMap[d.name] = d.version;
    });
    graphList.forEach((d) => {
      const id = `${d.name}@${d.version}`;
      const isTransitive = !direct[d.name];
      if (!added.has(id)) {
        nodes.push({
          id,
          transitive: isTransitive,
          risk: d.risk,
          maxScore: d.maxScore || maxAdvisoryScore(d.cves),
          osvStatus: d.osvStatus,
        });
        added.add(id);
      }
      if (d.transitive && d.parent) {
        const pv = versionMap[d.parent] || direct[d.parent];
        if (pv) {
          addLink(`${d.parent}@${pv}`, id);
        }
      } else {
        addLink(`${rootName}@${rootVersion}`, id);
      }
    });
    const svg = d3.select("#graph");
    svg.selectAll("*").remove();
    const defs = svg.append("defs");
    const labelShadowId = "graph-label-shadow";
    const labelShadow = defs
      .append("filter")
      .attr("id", labelShadowId)
      .attr("x", "-25%")
      .attr("y", "-25%")
      .attr("width", "150%")
      .attr("height", "150%");
    labelShadow
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 1)
      .attr("stdDeviation", 1.1)
      .attr("flood-color", graphLabelShadowColor())
      .attr("flood-opacity", graphLabelShadowOpacity());
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const largeGraph = nodes.length > 55;
    const compactGraph = width < 520;
    const chainExpandedGraph = Object.keys(packageChainDeps).length > 0;
    const chainLoadingGraph = packageChainLoading;
    const steadyGraph = chainLoadingGraph || chainExpandedGraph;
    const pinExistingGraph = chainLoadingGraph;
    const previousGraph = packageGraphPositionsRef.current || {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    const scaleX = previousGraph.width ? width / previousGraph.width : 1;
    const scaleY = previousGraph.height ? height / previousGraph.height : 1;
    const incomingParentPosition = new Map();
    links.forEach((link) => {
      if (previousGraph.positions.has(link.target)) return;
      const parentPosition = previousGraph.positions.get(link.source);
      if (parentPosition) incomingParentPosition.set(link.target, parentPosition);
    });
    nodes.forEach((node) => {
      const saved = previousGraph.positions.get(node.id);
      if (saved) {
        node.x = Math.max(24, Math.min(width - 24, saved.x * scaleX));
        node.y = Math.max(24, Math.min(height - 24, saved.y * scaleY));
        if (pinExistingGraph) {
          node.fx = node.x;
          node.fy = node.y;
        }
      } else if (node.root) {
        node.x = width / 2;
        node.y = height / 2;
        if (pinExistingGraph) {
          node.fx = node.x;
          node.fy = node.y;
        }
      } else {
        const parentPosition = incomingParentPosition.get(node.id);
        if (parentPosition) {
          const seed = Array.from(node.id).reduce(
            (acc, char) => acc + char.charCodeAt(0),
            0,
          );
          const angle = (seed % 360) * (Math.PI / 180);
          const radius = chainExpandedGraph
            ? 64 + (seed % 54)
            : 34 + (seed % 36);
          node.x = Math.max(
            24,
            Math.min(width - 24, parentPosition.x * scaleX + Math.cos(angle) * radius),
          );
          node.y = Math.max(
            24,
            Math.min(height - 24, parentPosition.y * scaleY + Math.sin(angle) * radius),
          );
        }
      }
      node.labelBaseVisible =
        compactGraph ||
        (!largeGraph && !compactGraph) ||
        node.root ||
        node.risk ||
        isUnresolvedOsvStatus(node.osvStatus) ||
        (chainExpandedGraph && nodes.length <= 120) ||
        (!compactGraph && !node.transitive);
    });

    const zoomLayer = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform);
      });

    svg.call(zoom);

    const zoomToFit = ({ minScale = 0.1 } = {}) => {
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padding = 40;
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const fitScale = Math.min(
        1,
        width / (contentW + padding * 2),
        height / (contentH + padding * 2),
      );
      const scale = Math.max(minScale, fitScale);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const tx = width / 2 - scale * cx;
      const ty = height / 2 - scale * cy;
      svg
        .transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    const floatForce = (alpha) => {
      nodes.forEach((n) => {
        n.vx += (Math.random() - 0.5) * 0.1 * alpha;
        n.vy += (Math.random() - 0.5) * 0.1 * alpha;
      });
    };

    const linkDistance = chainExpandedGraph
      ? compactGraph
        ? 74
        : largeGraph
          ? 112
          : 146
      : largeGraph
        ? 90
        : compactGraph
          ? 44
          : 60;
    const chargeStrength = chainExpandedGraph
      ? largeGraph
        ? -340
        : compactGraph
          ? -130
          : -360
      : largeGraph
        ? -230
        : compactGraph
          ? -75
          : -120;
    const collisionRadius = (d) => {
      if (chainExpandedGraph && d.labelBaseVisible && !compactGraph) {
        return Math.min(
          largeGraph ? 64 : 88,
          Math.max(d.root ? 42 : 38, String(d.id || "").length * (largeGraph ? 1.8 : 2.3)),
        );
      }
      return largeGraph ? 24 : compactGraph ? 15 : 20;
    };
    const graphLabelAnchor = (d) => {
      if (compactGraph) return "middle";
      return (d.x || width / 2) > width / 2 ? "end" : "start";
    };
    const graphLabelX = (d) => {
      if (compactGraph) return d.x;
      return d.x + (graphLabelAnchor(d) === "end" ? -10 : 10);
    };

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(chainExpandedGraph ? 0.56 : 1),
      )
      .force(
        "charge",
        d3.forceManyBody().strength(chargeStrength),
      )
      .force("collide", d3.forceCollide(collisionRadius).iterations(chainExpandedGraph ? 3 : 1))
      .force("center", d3.forceCenter(width / 2, height / 2));

    if (!steadyGraph) {
      simulation.force("float", floatForce);
    }

    const link = zoomLayer
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", largeGraph ? 0.38 : 1)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line");

    const colorMap = {};
    const fillFor = (d) => {
      const color = getNodeColor(d);
      if (!colorMap[color]) {
        colorMap[color] = resolveColor(color);
      }
      return colorMap[color];
    };

    const node = zoomLayer
      .append("g")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)

      .enter()
      .append("circle")
      .attr("class", (d) =>
        [
          "graph-node",
          d.root ? "graph-node-root" : "",
          d.risk ? `risk-${d.risk}` : "",
          !d.risk && isUnresolvedOsvStatus(d.osvStatus)
            ? "risk-unknown"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .attr("data-node-id", (d) => d.id)
      .attr("data-risk", (d) => d.risk || "")
      .attr("data-osv-status", (d) => d.osvStatus?.status || "")
      .attr("r", (d) => (largeGraph && !d.root && !d.risk ? 6 : 8))
      .attr("fill", (d) => fillFor(d))
      .attr("stroke", (d) => (d.root ? "#00e5ff" : "#fff"))
      .on("click", (_, d) => {
        const at = d.id.lastIndexOf("@");
        if (at <= 0) return;
        const pkg = d.id.slice(0, at);
        const ver = d.id.slice(at + 1);
        let url = "";
        switch (submittedManager || manager) {
          case "npm":
            url = `https://www.npmjs.com/package/${pkg}/v/${ver}`;
            break;
          case "pypi":
            url = `https://pypi.org/project/${pkg}/${ver}/`;
            break;
          case "go":
            url = `https://pkg.go.dev/${pkg}@${ver}`;
            break;
          case "maven": {
            const parts = pkg.split(":");
            if (parts.length === 2) {
              url = `https://search.maven.org/artifact/${parts[0]}/${parts[1]}/${ver}/jar`;
            }
            break;
          }
          case "cargo":
            url = `https://crates.io/crates/${pkg}/${ver}`;
            break;
          case "rubygems":
            url = `https://rubygems.org/gems/${pkg}/versions/${ver}`;
            break;
          case "nuget":
            url = `https://www.nuget.org/packages/${pkg}/${ver}`;
            break;
          case "composer":
            url = `https://packagist.org/packages/${pkg}`;
            break;
          default:
            url = "";
        }
        if (url) {
          window.open(url, "_blank");
        }
      });

    const drag = d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);
    node
      .append("title")
      .text((d) => {
        const severity =
          includeVuln && d.risk
            ? `. Highest severity: ${d.risk}${
                d.maxScore ? ` (${Number(d.maxScore).toFixed(1)})` : ""
              }`
            : "";
        return `${d.id} - ${osvStatusLabel(d.osvStatus)}${severity}`;
      });

    const pivotGraphLabel = (event, d) => {
      event?.stopPropagation();
      event?.preventDefault();
      const at = d.id.lastIndexOf("@");
      if (at <= 0) return;
      pivotSearch({ name: d.id.slice(0, at), version: d.id.slice(at + 1) });
    };

    const label = zoomLayer
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "graph-label")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (d) => `Analyze ${d.id}`)
      .text((d) => d.id)
      .attr("font-size", compactGraph ? 5.5 : largeGraph ? 9 : 10)
      .attr("fill", (d) => graphBaseLabelColor(d))
      .attr("stroke", graphLabelHaloColor())
      .attr("stroke-width", graphLabelStrokeWidth(compactGraph))
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke")
      .attr("text-anchor", graphLabelAnchor)
      .attr("filter", `url(#${labelShadowId})`)
      .style("display", (d) => (d.labelBaseVisible ? null : "none"))
      .style("pointer-events", "auto")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", pivotGraphLabel)
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          pivotGraphLabel(event, d);
        }
      });

    nodesRef.current = node;
    labelsRef.current = label;

    const chainFitSignature =
      chainExpandedGraph && !chainLoadingGraph
        ? `${nodes.length}:${links.length}:${rootName}@${rootVersion}`
        : "";
    const shouldFitCompletedChain =
      chainFitSignature &&
      packageGraphFitSignatureRef.current !== chainFitSignature;

    if (!centeredRef.current || shouldFitCompletedChain) {
      setTimeout(() => {
        if (largeGraph || compactGraph || chainExpandedGraph) {
          zoomToFit({
            minScale: chainExpandedGraph && !compactGraph ? 0.72 : 0.1,
          });
          return;
        }
        const rootNode = nodes.find((n) => n.root);
        if (!rootNode) return;
        const tx = width / 2 - rootNode.x;
        const ty = height / 2 - rootNode.y;
        svg
          .transition()
          .duration(500)
          .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(1));
      }, chainExpandedGraph ? 900 : 500);
      centeredRef.current = true;
      if (shouldFitCompletedChain) {
        packageGraphFitSignatureRef.current = chainFitSignature;
      }
    }

    const saveGraphPositions = () => {
      packageGraphPositionsRef.current = {
        height,
        positions: new Map(
          nodes.map((nodeItem) => [
            nodeItem.id,
            { x: nodeItem.x || 0, y: nodeItem.y || 0 },
          ]),
        ),
        width,
      };
    };

    if (!steadyGraph) {
      simulation.on("end", () => {
        saveGraphPositions();
        simulation.alphaTarget(0.05).restart();
      });
    } else {
      simulation.on("end", saveGraphPositions);
    }
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label
        .attr("text-anchor", graphLabelAnchor)
        .attr("x", graphLabelX)
        .attr("y", (d) => (compactGraph ? d.y - 7 : d.y));
      saveGraphPositions();
    });
  };

  const formatPackage = (pm, ns, nm) => {
    switch (pm) {
      case "maven":
        return ns ? `${ns}:${nm}` : nm;
      default:
        return ns ? `${ns}/${nm}` : nm;
    }
  };

  const packageChainKey = (packageName, versionValue) =>
    `${packageName}@${normalizePackageVersion(versionValue)}`;

  const packageChainCandidateFromName = (packageName, versionValue) => {
    const versionPart = normalizePackageVersion(versionValue);
    if (!packageName || !packageHasExactVersion(versionPart)) return null;
    const parsed = splitDeepLinkName(submittedManager, "", packageName);
    const displayName =
      formatPackage(submittedManager, parsed.namespace, parsed.name) ||
      packageName;
    const url = packageDependencyApiUrl(
      submittedManager,
      parsed.namespace,
      parsed.name,
      versionPart,
      {
        recursive: true,
        vuln: includeVuln,
        scorecard: false,
      },
    );
    if (!url) return null;
    return {
      key: packageChainKey(displayName, versionPart),
      manager: submittedManager,
      namespace: parsed.namespace,
      name: parsed.name,
      packageName: displayName,
      version: versionPart,
      url,
    };
  };

  const packageChainExpansionToDeps = (expansion) => {
    if (!expansion || expansion.failed) return [];
    const dependencies = expansion.dependencies || {};
    const parents = expansion.parents || {};
    const vulnerabilities = expansion.vulnerabilities || {};
    const vulnerabilityStatus = expansion.vulnerabilityStatus || {};
    const expandedDeps = [];
    Object.entries(dependencies).forEach(([pkg, depVersion]) => {
      if (!pkg || pkg === expansion.rootPackageName) return;
      const parentValues = Array.isArray(parents[pkg])
        ? parents[pkg]
        : [parents[pkg] || ""];
      const vulnList = Array.isArray(vulnerabilities[pkg])
        ? vulnerabilities[pkg]
        : [];
      const vulnSummary = summarizeVulnerabilities(vulnList);
      parentValues.forEach((parentValue) => {
        const parent = parentValue || expansion.rootPackageName;
        if (!parent || parent === pkg) return;
        expandedDeps.push({
          name: pkg,
          version: depVersion,
          transitive: true,
          parent,
          cves: vulnSummary.advisories,
          vulnerabilities: vulnList,
          risk: vulnSummary.risk,
          maxScore: vulnSummary.maxScore,
          osvStatus: vulnerabilityStatus[pkg] || null,
          chainExpanded: true,
        });
      });
    });
    return expandedDeps;
  };

  const mergePackageChainDeps = (baseDeps, chainMap = packageChainDeps) =>
    normalizeDependencyRisks([
      ...(baseDeps || []),
      ...Object.values(chainMap).flatMap(packageChainExpansionToDeps),
    ]);

  const collectPackageChainCandidates = (chainMap = packageChainDeps) => {
    const candidates = new Map();
    const addCandidate = (packageName, versionValue) => {
      const candidate = packageChainCandidateFromName(packageName, versionValue);
      if (!candidate) return;
      if (candidate.packageName === formatPackage(submittedManager, submittedNamespace, submittedName)) {
        return;
      }
      if (!candidates.has(candidate.key)) candidates.set(candidate.key, candidate);
    };
    deps.forEach((dep) => addCandidate(dep.name, dep.version));
    Object.values(chainMap).forEach((expansion) => {
      if (!expansion || expansion.failed) return;
      Object.entries(expansion.dependencies || {}).forEach(([pkg, versionValue]) =>
        addCandidate(pkg, versionValue),
      );
    });
    return Array.from(candidates.values()).sort((a, b) =>
      a.packageName.localeCompare(b.packageName) ||
      a.version.localeCompare(b.version),
    );
  };

  const packageChainExpansionFromResponse = (candidate, data) => ({
    manager: candidate.manager,
    rootPackageName: candidate.packageName,
    rootVersion: data.resolved_version || candidate.version,
    dependencies: data.dependencies || {},
    parents: data.parents || {},
    vulnerabilities: data.vulnerabilities || {},
    vulnerabilityStatus: includeVuln ? data.vulnerability_status || {} : {},
    failed: false,
  });

  const cancelPackageChainResolution = () => {
    if (packageChainAbortRef.current) {
      packageChainAbortRef.current.abort();
      packageChainAbortRef.current = null;
    }
    setPackageChainLoading(false);
    setPackageChainActiveKey("");
    setPackageChainProgress("Dependency-chain resolution cancelled");
  };

  const clearPackageChainResolution = () => {
    cancelPackageChainResolution();
    setPackageChainDeps({});
    setPackageChainProgress("");
    setPackageChainError("");
    packageGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    packageGraphFitSignatureRef.current = "";
  };

  const resolvePackageDependencyChains = async () => {
    if (packageChainLoading) {
      cancelPackageChainResolution();
      return;
    }
    let resolvedMap = { ...packageChainDeps };
    let queue = collectPackageChainCandidates(resolvedMap).filter(
      (candidate) => !resolvedMap[candidate.key],
    );
    if (queue.length === 0) {
      setPackageChainProgress(
        collectPackageChainCandidates(resolvedMap).length === 0
          ? "No exact-version dependency nodes are available to resolve"
          : "Full package dependency chain is already resolved",
      );
      setPackageChainError("");
      return;
    }

    const controller = new AbortController();
    packageChainAbortRef.current = controller;
    setPackageChainLoading(true);
    setPackageChainActiveKey("");
    setPackageChainError("");
    setPackageChainProgress(`Resolving 0/${queue.length} package chains`);

    let completed = 0;
    let failed = 0;
    const queuedKeys = new Set(queue.map((candidate) => candidate.key));
    try {
      while (queue.length > 0 && !controller.signal.aborted) {
        const candidate = queue.shift();
        queuedKeys.delete(candidate.key);
        if (!candidate || resolvedMap[candidate.key]) continue;
        const total = completed + queue.length + 1;
        setPackageChainActiveKey(candidate.key);
        setPackageChainProgress(
          `Resolving ${completed}/${total} package chains - ${candidate.packageName}@${candidate.version}`,
        );
        try {
          const resp = await fetchInternal(candidate.url, {
            signal: controller.signal,
          });
          const text = await resp.text();
          addConsoleLines(text);
          if (!resp.ok) {
            throw new Error(
              resp.status === 404
                ? "package not found"
                : text || `request failed: ${resp.status}`,
            );
          }
          const data = text ? JSON.parse(text) : {};
          resolvedMap = {
            ...resolvedMap,
            [candidate.key]: packageChainExpansionFromResponse(candidate, data),
          };
          completed += 1;
        } catch (err) {
          if (err.name === "AbortError" || controller.signal.aborted) break;
          failed += 1;
          resolvedMap = {
            ...resolvedMap,
            [candidate.key]: {
              manager: candidate.manager,
              rootPackageName: candidate.packageName,
              rootVersion: candidate.version,
              dependencies: {},
              parents: {},
              vulnerabilities: {},
              vulnerabilityStatus: {},
              failed: true,
              error:
                err && err.message
                  ? err.message
                  : "Unable to resolve package chain",
            },
          };
        }
        setPackageChainDeps(resolvedMap);
        collectPackageChainCandidates(resolvedMap).forEach((nextCandidate) => {
          if (resolvedMap[nextCandidate.key] || queuedKeys.has(nextCandidate.key)) {
            return;
          }
          queue.push(nextCandidate);
          queuedKeys.add(nextCandidate.key);
        });
      }
    } finally {
      if (packageChainAbortRef.current === controller) {
        packageChainAbortRef.current = null;
      }
      setPackageChainLoading(false);
      setPackageChainActiveKey("");
      if (controller.signal.aborted) {
        setPackageChainProgress("Dependency-chain resolution cancelled");
      } else {
        setPackageChainProgress(
          `Resolved ${completed} package chain${completed === 1 ? "" : "s"}${
            failed ? `; ${failed} failed` : ""
          }`,
        );
        setPackageChainError(
          failed
            ? `${failed} package chain${failed === 1 ? "" : "s"} could not be resolved.`
            : "",
        );
      }
    }
  };

  const splitDep = (dep) => {
    if (dep.startsWith("@")) {
      const i = dep.indexOf("/");
      if (i > 0) return [dep.slice(0, i), dep.slice(i + 1)];
    }
    if (dep.includes(":")) {
      const parts = dep.split(":", 2);
      return [parts[0], parts[1]];
    }
    if ((dep.match(/\//g) || []).length > 1) {
      const idx = dep.indexOf("/");
      return [dep.slice(0, idx), dep.slice(idx + 1)];
    }
    return ["", dep];
  };

  const pivotSearch = (dep) => {
    setHistory((h) => [...h, { manager, namespace, name, version }]);
    const [ns, nm] = splitDep(dep.name);
    setNamespace(ns);
    setName(nm);
    setVersion(dep.version);
    fetchDeps(null, dep.version, ns, nm);
  };

  const packageUrl = (dep, mgr = submittedManager) => {
    const pkg = dep.name;
    const ver = dep.version;
    switch (mgr) {
      case "npm":
        return `https://www.npmjs.com/package/${pkg}/v/${ver}`;
      case "pypi":
        return `https://pypi.org/project/${pkg}/${ver}/`;
      case "go":
        return `https://pkg.go.dev/${pkg}@${ver}`;
      case "maven": {
        const parts = pkg.split(":");
        if (parts.length === 2) {
          return `https://search.maven.org/artifact/${parts[0]}/${parts[1]}/${ver}/jar`;
        }
        break;
      }
      case "cargo":
        return `https://crates.io/crates/${pkg}/${ver}`;
      case "rubygems":
        return `https://rubygems.org/gems/${pkg}/versions/${ver}`;
      case "nuget":
        return `https://www.nuget.org/packages/${pkg}/${ver}`;
      case "composer":
        return `https://packagist.org/packages/${pkg}`;
      default:
        return "";
    }
  };

  const currentPackageDeepLink = () =>
    buildPackageDeepLink({
      manager: submittedManager,
      namespace: submittedNamespace,
      name: submittedName,
      version: submittedVersion,
    });

  const copyPackageDeepLink = async (event) => {
    event?.preventDefault?.();
    const url = currentPackageDeepLink();
    setShareStatus("Copying...");
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
    const copied = await copyTextToClipboard(url);
    setShareStatus(copied ? "Copied" : "Link ready");
    shareStatusTimerRef.current = setTimeout(() => setShareStatus(""), 1800);
  };

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setManager(prev.manager);
      setNamespace(prev.namespace);
      setName(prev.name);
      setVersion(prev.version);
      fetchDeps(null, prev.version, prev.namespace, prev.name, prev.manager);
      return h.slice(0, -1);
    });
  };

  const depLists = (() => {
    if (!showPackageResults) return null;
    const displayDeps = mergePackageChainDeps(deps, packageChainDeps);
    const childMap = new Map();
    displayDeps.forEach((d) => {
      const p = d.parent || "";
      if (!childMap.has(p)) childMap.set(p, []);
      childMap.get(p).push(d);
    });

    const uniqueChildren = (p) => {
      const arr = childMap.get(p) || [];
      const seen = new Set();
      const uniq = [];
      arr.forEach((c) => {
        const k = `${c.name}@${c.version}`;
        if (!seen.has(k)) {
          uniq.push(c);
          seen.add(k);
        }
      });
      return uniq.sort(compareDependencyRisk);
    };

    const largeDependencySet = displayDeps.length > 55;
    const riskCount = (list) => list.filter((d) => d.risk).length;
    const noAdvisoryCount = (list) =>
      list.filter((d) => d.osvStatus?.status === "no_advisory").length;
    const unresolvedOsvCount = (list) =>
      list.filter((d) => isUnresolvedOsvStatus(d.osvStatus)).length;
    const maxAdvisoryScore = (advisories) =>
      Math.max(
        0,
        ...(Array.isArray(advisories)
          ? advisories.map((c) => Number(c.score) || 0)
          : []),
      );
    const advisoryTitle = (advisory) => {
      const sev = riskFromScore(advisory.score);
      const parts = [
        `OSV severity ${advisory.score}${sev ? ` (${sev})` : ""}`,
      ];
      if (advisory.description) parts.push(advisory.description);
      return parts.join(" - ");
    };
    const renderAdvisoryLinks = (advisories, className = "cve-inline") =>
      e(
        "span",
        { className },
        (advisories || []).map((advisory) =>
          e(
            "a",
            {
              key: advisory.id,
              href: `https://osv.dev/vulnerability/${advisory.id}`,
              target: "_blank",
              rel: "noopener noreferrer",
              onClick: (ev) => ev.stopPropagation(),
              title: advisoryTitle(advisory),
            },
            advisory.id,
          ),
        ),
      );
    const renderAdvisoryDescriptions = (advisories) => {
      const groups = advisoryDescriptionGroups(advisories);
      if (groups.length === 0) return null;
      return e(
        "ul",
        { className: "advisory-descriptions" },
        groups.map((group) =>
          e(
            "li",
            { key: `${group.ids.join("-")}-${group.description}` },
            e("span", { className: "advisory-description-ids" }, group.ids.join(", ")),
            e("span", { className: "advisory-description-text" }, group.description),
          ),
        ),
      );
    };

    const renderSummary = (total, risky, list) => {
      const clean = noAdvisoryCount(list);
      const unresolved = unresolvedOsvCount(list);
      return e(
        "div",
        { className: "dependency-summary" },
        e("span", null, `${total} packages`),
        e(
          "span",
          {
            className:
              includeVuln && risky > 0
                ? "summary-risk summary-risk-active"
                : "summary-risk",
          },
          includeVuln
            ? `${risky} with OSV advisories`
            : "OSV not checked",
        ),
        includeVuln &&
          clean > 0 &&
          e(
            "span",
            { className: "summary-clean" },
            `${clean} checked clean`,
          ),
        includeVuln &&
          unresolved > 0 &&
          e(
            "span",
            { className: "summary-unknown" },
            `${unresolved} OSV unresolved`,
          ),
      );
    };

    const renderSecurityOverview = (analysis) => {
      const highCritical = analysis.severity.high + analysis.severity.critical;
      const hasFindings = analysis.totals.findings > 0;
      const hasUnresolved = includeVuln && analysis.totals.unresolvedPackages > 0;
      const verdict = !includeVuln
        ? {
            tone: "unknown",
            icon: "icons/warning.svg",
            label: "OSV not checked",
            detail: "Run an OSV scan to classify dependency risk.",
          }
        : highCritical > 0
          ? {
              tone: "danger",
              icon: "icons/error.svg",
              label: "Action needed",
              detail: `${highCritical} high or critical advisories need attention.`,
            }
          : hasFindings
            ? {
                tone: "review",
                icon: "icons/warning.svg",
                label: "Review vulnerabilities",
                detail: `${analysis.totals.findings} packages have OSV advisories.`,
              }
            : hasUnresolved
              ? {
                  tone: "unknown",
                  icon: "icons/warning.svg",
                  label: "Resolve OSV gaps",
                  detail: `${analysis.totals.unresolvedPackages} packages need another lookup.`,
                }
              : {
                  tone: "clean",
                  icon: "icons/success.svg",
                  label: "No known OSV risk",
                  detail: `${analysis.totals.cleanPackages} packages checked clean.`,
                };
      const landscape = [
        {
          key: "vulnerable",
          value: analysis.totals.findings,
          label: "Vulnerable",
          detail: "packages",
          icon: "icons/error.svg",
          tone: hasFindings ? "danger" : "clean",
        },
        {
          key: "priority",
          value: highCritical,
          label: "High/Critical",
          detail: "priority fixes",
          icon: "icons/warning.svg",
          tone: highCritical > 0 ? "danger" : "muted",
        },
        {
          key: "transitive",
          value: analysis.totals.transitiveFindings,
          label: "Transitive",
          detail: "findings",
          icon: "icons/transitive.svg",
          tone: analysis.totals.transitiveFindings > 0 ? "review" : "muted",
        },
        {
          key: "clean",
          value: analysis.totals.cleanPackages,
          label: "Checked clean",
          detail: "no advisory",
          icon: "icons/success.svg",
          tone: "clean",
        },
        {
          key: "unresolved",
          value: analysis.totals.unresolvedPackages,
          label: "OSV gaps",
          detail: "unresolved",
          icon: "icons/cache.svg",
          tone: hasUnresolved ? "unknown" : "muted",
        },
      ];
      const nextSteps = hasFindings
        ? [
            {
              key: "patch",
              tone: highCritical > 0 ? "danger" : "review",
              icon: highCritical > 0 ? "icons/error.svg" : "icons/warning.svg",
              label: highCritical > 0 ? "Patch priority packages" : "Review advisories",
              detail:
                highCritical > 0
                  ? "Start with high and critical packages before lower severity work."
                  : "Inspect affected versions and decide whether a version bump is needed.",
            },
            {
              key: "paths",
              tone: analysis.totals.transitiveFindings > 0 ? "review" : "muted",
              icon: "icons/transitive.svg",
              label:
                analysis.totals.transitiveFindings > 0
                  ? "Trace transitive paths"
                  : "Check direct impact",
              detail:
                analysis.totals.transitiveFindings > 0
                  ? "Use the tree filters to see which parent packages bring risk in."
                  : "The risky packages are direct or root dependencies.",
            },
            {
              key: "evidence",
              tone: "clean",
              icon: "icons/checks.svg",
              label: "Export evidence",
              detail: "Download SBOM or CSV for tracking and review.",
            },
          ]
        : hasUnresolved
          ? [
              {
                key: "retry",
                tone: "unknown",
                icon: "icons/cache.svg",
                label: "Resolve lookup gaps",
                detail: "Filter OSV gaps and rerun analysis for packages without a result.",
              },
              {
                key: "monitor",
                tone: "clean",
                icon: "icons/checks.svg",
                label: "Keep the clean set",
                detail: "Export JSON or SBOM once unresolved packages are cleared.",
              },
            ]
          : [
              {
                key: "clean",
                tone: "clean",
                icon: "icons/success.svg",
                label: includeVuln ? "Clean OSV scan" : "Risk not classified",
                detail: includeVuln
                  ? "No OSV advisories were returned for this dependency set."
                  : "OSV vulnerability checks were disabled for this run.",
              },
              {
                key: "evidence",
                tone: "muted",
                icon: "icons/checks.svg",
                label: "Keep evidence",
                detail: "Download JSON or SBOM for audit records.",
              },
            ];
      const filterOptions = [
        {
          key: "all",
          label: "All dependencies",
          count: analysis.totals.checkedPackages,
          disabled: false,
        },
        {
          key: "vulnerable",
          label: "Vulnerable",
          count: analysis.totals.findings,
          disabled: !includeVuln || analysis.findings.length === 0,
        },
        {
          key: "unknown",
          label: "Needs OSV check",
          count: analysis.totals.unresolvedPackages,
          disabled: !includeVuln || analysis.totals.unresolvedPackages === 0,
        },
      ];
      const exportButton = (format, label, options = {}) =>
        e(
          "button",
          {
            type: "button",
            className: "security-action-button",
            onClick: () => exportSecurityAnalysis(analysis, format),
            disabled: options.disabled,
            title: options.title,
            "aria-label": options.ariaLabel || `Export ${label}`,
          },
          e("span", { className: "security-action-icon", "aria-hidden": "true" }, options.icon),
          e("span", null, label),
        );
      return e(
        "section",
        { className: `security-overview security-overview-${verdict.tone}` },
        e(
          "div",
          { className: "security-overview-header" },
          e(
            "div",
            { className: "security-title-block" },
            e("h3", null, "Security Triage"),
            e(
              "p",
              { className: "triage-summary-line" },
              includeVuln
                ? `${analysis.totals.checkedPackages} packages tracked, ${analysis.totals.cleanPackages} clean, ${analysis.totals.unresolvedPackages} OSV gaps`
                : `${analysis.totals.checkedPackages} packages tracked, OSV not checked`,
            ),
          ),
          e(
            "div",
            { className: `triage-verdict triage-verdict-${verdict.tone}` },
            e("img", { src: verdict.icon, alt: "", "aria-hidden": "true" }),
            e(
              "span",
              { className: "triage-verdict-copy" },
              e("strong", null, verdict.label),
              e("span", null, verdict.detail),
            ),
          ),
          e(
            "div",
            { className: "security-actions", "aria-label": "Download security data" },
            exportButton("json", "JSON", {
              icon: "{}",
              ariaLabel: "Export JSON security report",
            }),
            exportButton("cyclonedx", "SBOM", {
              icon: "SB",
              title: "Export CycloneDX SBOM with OSV vulnerability details",
              ariaLabel: "Export CycloneDX SBOM",
            }),
            exportButton("graphviz", "DOT", {
              icon: "GV",
              title: "Export GraphViz DOT dependency graph with OSV status attributes",
              ariaLabel: "Export GraphViz DOT dependency graph",
            }),
            exportButton("csv", "CSV", {
              icon: "CSV",
              disabled: analysis.findings.length === 0,
              ariaLabel: "Export vulnerable package CSV",
            }),
          ),
        ),
        e(
          "div",
          { className: "security-stat-grid", "aria-label": "Risk landscape" },
          landscape.map((item) =>
            e(
              "div",
              {
                key: item.key,
                className: `security-stat security-stat-${item.tone}`,
              },
              e(
                "span",
                { className: "security-stat-icon", "aria-hidden": "true" },
                e("img", { src: item.icon, alt: "" }),
              ),
              e(
                "span",
                { className: "security-stat-copy" },
                e(
                  "span",
                  { className: `security-stat-value risk-${item.tone}` },
                  item.value,
                ),
                e("span", { className: "security-stat-label" }, item.label),
                e("span", { className: "security-stat-detail" }, item.detail),
              ),
            ),
          ),
        ),
        e(
          "div",
          { className: "triage-next-steps" },
          nextSteps.map((step) =>
            e(
              "div",
              {
                key: step.key,
                className: `triage-step triage-step-${step.tone}`,
              },
              e("img", { src: step.icon, alt: "", "aria-hidden": "true" }),
              e(
                "span",
                null,
                e("strong", null, step.label),
                e("span", null, step.detail),
              ),
            ),
          ),
        ),
        e(
          "div",
          { className: "triage-filter-shell" },
          e("span", { className: "triage-filter-label" }, "Filter"),
          e(
            "div",
            { className: "dependency-filter-row" },
            filterOptions.map((option) =>
              e(
                "button",
                {
                  key: option.key,
                  type: "button",
                  className: dependencyListFilter === option.key ? "active" : "",
                  onClick: () => setDependencyListFilter(option.key),
                  disabled: option.disabled,
                },
                e("span", null, option.label),
                e("span", { className: "filter-count" }, option.count),
              ),
            ),
          ),
        ),
        includeVuln &&
          e(
            "p",
            { className: "osv-status-note" },
            "Graph dots: gray is checked clean; amber outline means OSV needs another lookup.",
          ),
        analysis.findings.length > 0
          ? e(
              "ol",
              { className: "finding-list" },
              analysis.findings.slice(0, 8).map((finding) =>
                e(
                  "li",
                  { key: `${finding.scope}-${finding.name}@${finding.version}` },
                  e(
                    "div",
                    { className: "finding-main" },
                    e("span", { className: `finding-risk risk-${finding.risk}` }, finding.risk),
                    e(
                      "a",
                      {
                        href: finding.registryUrl,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                      `${finding.name}@${finding.version}`,
                    ),
                    e("span", { className: "finding-scope" }, finding.scope),
                  ),
                  renderAdvisoryLinks(
                    finding.advisories,
                    "cve-inline finding-advisories",
                  ),
                  renderAdvisoryDescriptions(finding.advisories),
                ),
              ),
            )
          : e(
              "div",
              { className: "empty-dependencies security-empty" },
              includeVuln
                ? "No vulnerable packages returned by OSV for this dependency set."
                : "OSV checking is disabled for this run.",
            ),
      );
    };

    const matchesDependencyFilter = (dep) => {
      if (dependencyListFilter === "vulnerable") return Boolean(dep.risk);
      if (dependencyListFilter === "unknown") {
        return isUnresolvedOsvStatus(dep.osvStatus);
      }
      return true;
    };

    const treeNodeMatchesFilter = (dep, seen = new Set()) => {
      if (dependencyListFilter === "all") return true;
      const key = `${dep.name}@${dep.version}`;
      if (seen.has(key)) return false;
      if (matchesDependencyFilter(dep)) return true;
      const childSeen = new Set(seen);
      childSeen.add(key);
      const childParentKey = dep.root ? "" : dep.name;
      return uniqueChildren(childParentKey).some((child) =>
        treeNodeMatchesFilter(child, childSeen),
      );
    };

    const renderNode = (dep, seen = new Set(), depth = 0) => {
      const key = `${dep.name}@${dep.version}`;
      if (seen.has(key)) return null;
      if (!treeNodeMatchesFilter(dep, seen)) return null;
      const childSeen = new Set(seen);
      childSeen.add(key);
      const childParentKey = dep.root ? "" : dep.name;
      const children = uniqueChildren(childParentKey);
      const chainState = packageChainDeps[key];
      const childHasChainState = children.some((child) => {
        const childKey = `${child.name}@${child.version}`;
        return packageChainActiveKey === childKey || Boolean(packageChainDeps[childKey]);
      });
      const defaultCollapsed =
        !dep.root &&
        largeDependencySet &&
        children.length > 0 &&
        !dep.risk &&
        packageChainActiveKey !== key &&
        !chainState &&
        !childHasChainState;
      const isCollapsed = collapsed[key] ?? defaultCollapsed;
      const depParsed = splitDeepLinkName(submittedManager, "", dep.name);
      const depLocalLink = buildPackageDeepLink({
        manager: submittedManager,
        namespace: depParsed.namespace,
        name: depParsed.name,
        version: dep.version,
      });
      return e(
        "li",
        {
          key,
          className: [
            dep.root ? "dependency-root-row" : "",
            dep.risk ? "dependency-risk-row" : "",
            packageChainActiveKey === key ? "dependency-resolving-row" : "",
            !dep.risk && isUnresolvedOsvStatus(dep.osvStatus)
              ? "dependency-osv-unknown-row"
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        e(
          React.Fragment,
          null,
          children.length > 0 &&
            e(
              "span",
              {
                className: "tree-toggle",
                onClick: () => toggleNode(key, defaultCollapsed),
                title: isCollapsed ? "Show dependencies" : "Hide dependencies",
              },
              isCollapsed ? "\u25B6" : "\u25BC",
            ),
          e(
            "a",
            {
              href: packageUrl(dep, submittedManager),
              target: "_blank",
              onClick: (ev) => ev.stopPropagation(),
              className: "risk-link",
            },
            e("span", {
              className: riskDotClass(dep),
              title: riskDotTitle(dep),
            }),
          ),
          e(
            "a",
            {
              className: "dep-name",
              href: depLocalLink,
              onClick: (event) => {
                event.preventDefault();
                pivotSearch(dep);
              },
            },
            `${dep.name}@${dep.version}`,
          ),
          includeVuln &&
            dep.risk &&
            dep.maxScore > 0 &&
            e(
              "span",
              {
                className: `dep-risk-score risk-${dep.risk}`,
                title: `Highest OSV severity for this dependency: ${dep.risk}`,
              },
              Number(dep.maxScore).toFixed(1),
            ),
          dep.root &&
            e("span", { className: "dependency-root-badge" }, "root"),
          packageChainActiveKey === key &&
            e("span", { className: "dependency-chain-badge active" }, "resolving"),
          chainState?.failed &&
            e("span", { className: "dependency-chain-badge warning" }, "chain failed"),
          renderAdvisoryLinks(dep.cves),
          !isCollapsed && buildList(childParentKey, childSeen, depth),
        ),
      );
    };

    const buildList = (p, seen, depth = 0) => {
      const kids = uniqueChildren(p);
      if (kids.length === 0) return null;
      const visibleKids = kids.filter((kid) => treeNodeMatchesFilter(kid, seen));
      if (visibleKids.length === 0) return null;
      return e("ul", null, visibleKids.map((c) => renderNode(c, seen, depth + 1)));
    };

    const emptyDependencyMessage = (text) =>
      e("li", { className: "empty-dependencies" }, text);

    const transDepsRaw = displayDeps.filter((d) => d.transitive);
    const transMap = new Map();
    transDepsRaw.forEach((d) => {
      const key = `${d.name}@${d.version}`;
      if (!transMap.has(key)) {
        transMap.set(key, { ...d, parents: new Set([d.parent]) });
      } else {
        transMap.get(key).parents.add(d.parent);
      }
    });
    const transDeps = Array.from(transMap.values())
      .map((d) => ({
        ...d,
        parents: Array.from(d.parents),
      }))
      .sort(compareDependencyRisk);
    const directDeps = uniqueChildren("");
    const directRiskCount = riskCount(directDeps);
    const transitiveRiskCount = riskCount(transDeps);
    const filteredDirectDeps =
      dependencyListFilter === "all"
        ? directDeps
        : directDeps.filter(matchesDependencyFilter);
    const versionMap = {};
    const direct = {};
    displayDeps.forEach((d) => {
      versionMap[d.name] = d.version;
      if (!d.transitive) {
        direct[d.name] = d.version;
      }
    });
    const rootName = submittedName;
    const rootVersion = submittedVersion;
    const rootKey = formatPackage(submittedManager, submittedNamespace, rootName);
    const rootFullName = rootKey || rootName;
    const rootOsvStatus = vulnerabilityStatus[rootKey] || null;
    const rootRisk = rootScore !== null ? riskFromScore(rootScore) : null;
    const rootTreeNode = {
      name: rootFullName,
      version: rootVersion,
      transitive: false,
      parent: "",
      cves: rootCves,
      vulnerabilities: rootVulnerabilities,
      risk: rootRisk,
      maxScore: rootScore || 0,
      osvStatus: rootOsvStatus,
      root: true,
    };
    const rootMatchesFilter = matchesDependencyFilter(rootTreeNode);
    const showRootTree =
      dependencyListFilter === "all" ||
      rootMatchesFilter ||
      filteredDirectDeps.length > 0;
    const fullTreeDeps = [rootTreeNode, ...directDeps, ...transDeps];
    const fullTreeRiskCount = riskCount(fullTreeDeps);
    const showFullTree = treeNodeMatchesFilter(rootTreeNode, new Set());
    const rootFinding = rootRisk
      ? {
          scope: "root",
          name: rootFullName,
          version: rootVersion,
          risk: rootRisk,
          maxScore: rootScore || maxAdvisoryScore(rootCves),
          advisories: rootCves,
          vulnerabilities: rootVulnerabilities,
          registryUrl: packageUrl(
            { name: rootFullName, version: rootVersion },
            submittedManager,
          ),
          parents: [],
          osvStatus: rootOsvStatus,
        }
      : null;
    const depFindings = [...directDeps, ...transDeps]
      .filter((dep) => dep.risk)
      .map((dep) => ({
        scope: dep.transitive ? "transitive" : "direct",
        name: dep.name,
        version: dep.version,
        risk: dep.risk,
        maxScore: maxAdvisoryScore(dep.cves),
        advisories: Array.isArray(dep.cves) ? dep.cves : [],
        vulnerabilities: Array.isArray(dep.vulnerabilities)
          ? dep.vulnerabilities
          : [],
        osvStatus: dep.osvStatus || null,
        registryUrl: packageUrl(dep, submittedManager),
        parents: Array.isArray(dep.parents)
          ? dep.parents.filter(Boolean)
          : dep.parent
            ? [dep.parent]
            : [],
      }));
    const findingRecords = (rootFinding ? [rootFinding] : [])
      .concat(depFindings)
      .sort(compareDependencyRisk);
    const severity = findingRecords.reduce(
      (acc, finding) => {
        if (finding.risk && acc[finding.risk] !== undefined) {
          acc[finding.risk] += 1;
        }
        return acc;
      },
      { low: 0, medium: 0, high: 0, critical: 0 },
    );
    const trackedDeps = [...directDeps, ...transDeps];
    const componentRecords = trackedDeps.map((dep) => ({
      name: dep.name,
      version: dep.version,
      scope: dep.transitive ? "transitive" : "direct",
      risk: dep.risk,
      advisories: Array.isArray(dep.cves) ? dep.cves : [],
      vulnerabilities: Array.isArray(dep.vulnerabilities)
        ? dep.vulnerabilities
        : [],
      osvStatus: dep.osvStatus || null,
      registryUrl: packageUrl(dep, submittedManager),
      parents: Array.isArray(dep.parents)
        ? dep.parents.filter(Boolean)
        : dep.parent
          ? [dep.parent]
          : [],
    }));
    const dependencyGraph = [
      {
        name: rootFullName,
        version: rootVersion,
        dependsOn: directDeps.map((dep) => ({
          name: dep.name,
          version: dep.version,
        })),
      },
      ...componentRecords.map((dep) => ({
        name: dep.name,
        version: dep.version,
        dependsOn: uniqueChildren(dep.name).map((child) => ({
          name: child.name,
          version: child.version,
        })),
      })),
    ];
    const checkedPackages = trackedDeps.length + (rootName ? 1 : 0);
    const cleanPackages =
      noAdvisoryCount(trackedDeps) +
      (rootOsvStatus?.status === "no_advisory" ? 1 : 0);
    const unresolvedPackages =
      unresolvedOsvCount(trackedDeps) +
      (isUnresolvedOsvStatus(rootOsvStatus) ? 1 : 0);
    const notCheckedPackages =
      trackedDeps.filter((d) => d.osvStatus?.status === "not_checked").length +
      (rootOsvStatus?.status === "not_checked" ? 1 : 0);
    const analysis = {
      generatedAt: new Date().toISOString(),
      manager: submittedManager,
      root: {
        namespace: submittedNamespace,
        name: rootName,
        fullName: rootFullName,
        version: rootVersion,
        risk: rootRisk,
        advisories: rootCves,
        vulnerabilities: rootVulnerabilities,
        osvStatus: rootOsvStatus,
        registryUrl: packageUrl(
          { name: rootFullName, version: rootVersion },
          submittedManager,
        ),
      },
      totals: {
        checkedPackages,
        directPackages: directDeps.length,
        transitivePackages: transDeps.length,
        findings: findingRecords.length,
        directFindings: directRiskCount,
        transitiveFindings: transitiveRiskCount,
        cleanPackages,
        unresolvedPackages,
        notCheckedPackages,
      },
      severity,
      components: componentRecords,
      dependencyGraph,
      findings: findingRecords,
    };
    return e(
      React.Fragment,
      null,
      renderSecurityOverview(analysis),
      e(
        "div",
        { className: "columns" },
        e(
          "div",
          { className: "column" },
          e(
            "div",
            { className: "list-title deps-title" },
            e("img", { src: "icons/direct.svg", alt: "" }),
            "Direct Dependencies",
          ),
          renderSummary(directDeps.length, directRiskCount, directDeps),
          e(
            "ul",
            { className: "direct-list site-tree" },
            formSubmitted &&
              (showRootTree
                ? renderNode(rootTreeNode, new Set())
                : emptyDependencyMessage(
                    dependencyListFilter === "vulnerable"
                      ? "No vulnerable direct dependencies"
                      : dependencyListFilter === "unknown"
                        ? "No unresolved OSV direct dependencies"
                      : "No direct dependencies",
                  )),
          ),
        ),
        e(
          "div",
          { className: "column" },
          e(
            "div",
            { className: "list-title deps-title" },
            e("img", { src: "icons/transitive.svg", alt: "" }),
            "Full Dependency Tree",
          ),
          renderSummary(fullTreeDeps.length, fullTreeRiskCount, fullTreeDeps),
          e(
            "ul",
            { className: "transitive-list site-tree full-tree-list" },
            formSubmitted &&
              (showFullTree
                ? renderNode(rootTreeNode, new Set())
                : emptyDependencyMessage(
                    dependencyListFilter === "vulnerable"
                      ? "No vulnerable dependencies in tree"
                      : dependencyListFilter === "unknown"
                        ? "No unresolved OSV dependencies in tree"
                      : "No dependencies",
                  )),
          ),
        ),
      ),
    );
  })();

  const versionSuggestionLimit = Math.min(
    latestVersions.length,
    MAX_SUGGESTED_VERSIONS,
  );
  const visibleVersionSuggestions = latestVersions.slice(
    0,
    Math.min(versionsToShow, versionSuggestionLimit),
  );
  const versionRiskBadgeLabel = (record) => {
    if (!record || (riskRank[record.risk] || 0) < riskRank.medium) return "";
    return { medium: "M", high: "H", critical: "C" }[record.risk] || "";
  };
  const versionRiskTitle = (versionValue, record) => {
    if (!record) return `Fetch ${versionValue}`;
    if (record.status === "checking") {
      return `Checking OSV advisories for ${versionValue}`;
    }
    if ((riskRank[record.risk] || 0) >= riskRank.medium) {
      const ids =
        record.cveIds && record.cveIds.length > 0
          ? record.cveIds
          : record.advisoryIds || [];
      const idText = ids.length > 0 ? `: ${ids.join(", ")}` : "";
      return `${versionValue} has ${record.risk} OSV risk from ${record.advisoryCount} advisories${idText}`;
    }
    if (record.status === "vulnerable") {
      return `${versionValue} has OSV advisories below medium severity`;
    }
    return `${versionValue} has no OSV advisory returned`;
  };
  const packageSuggestionCandidates =
    !packageSuggestionsSuppressed &&
    !version &&
    (packageTypeaheadOpen || !showVersionSuggestions)
      ? name
        ? nameSuggestions
        : namespace
          ? []
          : wellKnownPackages[manager] || []
      : [];
  const visiblePackageSuggestions = packageSuggestionCandidates.slice(
    0,
    PACKAGE_SUGGESTION_LIMIT,
  );
  const showPackageTypeahead =
    packageTypeaheadOpen && visiblePackageSuggestions.length > 0;
  const showPackageSuggestions =
    visiblePackageSuggestions.length > 0 && !showPackageTypeahead;
  const githubRepoPackages = githubRepoResult?.packages || [];
  const githubRepoUnsupportedPackages =
    githubRepoResult?.unsupported_packages || [];
  const githubRepoQuery = githubRepoFilter.trim().toLowerCase();
  const githubRepoShowingSkipped = githubRepoStatusFilter === "skipped";
  const githubRepoFilterMatchesPackage = (pkg) => {
    if (githubRepoStatusFilter === "all") return true;
    if (githubRepoStatusFilter === "skipped") return false;
    if (githubRepoStatusFilter.startsWith("manager:")) {
      return pkg.manager === githubRepoStatusFilter.slice("manager:".length);
    }
    if (githubRepoStatusFilter === "license-policy:needs-review") {
      return githubPackageLicensePolicy(pkg).status !== "permissive";
    }
    if (githubRepoStatusFilter.startsWith("license-policy:")) {
      return (
        githubPackageLicensePolicy(pkg).status ===
        githubRepoStatusFilter.slice("license-policy:".length)
      );
    }
    if (githubRepoStatusFilter === "license:missing") {
      return !githubPackageLicense(pkg);
    }
    if (githubRepoStatusFilter.startsWith("license:")) {
      return (
        githubPackageLicense(pkg) ===
        githubRepoStatusFilter.slice("license:".length)
      );
    }
    const key = githubRepoPackageKey(pkg);
    const identityKey = githubRepoPackageIdentityKey(pkg);
    const record =
      (key && githubRepoVulnStatus[key]) ||
      (identityKey && githubRepoVulnStatus[identityKey]) ||
      null;
    if (
      githubRepoStatusFilter === "vulnerable" ||
      githubRepoStatusFilter === "osv-findings"
    ) {
      return record?.status === "vulnerable";
    }
    if (githubRepoStatusFilter === "high") {
      return (
        record?.status === "vulnerable" &&
        (riskRank[record.risk] || 0) >= riskRank.high
      );
    }
    if (githubRepoStatusFilter === "checked") {
      return ["vulnerable", "no_advisory"].includes(record?.status);
    }
    return true;
  };
  const githubRepoStatusFilteredPackages = githubRepoPackages.filter(
    githubRepoFilterMatchesPackage,
  );
  const filteredGithubRepoPackages = githubRepoQuery
    ? githubRepoStatusFilteredPackages.filter((pkg) =>
        githubPackageSearchText(pkg).includes(githubRepoQuery),
      )
    : githubRepoStatusFilteredPackages;
  const filteredGithubRepoUnsupportedPackages = githubRepoShowingSkipped
    ? githubRepoQuery
      ? githubRepoUnsupportedPackages.filter((pkg) =>
          githubUnsupportedPackageSearchText(pkg).includes(githubRepoQuery),
        )
      : githubRepoUnsupportedPackages
    : [];
  const visibleGithubRepoPackages = filteredGithubRepoPackages.slice(0, 80);
  const visibleGithubRepoUnsupportedPackages =
    filteredGithubRepoUnsupportedPackages.slice(0, 80);
  const githubRepoActiveInventoryCount = githubRepoShowingSkipped
    ? filteredGithubRepoUnsupportedPackages.length
    : filteredGithubRepoPackages.length;
  const githubRepoPackagePanelShowsTree =
    githubRepoTransitiveLoading || Object.keys(githubRepoTransitiveDeps).length > 0;
  const githubRepoGraphPackageNodeId = (pkg, index) => {
    const key = githubRepoPackageKey(pkg);
    return `${key || `${pkg.manager || "pkg"}:${pkg.name || "dependency"}`}:${index}`;
  };
  const githubRepoGraphPackageSignature = filteredGithubRepoPackages
    .map(githubRepoGraphPackageNodeId)
    .join("\n");
  const githubRepoManagerCounts = githubRepoPackages.reduce((acc, pkg) => {
    acc[pkg.manager] = (acc[pkg.manager] || 0) + 1;
    return acc;
  }, {});
  const githubRepoLicenseCounts = githubRepoPackages.reduce((acc, pkg) => {
    const license = githubPackageLicense(pkg);
    if (license) acc[license] = (acc[license] || 0) + 1;
    return acc;
  }, {});
  const githubRepoLicensePolicyCounts = githubRepoPackages.reduce((acc, pkg) => {
    const policy = githubPackageLicensePolicy(pkg);
    acc[policy.status] = (acc[policy.status] || 0) + 1;
    return acc;
  }, {});
  const filteredGithubRepoLicensePolicyCounts = filteredGithubRepoPackages.reduce(
    (acc, pkg) => {
      const policy = githubPackageLicensePolicy(pkg);
      acc[policy.status] = (acc[policy.status] || 0) + 1;
      return acc;
    },
    {},
  );
  const githubRepoMissingLicenseCount =
    githubRepoLicensePolicyCounts.missing || 0;
  const githubRepoLicenseReviewCount =
    (githubRepoLicensePolicyCounts.copyleft || 0) +
    (githubRepoLicensePolicyCounts.review || 0) +
    githubRepoMissingLicenseCount;
  const filteredGithubRepoMissingLicenseCount =
    filteredGithubRepoLicensePolicyCounts.missing || 0;
  const filteredGithubRepoLicenseReviewCount =
    (filteredGithubRepoLicensePolicyCounts.copyleft || 0) +
    (filteredGithubRepoLicensePolicyCounts.review || 0) +
    filteredGithubRepoMissingLicenseCount;
  const githubRepoTopLicenses = Object.entries(githubRepoLicenseCounts)
    .sort(([aLicense, aCount], [bLicense, bCount]) => {
      if (bCount !== aCount) return bCount - aCount;
      return aLicense.localeCompare(bLicense);
    })
    .slice(0, 5);
  const selectedGithubRepoPackageKey = githubRepoPackageIdentityKey(
    selectedGithubRepoPackage,
  );
  const previewGithubRepoPackage =
    selectedGithubRepoPackage?.manager && selectedGithubRepoPackage?.name
      ? selectedGithubRepoPackage
      : null;
  const githubRepoHasExactVersion = (pkg) => {
    const versionValue = normalizeGithubRepoVersion(pkg?.version);
    return Boolean(
      pkg?.manager &&
        pkg?.name &&
        versionValue &&
        versionValue.toLowerCase() !== "latest" &&
        !/[<>=*|,\s^~]/.test(versionValue),
    );
  };
  const githubRepoDependencyApiUrl = (pkg, recursive = true) => {
    if (!githubRepoHasExactVersion(pkg)) return "";
    const enc = encodeURIComponent;
    const managerKey = pkg.manager;
    const versionValue = normalizeGithubRepoVersion(pkg.version);
    const base = `${apiOrigin}/api/dependencies/${enc(managerKey)}`;
    let path = "";
    if (managerKey === "go") {
      const modulePath = pkg.namespace ? `${pkg.namespace}/${pkg.name}` : pkg.name;
      path = `${base}/${modulePath.split("/").map(enc).join("/")}/${enc(versionValue)}`;
    } else {
      path = pkg.namespace
        ? `${base}/${enc(pkg.namespace)}/${enc(pkg.name)}/${enc(versionValue)}`
        : `${base}/${enc(pkg.name)}/${enc(versionValue)}`;
    }
    return `${path}?recursive=${recursive ? "true" : "false"}&vuln=false&scorecard=false`;
  };
  const githubRepoPackageFromFormattedName = (managerKey, packageName, versionValue) => {
    const parsed = splitDeepLinkName(managerKey, "", packageName);
    return {
      manager: managerKey,
      namespace: parsed.namespace || "",
      name: parsed.name || packageName,
      version: versionValue || "",
      display: packageName,
    };
  };
  const githubRepoPackageBomRef = (pkg) =>
    pkg?.purl ||
    packagePurl(
      pkg?.manager,
      githubPackageLabel(pkg),
      pkg?.version || "",
    );
  const githubRepoPackageBriefLabel = (pkg) => {
    const versionValue = pkg.version ? `@${pkg.version}` : "";
    const managerLabel = pmDisplayNames[pkg.manager] || pkg.manager || "package";
    return `${githubPackageLabel(pkg)}${versionValue} (${managerLabel})`;
  };
  const githubRepoDependencyPaths = (expansion, depName, rootPkg, limit = 8) => {
    if (!expansion || !depName) return [];
    const dependencies = expansion.dependencies || {};
    const parents = expansion.parents || {};
    const rootName = expansion.rootPackageName || "";
    const rootLabel = githubRepoPackageBriefLabel(rootPkg);
    const managerKey = expansion.manager || rootPkg?.manager || "";
    const labelName = (name) => {
      if (!name || name === rootName) return rootLabel;
      return githubRepoPackageBriefLabel(
        githubRepoPackageFromFormattedName(
          managerKey,
          name,
          dependencies[name] || "",
        ),
      );
    };
    const pathLabels = new Set();
    const walk = (name, chain, seen) => {
      if (pathLabels.size >= limit) return;
      const rawParents = parents[name];
      const parentValues = (
        Array.isArray(rawParents) ? rawParents : [rawParents || ""]
      )
        .filter((parentName, index, values) => values.indexOf(parentName) === index)
        .sort((a, b) => String(a || "").localeCompare(String(b || "")));
      const candidates = parentValues.length > 0 ? parentValues : [""];
      candidates.forEach((parentName) => {
        if (pathLabels.size >= limit) return;
        if (
          !parentName ||
          parentName === rootName ||
          dependencies[parentName] === undefined
        ) {
          pathLabels.add([rootLabel, ...chain.map(labelName)].join(" > "));
          return;
        }
        if (seen.has(parentName)) {
          pathLabels.add(
            [rootLabel, ...[parentName, ...chain].map(labelName)].join(" > "),
          );
          return;
        }
        walk(parentName, [parentName, ...chain], new Set([...seen, parentName]));
      });
    };
    walk(depName, [depName], new Set([depName]));
    return Array.from(pathLabels);
  };
  const githubRepoTransitiveRootCandidates = filteredGithubRepoPackages.filter(
    (pkg) => githubRepoDependencyApiUrl(pkg),
  );
  const githubRepoAllRootCandidates = githubRepoPackages.filter((pkg) =>
    githubRepoDependencyApiUrl(pkg),
  );
  const githubRepoFilteredResolvedRootCount =
    githubRepoTransitiveRootCandidates.filter((pkg) =>
      Boolean(githubRepoTransitiveDeps[githubRepoPackageKey(pkg)]),
    ).length;
  const githubRepoFilteredRootCount = githubRepoTransitiveRootCandidates.length;
  const githubRepoVisibleRootKeys = new Set(
    filteredGithubRepoPackages.map(githubRepoPackageKey).filter(Boolean),
  );
  const githubRepoResolvedProjectRootCount = githubRepoAllRootCandidates.filter(
    (pkg) => Boolean(githubRepoTransitiveDeps[githubRepoPackageKey(pkg)]),
  ).length;
  const githubRepoProjectRootCount = githubRepoAllRootCandidates.length;
  const githubRepoProjectResolutionComplete =
    githubRepoProjectRootCount > 0 &&
    githubRepoResolvedProjectRootCount >= githubRepoProjectRootCount;
  const githubRepoTransitiveSummary = Object.entries(githubRepoTransitiveDeps)
    .filter(([rootKey]) => githubRepoVisibleRootKeys.has(rootKey))
    .reduce(
      (summary, [, data]) => {
        if (data?.failed) {
          summary.failedRoots += 1;
          return summary;
        }
        summary.resolvedRoots += 1;
        Object.entries(data?.dependencies || {}).forEach(([depName, depVersion]) => {
          const nodeId = `transitive:${data.manager}:${depName}@${depVersion || ""}`;
          summary.nodeIds.add(nodeId);
        });
        return summary;
      },
      { resolvedRoots: 0, failedRoots: 0, nodeIds: new Set() },
    );
  const githubRepoTransitiveNodeCount = githubRepoTransitiveSummary.nodeIds.size;
  const githubRepoTransitiveExportRecords = filteredGithubRepoPackages.flatMap(
    (rootPkg) => {
      const rootKey = githubRepoPackageKey(rootPkg);
      const expansion = rootKey ? githubRepoTransitiveDeps[rootKey] : null;
      if (!expansion || expansion.failed) return [];
      const dependencies = expansion.dependencies || {};
      const parents = expansion.parents || {};
      return Object.entries(dependencies)
        .filter(([depName]) => depName && depName !== expansion.rootPackageName)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([depName, depVersion]) => {
          const depPkg = githubRepoPackageFromFormattedName(
            expansion.manager,
            depName,
            depVersion,
          );
          const parentValues = Array.isArray(parents[depName])
            ? parents[depName]
            : [parents[depName] || ""];
          const parentPackages = parentValues.map((parentName) => {
            if (
              parentName &&
              parentName !== expansion.rootPackageName &&
              dependencies[parentName] !== undefined
            ) {
              return githubRepoPackageFromFormattedName(
                expansion.manager,
                parentName,
                dependencies[parentName],
              );
            }
            return rootPkg;
          });
          return {
            pkg: depPkg,
            rootPkg,
            rootPackage: githubRepoPackageBriefLabel(rootPkg),
            parentPackages,
            dependencyPaths: githubRepoDependencyPaths(
              expansion,
              depName,
              rootPkg,
            ),
          };
        });
    },
  );
  const githubRepoTransitiveExportRootCount = new Set(
    githubRepoTransitiveExportRecords
      .map(
        (record) =>
          githubRepoPackageIdentityKey(record.rootPkg) ||
          githubRepoPackageKey(record.rootPkg),
      )
      .filter(Boolean),
  ).size;
  const githubRepoExportCoverageLabel =
    githubRepoTransitiveExportRecords.length === 0
      ? "Direct inventory"
      : githubRepoProjectResolutionComplete
        ? "Full chain export"
        : "Partial chain export";
  const githubRepoGraphNodeCount =
    filteredGithubRepoPackages.length + githubRepoTransitiveNodeCount;
  const githubRepoTransitiveGraphSignature = Object.entries(githubRepoTransitiveDeps)
    .filter(([rootKey]) => githubRepoVisibleRootKeys.has(rootKey))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rootKey, data]) => {
      const depsSignature = Object.entries(data?.dependencies || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([depName, depVersion]) => `${depName}@${depVersion || ""}`)
        .join(",");
      return `${rootKey}:${data?.failed ? "failed" : depsSignature}`;
    })
    .join("\n");
  const githubRepoPackageOsvTarget = (pkg) => {
    const versionValue = normalizeGithubRepoVersion(pkg?.version);
    if (!githubRepoHasExactVersion(pkg)) {
      return null;
    }
    const packageName = formatPackage(
      pkg.manager,
      pkg.namespace || "",
      pkg.name,
    );
    if (!packageName) return null;
    return {
      manager: pkg.manager,
      packageName,
      version: versionValue,
    };
  };
  const githubRepoPackageVulnRecord = (pkg) => {
    const key = githubRepoPackageKey(pkg);
    const identityKey = githubRepoPackageIdentityKey(pkg);
    return (
      (key && githubRepoVulnStatus[key]) ||
      (identityKey && githubRepoVulnStatus[identityKey]) ||
      null
    );
  };
  const githubRepoPackageRiskClass = (record) =>
    record?.status === "vulnerable"
      ? ` repo-risk-${record.risk || "advisory"}`
      : "";
  const githubRepoRiskPalette = appearanceMode === "dark"
    ? {
        critical: { fill: "#7f1d1d", stroke: "#f87171" },
        high: { fill: "#7f1d1d", stroke: "#fb7185" },
        medium: { fill: "#78350f", stroke: "#fbbf24" },
        low: { fill: "#064e3b", stroke: "#34d399" },
        advisory: { fill: "#334155", stroke: "#fbbf24" },
      }
    : {
        critical: { fill: "#fee2e2", stroke: "#b42318" },
        high: { fill: "#ffe4e6", stroke: "#c93737" },
        medium: { fill: "#fff4d6", stroke: "#b56b00" },
        low: { fill: "#e4f8ef", stroke: "#168a56" },
        advisory: { fill: "#f1f5f9", stroke: "#8a6a12" },
      };
  const githubRepoRiskStyle = (record) =>
    record?.status === "vulnerable"
      ? githubRepoRiskPalette[record.risk || "advisory"] ||
        githubRepoRiskPalette.advisory
      : null;
  const githubRepoGraphNodeClassName = (d, record) =>
    [
      "repo-graph-node",
      d.root && "root",
      d.managerGroup && "manager",
      d.pkg && "package",
      d.transitiveDep && "transitive",
      d.pkg && record?.status === "vulnerable" && "vulnerable",
      d.pkg &&
        record?.status === "vulnerable" &&
        `risk-${record.risk || "advisory"}`,
      d.selected && "selected",
    ]
      .filter(Boolean)
      .join(" ");
  const githubRepoGraphPackageFill = (d, record) => {
    const riskStyle = githubRepoRiskStyle(record);
    if (riskStyle) return riskStyle.fill;
    if (d.selected) return appearanceMode === "dark" ? "#fbbf24" : "#b45309";
    return appearanceMode === "dark" ? "#1d2a36" : "#ffffff";
  };
  const githubRepoGraphPackageStroke = (d, record) => {
    const riskStyle = githubRepoRiskStyle(record);
    if (riskStyle) return riskStyle.stroke;
    if (d.selected) return appearanceMode === "dark" ? "#fde68a" : "#92400e";
    return appearanceMode === "dark" ? "#8ba3b5" : "#7a8a9a";
  };
  const githubRepoGraphPackageStrokeWidth = (d, record) =>
    d.selected ? 3 : record?.status === "vulnerable" ? 2.4 : 1.8;
  const githubRepoScoreLabel = (score) => {
    const value = Number(score) || 0;
    if (value <= 0) return "";
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };
  const githubRepoRiskLabel = (record) => {
    if (!record) return "";
    if (record.status === "vulnerable") {
      const scoreText = githubRepoScoreLabel(record.score);
      const severityText = record.risk || "advisory";
      return `${severityText}${scoreText ? ` ${scoreText}` : ""}`;
    }
    if (record.status === "no_advisory") return "No OSV advisory";
    if (record.status === "not_checked") return "OSV not checked";
    if (record.status === "unknown") return "OSV unresolved";
    return "";
  };
  const ensureGithubRepoPackageOsvStatuses = async (
    packages,
    signal,
    onProgress,
  ) => {
    const groupedChecks = new Map();
    const immediateStatus = {};
    packages.forEach((pkg) => {
      const target = githubRepoPackageOsvTarget(pkg);
      if (!target) return;
      const keys = [
        githubRepoPackageKey(pkg),
        githubRepoPackageIdentityKey(pkg),
      ].filter(Boolean);
      if (keys.length === 0) return;
      const cacheKey = versionRiskKey(
        target.manager,
        target.packageName,
        target.version,
      );
      const cached =
        versionRiskCacheRef.current.get(cacheKey) ||
        keys.map((key) => githubRepoVulnStatus[key]).find(Boolean);
      if (cached) {
        keys.forEach((key) => {
          immediateStatus[key] = cached;
        });
        return;
      }
      if (!groupedChecks.has(cacheKey)) {
        groupedChecks.set(cacheKey, {
          ...target,
          cacheKey,
          keys: new Set(),
        });
      }
      keys.forEach((key) => groupedChecks.get(cacheKey).keys.add(key));
    });

    if (Object.keys(immediateStatus).length > 0) {
      setGithubRepoVulnStatus((prev) => ({ ...prev, ...immediateStatus }));
    }

    const checks = Array.from(groupedChecks.values());
    if (checks.length === 0) {
      return { checked: 0, vulnerable: 0 };
    }

    let checked = 0;
    let vulnerable = 0;
    const accumulatedStatus = {};
    await mapLimit(checks, 6, async (item) => {
      if (signal?.aborted) return null;
      const result = await queryOsvVulns(
        item.manager,
        item.packageName,
        item.version,
      );
      if (signal?.aborted) return null;
      const status = result.status || {};
      let record;
      if (status.status === "vulnerable" || status.status === "no_advisory") {
        record = summarizeVersionRisk(result.vulns || []);
        versionRiskCacheRef.current.set(item.cacheKey, record);
      } else {
        record = {
          status: status.status || "unknown",
          score: 0,
          risk: null,
          advisoryCount: 0,
          advisoryIds: [],
          cveIds: [],
          error: status.error || "",
        };
      }
      if (record.status === "vulnerable") vulnerable += 1;
      item.keys.forEach((key) => {
        accumulatedStatus[key] = record;
      });
      checked += 1;
      if (checked % 20 === 0) {
        setGithubRepoVulnStatus((prev) => ({ ...prev, ...accumulatedStatus }));
      }
      if (onProgress) onProgress(checked, checks.length, vulnerable);
      return record;
    });

    if (!signal?.aborted) {
      setGithubRepoVulnStatus((prev) => ({ ...prev, ...accumulatedStatus }));
    }
    return { checked, vulnerable };
  };
  const githubRepoVulnRecordsForPackages = (packages) =>
    Array.from(
      packages
      .reduce((records, pkg) => {
        const key = githubRepoPackageIdentityKey(pkg) || githubRepoPackageKey(pkg);
        const record = githubRepoPackageVulnRecord(pkg);
        if (key && record) records.set(key, record);
        return records;
      }, new Map())
      .values(),
    );
  const githubRepoVulnRecords = githubRepoVulnRecordsForPackages(
    githubRepoPackages,
  );
  const filteredGithubRepoVulnRecords = githubRepoVulnRecordsForPackages(
    filteredGithubRepoPackages,
  );
  const githubRepoCheckedCount = githubRepoVulnRecords.filter((record) =>
    ["vulnerable", "no_advisory"].includes(record.status),
  ).length;
  const githubRepoVulnerableCount = githubRepoVulnRecords.filter(
    (record) => record.status === "vulnerable",
  ).length;
  const githubRepoHighRiskCount = githubRepoVulnRecords.filter(
    (record) =>
      record.status === "vulnerable" &&
      (riskRank[record.risk] || 0) >= riskRank.high,
  ).length;
  const filteredGithubRepoCheckedCount = filteredGithubRepoVulnRecords.filter(
    (record) => ["vulnerable", "no_advisory"].includes(record.status),
  ).length;
  const filteredGithubRepoVulnerableCount = filteredGithubRepoVulnRecords.filter(
    (record) => record.status === "vulnerable",
  ).length;
  const filteredGithubRepoHighRiskCount = filteredGithubRepoVulnRecords.filter(
    (record) =>
      record.status === "vulnerable" &&
      (riskRank[record.risk] || 0) >= riskRank.high,
  ).length;
  const githubRepoCycloneDxComponent = (
    pkg,
    scope = "direct",
    extraProperties = [],
  ) => {
    const displayName = githubPackageLabel(pkg);
    const purl = githubRepoPackageBomRef(pkg);
    const licensePolicy = githubPackageLicensePolicy(pkg);
    const component = {
      type: "library",
      "bom-ref": purl,
      name: pkg.name || displayName,
      version: String(pkg.version || ""),
      purl,
      properties: [
        {
          name: "oss-deps-explorer:package-manager",
          value: pkg.manager || "",
        },
        {
          name: "oss-deps-explorer:dependency-scope",
          value: scope,
        },
        {
          name: "oss-deps-explorer:osv-status",
          value: githubRepoPackageVulnRecord(pkg)?.status || "not_checked",
        },
        {
          name: "oss-deps-explorer:license-policy",
          value: licensePolicy.status,
        },
        {
          name: "oss-deps-explorer:license-policy-detail",
          value: licensePolicy.detail,
        },
      ],
    };
    component.properties.push(...extraProperties);
    if (pkg.namespace) component.group = pkg.namespace;
    const license = githubPackageLicense(pkg);
    if (license) {
      component.licenses = [{ expression: license }];
    }
    if (pkg.license_concluded) {
      component.properties.push({
        name: "github:sbom:licenseConcluded",
        value: pkg.license_concluded,
      });
    }
    if (pkg.license_declared) {
      component.properties.push({
        name: "github:sbom:licenseDeclared",
        value: pkg.license_declared,
      });
    }
    if (pkg.spdx_id) {
      component.properties.push({
        name: "github:sbom:spdx-id",
        value: pkg.spdx_id,
      });
    }
    return component;
  };

  const buildGithubRepoCycloneDxBom = () => {
    const serial =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rootBomRef = `repository:${githubRepoResult?.repository || "repository"}`;
    const componentMap = new Map();
    const dependencyMap = new Map([[rootBomRef, new Set()]]);
    const ensureDependencyRef = (ref) => {
      if (!dependencyMap.has(ref)) dependencyMap.set(ref, new Set());
      return dependencyMap.get(ref);
    };
    const mergeComponentProperties = (target, incoming) => {
      const seen = new Set(
        (target.properties || []).map((prop) => `${prop.name}\u0000${prop.value}`),
      );
      (incoming.properties || []).forEach((prop) => {
        const key = `${prop.name}\u0000${prop.value}`;
        if (seen.has(key)) return;
        target.properties.push(prop);
        seen.add(key);
      });
      if (!target.licenses && incoming.licenses) {
        target.licenses = incoming.licenses;
      }
    };
    const addComponent = (pkg, scope = "direct", extraProperties = []) => {
      const component = githubRepoCycloneDxComponent(
        pkg,
        scope,
        extraProperties,
      );
      const ref = component["bom-ref"];
      if (componentMap.has(ref)) {
        mergeComponentProperties(componentMap.get(ref), component);
      } else {
        componentMap.set(ref, component);
      }
      ensureDependencyRef(ref);
      return ref;
    };
    const directRefs = filteredGithubRepoPackages.map((pkg) =>
      addComponent(pkg, "direct"),
    );
    directRefs.forEach((ref) => ensureDependencyRef(rootBomRef).add(ref));
    githubRepoTransitiveExportRecords.forEach((record) => {
      const sourceRootProperty = {
        name: "oss-deps-explorer:source-root",
        value: record.rootPackage,
      };
      const dependencyPathProperties = (record.dependencyPaths || []).map(
        (path) => ({
          name: "oss-deps-explorer:dependency-path",
          value: path,
        }),
      );
      const depRef = addComponent(record.pkg, "transitive", [
        sourceRootProperty,
        ...dependencyPathProperties,
      ]);
      const parentPackages =
        record.parentPackages && record.parentPackages.length > 0
          ? record.parentPackages
          : [record.rootPkg];
      parentPackages.forEach((parentPkg) => {
        const parentIsRoot =
          githubRepoPackageIdentityKey(parentPkg) ===
          githubRepoPackageIdentityKey(record.rootPkg);
        const parentRef = addComponent(
          parentPkg,
          parentIsRoot ? "direct" : "transitive",
          parentIsRoot ? [] : [sourceRootProperty],
        );
        ensureDependencyRef(parentRef).add(depRef);
      });
    });
    const components = Array.from(componentMap.values()).sort((a, b) =>
      a["bom-ref"].localeCompare(b["bom-ref"]),
    );
    const dependencies = Array.from(dependencyMap.entries())
      .map(([ref, dependsOn]) => ({
        ref,
        dependsOn: Array.from(dependsOn).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.ref.localeCompare(b.ref));
    const vulnerabilities = [];
    const vulnerabilityKeys = new Set();
    const addVulnerabilitiesForPackage = (pkg, componentRef) => {
      const record = githubRepoPackageVulnRecord(pkg);
      if (!record || record.status !== "vulnerable") return;
      (record.advisoryIds || []).forEach((id) => {
        const key = `${id}\u0000${componentRef}`;
        if (vulnerabilityKeys.has(key)) return;
        vulnerabilityKeys.add(key);
        const vulnerability = {
          "bom-ref": `vulnerability:${id}:${componentRef}`,
          id,
          source: {
            name: "OSV",
            url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}`,
          },
          affects: [{ ref: componentRef }],
        };
        if (record.score > 0) {
          vulnerability.ratings = [
            {
              score: record.score,
              severity: record.risk || riskFromScore(record.score) || "unknown",
              method: "other",
              source: { name: "OSV" },
            },
          ];
        }
        vulnerabilities.push(vulnerability);
      });
    };
    filteredGithubRepoPackages.forEach((pkg) => {
      const ref = githubRepoPackageBomRef(pkg);
      addVulnerabilitiesForPackage(pkg, ref);
    });
    githubRepoTransitiveExportRecords.forEach((record) => {
      const ref = githubRepoPackageBomRef(record.pkg);
      addVulnerabilitiesForPackage(record.pkg, ref);
    });
    return {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: `urn:uuid:${serial}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: {
          components: [
            {
              type: "application",
              name: "OSS Dependency Explorer",
            },
          ],
        },
        component: {
          type: "application",
          "bom-ref": rootBomRef,
          name: githubRepoResult?.repository || "GitHub repository import",
        },
      },
      components,
      dependencies,
      vulnerabilities,
      properties: [
        {
          name: "oss-deps-explorer:repository",
          value: githubRepoResult?.repository || "",
        },
        {
          name: "oss-deps-explorer:filtered-package-count",
          value: String(filteredGithubRepoPackages.length),
        },
        {
          name: "oss-deps-explorer:filtered-transitive-package-count",
          value: String(githubRepoTransitiveExportRecords.length),
        },
        {
          name: "oss-deps-explorer:filtered-resolved-root-count",
          value: String(githubRepoFilteredResolvedRootCount),
        },
        {
          name: "oss-deps-explorer:total-package-count",
          value: String(githubRepoPackages.length),
        },
      ],
    };
  };

  const githubRepoExportBaseName = () =>
    String(githubRepoResult?.repository || "repository")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "repository";

  const githubRepoActiveFilterLabel = () => {
    let label = "all supported packages";
    if (githubRepoStatusFilter === "skipped") {
      label = "skipped dependencies";
    } else if (githubRepoStatusFilter === "license-policy:needs-review") {
      label = "license review packages";
    } else if (githubRepoStatusFilter.startsWith("license-policy:")) {
      label = `${githubRepoStatusFilter.slice("license-policy:".length)} license policy`;
    } else if (githubRepoStatusFilter === "license:missing") {
      label = "missing license";
    } else if (githubRepoStatusFilter.startsWith("license:")) {
      label = `${githubRepoStatusFilter.slice("license:".length)} license`;
    } else if (githubRepoStatusFilter.startsWith("manager:")) {
      const mgr = githubRepoStatusFilter.slice("manager:".length);
      label = `${pmDisplayNames[mgr] || mgr} packages`;
    } else if (githubRepoStatusFilter === "vulnerable") {
      label = "vulnerable packages";
    } else if (githubRepoStatusFilter === "osv-findings") {
      label = "OSV findings";
    } else if (githubRepoStatusFilter === "high") {
      label = "high or critical findings";
    } else if (githubRepoStatusFilter === "checked") {
      label = "OSV checked packages";
    } else if (githubRepoStatusFilter !== "all") {
      label = githubRepoStatusFilter;
    }
    const query = githubRepoFilter.trim();
    return query ? `${label} matching "${query}"` : label;
  };

  const buildGithubRepoSkippedDependencyQueue = () => {
    const skippedDependencies = filteredGithubRepoUnsupportedPackages.map((pkg) => ({
      display: githubUnsupportedPackageLabel(pkg),
      name: pkg.name || "",
      version: pkg.version || "",
      purl: pkg.purl || "",
      spdx_id: pkg.spdx_id || "",
      license: githubPackageLicense(pkg) || "",
      license_concluded: pkg.license_concluded || "",
      license_declared: pkg.license_declared || "",
      external_refs: pkg.external_refs || [],
      skipped_reason: "unsupported package URL or ecosystem",
    }));
    return {
      schema: "oss-deps-explorer/skipped-dependency-queue/v1",
      repository: githubRepoResult?.repository || "",
      source: githubRepoResult?.source || "github_dependency_graph_sbom",
      generated_at: new Date().toISOString(),
      active_filter: {
        label: githubRepoActiveFilterLabel(),
        query: githubRepoFilter.trim(),
      },
      total_skipped_count: githubRepoUnsupportedPackages.length,
      filtered_skipped_count: skippedDependencies.length,
      skipped_dependencies: skippedDependencies,
    };
  };

  const buildGithubRepoAuditBrief = () => {
    if (githubRepoShowingSkipped) {
      const rows = filteredGithubRepoUnsupportedPackages.slice(0, 15);
      const extra = filteredGithubRepoUnsupportedPackages.length - rows.length;
      const lines = [
        `# OSS dependency skipped-item brief: ${githubRepoResult?.repository || "repository"}`,
        "",
        "- Source: GitHub dependency graph SBOM",
        `- Active view: skipped dependencies matching ${githubRepoFilter.trim() ? `"${githubRepoFilter.trim()}"` : "all skipped items"}`,
        `- Skipped dependencies: ${formatNumber(filteredGithubRepoUnsupportedPackages.length)} of ${formatNumber(githubRepoUnsupportedPackages.length)}`,
        "",
        "## Skipped dependency queue",
      ];
      if (rows.length === 0) {
        lines.push("- No skipped dependencies match the active filter.");
      } else {
        rows.forEach((pkg) => {
          const license = githubPackageLicense(pkg) || "Missing SPDX";
          const refs = (pkg.external_refs || []).slice(0, 2).join(", ");
          lines.push(
            `- ${githubUnsupportedPackageLabel(pkg)}${pkg.version ? `@${pkg.version}` : ""} - ${license}${refs ? `; refs: ${refs}` : ""}`,
          );
        });
        if (extra > 0) {
          lines.push(`- ${formatNumber(extra)} additional skipped dependencies hidden.`);
        }
      }
      lines.push(
        "",
        "## Follow-up",
        "- Review skipped package URLs or ecosystems before treating the imported graph as complete.",
      );
      return `${lines.join("\n")}\n`;
    }
    const reviewRows = filteredGithubRepoPackages
      .map((pkg) => ({
        pkg,
        policy: githubPackageLicensePolicy(pkg),
      }))
      .filter(({ policy }) => policy.status !== "permissive")
      .sort((a, b) => {
        const policyRank = { copyleft: 4, review: 3, missing: 2, permissive: 1 };
        return (
          (policyRank[b.policy.status] || 0) -
            (policyRank[a.policy.status] || 0) ||
          githubPackageLabel(a.pkg).localeCompare(githubPackageLabel(b.pkg))
        );
      })
      .slice(0, 10);
    const vulnerableRows = filteredGithubRepoPackages
      .map((pkg) => ({ pkg, record: githubRepoPackageVulnRecord(pkg) }))
      .filter(({ record }) => record?.status === "vulnerable")
      .sort(
        (a, b) =>
          (riskRank[b.record.risk] || 0) - (riskRank[a.record.risk] || 0) ||
          (Number(b.record.score) || 0) - (Number(a.record.score) || 0) ||
          githubPackageLabel(a.pkg).localeCompare(githubPackageLabel(b.pkg)),
      )
      .slice(0, 10);
    const licenseProjectSuffix =
      filteredGithubRepoPackages.length === githubRepoPackages.length
        ? ""
        : `; project total ${formatNumber(githubRepoLicenseReviewCount)}`;
    const osvProjectSuffix =
      filteredGithubRepoPackages.length === githubRepoPackages.length
        ? ""
        : `; project total ${formatNumber(githubRepoVulnerableCount)} vulnerable, ${formatNumber(githubRepoHighRiskCount)} high or critical`;
    const chainProjectSuffix =
      githubRepoFilteredRootCount === githubRepoProjectRootCount
        ? ""
        : `; project total ${formatNumber(githubRepoResolvedProjectRootCount)} of ${formatNumber(githubRepoProjectRootCount)} roots resolved`;
    const lines = [
      `# OSS dependency brief: ${githubRepoResult?.repository || "repository"}`,
      "",
      `- Source: GitHub dependency graph SBOM`,
      `- Active view: ${githubRepoActiveFilterLabel()}; ${formatNumber(filteredGithubRepoPackages.length)} of ${formatNumber(githubRepoPackages.length)} supported packages`,
      `- Unsupported packages: ${formatNumber(githubRepoResult?.unsupported_count || 0)}`,
      `- License review: ${formatNumber(filteredGithubRepoLicenseReviewCount)} in active view (${formatNumber(filteredGithubRepoLicensePolicyCounts.copyleft || 0)} copyleft, ${formatNumber(filteredGithubRepoMissingLicenseCount)} missing, ${formatNumber(filteredGithubRepoLicensePolicyCounts.review || 0)} review)${licenseProjectSuffix}`,
      `- OSV status: ${formatNumber(filteredGithubRepoCheckedCount)} checked in active view, ${formatNumber(filteredGithubRepoVulnerableCount)} vulnerable, ${formatNumber(filteredGithubRepoHighRiskCount)} high or critical${osvProjectSuffix}`,
      `- Dependency chain: ${formatNumber(githubRepoFilteredResolvedRootCount)} of ${formatNumber(githubRepoFilteredRootCount)} active package roots resolved, ${formatNumber(githubRepoTransitiveNodeCount)} transitive nodes, ${formatNumber(githubRepoTransitiveSummary.failedRoots)} failed roots${chainProjectSuffix}`,
      "",
      "## License review queue",
    ];
    if (reviewRows.length === 0) {
      lines.push("- No non-permissive or missing-license packages in the active view.");
    } else {
      reviewRows.forEach(({ pkg, policy }) => {
        lines.push(
          `- ${githubRepoPackageBriefLabel(pkg)} - ${githubPackageLicense(pkg) || "Missing SPDX"} (${policy.label})`,
        );
      });
      const extraReview =
        filteredGithubRepoPackages.filter(
          (pkg) => githubPackageLicensePolicy(pkg).status !== "permissive",
        ).length - reviewRows.length;
      if (extraReview > 0) {
        lines.push(`- ${formatNumber(extraReview)} additional review packages hidden.`);
      }
    }
    lines.push("", "## OSV findings");
    if (vulnerableRows.length === 0) {
      lines.push("- No vulnerable packages in the active view.");
    } else {
      vulnerableRows.forEach(({ pkg, record }) => {
        const ids = (record.advisoryIds || []).slice(0, 4).join(", ");
        const scoreText = record.score ? ` score ${record.score}` : "";
        lines.push(
          `- ${githubRepoPackageBriefLabel(pkg)} - ${record.risk || "advisory"}${scoreText}, ${record.advisoryCount || 0} advisories${ids ? `: ${ids}` : ""}`,
        );
      });
      const extraVulnerable =
        filteredGithubRepoPackages.filter(
          (pkg) => githubRepoPackageVulnRecord(pkg)?.status === "vulnerable",
        ).length - vulnerableRows.length;
      if (extraVulnerable > 0) {
        lines.push(`- ${formatNumber(extraVulnerable)} additional vulnerable packages hidden.`);
      }
    }
    lines.push("", "## Follow-up");
    if (filteredGithubRepoLicenseReviewCount > 0) {
      lines.push("- Review active-view non-permissive, custom, or missing SPDX license metadata.");
    }
    if (filteredGithubRepoHighRiskCount > 0) {
      lines.push("- Prioritize active-view high and critical OSV findings before release.");
    }
    if (githubRepoFilteredResolvedRootCount < githubRepoFilteredRootCount) {
      lines.push("- Build the active-view dependency chain before architecture handoff.");
    }
    if (
      filteredGithubRepoLicenseReviewCount === 0 &&
      filteredGithubRepoHighRiskCount === 0 &&
      githubRepoFilteredResolvedRootCount >= githubRepoFilteredRootCount
    ) {
      lines.push("- No immediate active-view license or high-risk OSV follow-up identified.");
    }
    return `${lines.join("\n")}\n`;
  };

  const copyGithubRepoAuditBrief = async () => {
    if (!githubRepoResult || githubRepoActiveInventoryCount === 0) return;
    setGithubRepoBriefStatus("Copying...");
    if (githubRepoBriefStatusTimerRef.current) {
      clearTimeout(githubRepoBriefStatusTimerRef.current);
    }
    const copied = await copyTextToClipboard(buildGithubRepoAuditBrief());
    setGithubRepoBriefStatus(copied ? "Brief copied" : "Copy failed");
    githubRepoBriefStatusTimerRef.current = setTimeout(() => {
      setGithubRepoBriefStatus("");
      githubRepoBriefStatusTimerRef.current = null;
    }, 1800);
  };

  const exportGithubRepoAuditBrief = () => {
    if (!githubRepoResult || githubRepoActiveInventoryCount === 0) return;
    downloadText(
      `${githubRepoExportBaseName()}-audit-brief.md`,
      "text/markdown",
      buildGithubRepoAuditBrief(),
    );
    if (githubRepoBriefStatusTimerRef.current) {
      clearTimeout(githubRepoBriefStatusTimerRef.current);
    }
    setGithubRepoBriefStatus("Brief exported");
    githubRepoBriefStatusTimerRef.current = setTimeout(() => {
      setGithubRepoBriefStatus("");
      githubRepoBriefStatusTimerRef.current = null;
    }, 1800);
  };

  const exportGithubRepoSbom = () => {
    if (!githubRepoResult || filteredGithubRepoPackages.length === 0) return;
    downloadText(
      `${githubRepoExportBaseName()}-cyclonedx.json`,
      "application/vnd.cyclonedx+json",
      JSON.stringify(buildGithubRepoCycloneDxBom(), null, 2),
    );
  };

  const exportGithubRepoSkippedJson = () => {
    if (!githubRepoResult || filteredGithubRepoUnsupportedPackages.length === 0) {
      return;
    }
    downloadText(
      `${githubRepoExportBaseName()}-skipped-dependencies.json`,
      "application/json",
      JSON.stringify(buildGithubRepoSkippedDependencyQueue(), null, 2),
    );
  };

  const exportGithubRepoInventory = () => {
    if (!githubRepoResult) return;
    if (githubRepoShowingSkipped) {
      if (filteredGithubRepoUnsupportedPackages.length === 0) return;
      const rows = [
        [
          "repository",
          "name",
          "version",
          "purl",
          "license",
          "license_concluded",
          "license_declared",
          "spdx_id",
          "external_refs",
          "skipped_reason",
        ],
        ...filteredGithubRepoUnsupportedPackages.map((pkg) => [
          githubRepoResult.repository || "",
          pkg.name || githubUnsupportedPackageLabel(pkg),
          pkg.version || "",
          pkg.purl || "",
          githubPackageLicense(pkg),
          pkg.license_concluded || "",
          pkg.license_declared || "",
          pkg.spdx_id || "",
          (pkg.external_refs || []).join(";"),
          "unsupported package URL or ecosystem",
        ]),
      ];
      downloadText(
        `${githubRepoExportBaseName()}-skipped-dependencies.csv`,
        "text/csv",
        rows.map((row) => row.map(csvValue).join(",")).join("\n"),
      );
      return;
    }
    if (filteredGithubRepoPackages.length === 0) return;
    const rows = [
      [
        "repository",
        "manager",
        "namespace",
        "name",
        "version",
        "purl",
        "license",
        "license_concluded",
        "license_declared",
        "license_policy",
        "license_policy_detail",
        "osv_status",
        "risk",
        "score",
        "advisory_count",
        "advisory_ids",
        "dependency_scope",
        "root_package",
        "direct_parents",
        "dependency_paths",
      ],
      ...filteredGithubRepoPackages.map((pkg) => {
        const record = githubRepoPackageVulnRecord(pkg);
        const licensePolicy = githubPackageLicensePolicy(pkg);
        return [
          githubRepoResult.repository || "",
          pkg.manager || "",
          pkg.namespace || "",
          pkg.name || "",
          pkg.version || "",
          pkg.purl || "",
          githubPackageLicense(pkg),
          pkg.license_concluded || "",
          pkg.license_declared || "",
          licensePolicy.status,
          licensePolicy.detail,
          record?.status || "not_checked",
          record?.risk || "",
          record?.score ?? "",
          record?.advisoryCount ?? "",
          (record?.advisoryIds || []).join(";"),
          "direct",
          "",
          "",
          "",
        ];
      }),
      ...githubRepoTransitiveExportRecords.map((record) => {
        const pkg = record.pkg;
        const vulnRecord = githubRepoPackageVulnRecord(pkg);
        const licensePolicy = githubPackageLicensePolicy(pkg);
        return [
          githubRepoResult.repository || "",
          pkg.manager || "",
          pkg.namespace || "",
          pkg.name || "",
          pkg.version || "",
          githubRepoPackageBomRef(pkg),
          githubPackageLicense(pkg),
          pkg.license_concluded || "",
          pkg.license_declared || "",
          licensePolicy.status,
          licensePolicy.detail,
          vulnRecord?.status || "not_checked",
          vulnRecord?.risk || "",
          vulnRecord?.score ?? "",
          vulnRecord?.advisoryCount ?? "",
          (vulnRecord?.advisoryIds || []).join(";"),
          "transitive",
          record.rootPackage,
          (record.parentPackages || [])
            .map(githubRepoPackageBriefLabel)
            .join(";"),
          (record.dependencyPaths || []).join(";"),
        ];
      }),
    ];
    downloadText(
      `${githubRepoExportBaseName()}-dependency-inventory.csv`,
      "text/csv",
      rows.map((row) => row.map(csvValue).join(",")).join("\n"),
    );
  };
  const githubRepoGraphVizColor = (record, policy) => {
    if (record?.status === "vulnerable") {
      if (record.risk === "critical") return "#ef4444";
      if (record.risk === "high") return "#f97316";
      if (record.risk === "medium") return "#f59e0b";
      if (record.risk === "low") return "#facc15";
      return "#fb7185";
    }
    if (record?.status === "no_advisory") return "#22c55e";
    if (record?.status === "unknown") return "#d4a83a";
    if (policy?.status === "copyleft") return "#fecaca";
    if (policy?.status === "review" || policy?.status === "missing") {
      return "#fde68a";
    }
    return "#94a3b8";
  };
  const githubRepoGraphVizNodeAttrs = (pkg, scope) => {
    const label = githubPackageLabel(pkg);
    const record = githubRepoPackageVulnRecord(pkg);
    const policy = githubPackageLicensePolicy(pkg);
    return [
      `label=${dotQuote(`${label}\\n${pkg.version || ""}`)}`,
      `fillcolor=${dotQuote(githubRepoGraphVizColor(record, policy))}`,
      `scope=${dotQuote(scope)}`,
      `package_manager=${dotQuote(pkg.manager || "")}`,
      `version=${dotQuote(pkg.version || "")}`,
      `purl=${dotQuote(pkg.purl || packagePurl(pkg.manager, label, pkg.version || ""))}`,
      `license=${dotQuote(githubPackageLicense(pkg))}`,
      `license_policy=${dotQuote(policy.status)}`,
      `osv_status=${dotQuote(record?.status || "not_checked")}`,
      `risk=${dotQuote(record?.risk || "")}`,
      `score=${dotQuote(record?.score ?? "")}`,
      `advisory_count=${dotQuote(record?.advisoryCount ?? "")}`,
    ];
  };
  const buildGithubRepoGraphVizDot = () => {
    const rootId = `repository:${githubRepoResult?.repository || "repository"}`;
    const nodes = new Map();
    const edges = new Map();
    const addNode = (id, attrs) => {
      if (!id || nodes.has(id)) return;
      nodes.set(id, attrs);
    };
    const addEdge = (from, to, kind) => {
      if (!from || !to) return;
      const key = `${from}\u0000${to}\u0000${kind || ""}`;
      edges.set(key, { from, to, kind });
    };
    const transitiveNodeId = (managerKey, packageName, versionValue) =>
      `transitive:${managerKey}:${packageName}@${versionValue || ""}`;

    addNode(rootId, [
      `label=${dotQuote(`${githubRepoResult?.repository || "Repository"}\\nRepository import`)}`,
      `fillcolor=${dotQuote("#0f6970")}`,
      `scope=${dotQuote("repository")}`,
    ]);

    const managers = Array.from(
      new Set(filteredGithubRepoPackages.map((pkg) => pkg.manager || "unknown")),
    ).sort((a, b) => a.localeCompare(b));
    managers.forEach((mgr) => {
      const managerId = `manager:${mgr}`;
      addNode(managerId, [
        `label=${dotQuote(pmDisplayNames[mgr] || mgr)}`,
        `fillcolor=${dotQuote("#dbeafe")}`,
        `scope=${dotQuote("manager")}`,
        `package_manager=${dotQuote(mgr)}`,
      ]);
      addEdge(rootId, managerId, "manager");
    });

    const packageNodeByKey = new Map();
    filteredGithubRepoPackages.forEach((pkg, index) => {
      const key = githubRepoPackageKey(pkg);
      const identityKey = githubRepoPackageIdentityKey(pkg);
      const fallbackKey = `${pkg.manager || "pkg"}:${githubPackageLabel(pkg)}@${pkg.version || ""}:${index}`;
      const packageNodeId = `package:${identityKey || key || fallbackKey}`;
      if (key) packageNodeByKey.set(key, packageNodeId);
      addNode(packageNodeId, githubRepoGraphVizNodeAttrs(pkg, "direct"));
      addEdge(`manager:${pkg.manager || "unknown"}`, packageNodeId, "package");
    });

    filteredGithubRepoPackages.forEach((pkg) => {
      const rootKey = githubRepoPackageKey(pkg);
      const expansion = rootKey ? githubRepoTransitiveDeps[rootKey] : null;
      const rootNodeId = rootKey ? packageNodeByKey.get(rootKey) : "";
      if (!expansion || expansion.failed || !rootNodeId) return;
      const dependencies = expansion.dependencies || {};
      const parents = expansion.parents || {};
      Object.entries(dependencies)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([depName, depVersion]) => {
          if (!depName || depName === expansion.rootPackageName) return;
          const depPkg = githubRepoPackageFromFormattedName(
            expansion.manager,
            depName,
            depVersion,
          );
          const depNodeId = transitiveNodeId(expansion.manager, depName, depVersion);
          addNode(depNodeId, githubRepoGraphVizNodeAttrs(depPkg, "transitive"));
          const parentValues = Array.isArray(parents[depName])
            ? parents[depName]
            : [parents[depName] || ""];
          parentValues.forEach((parentName) => {
            const parentVersion = dependencies[parentName];
            const source =
              parentName &&
              parentName !== expansion.rootPackageName &&
              parentVersion !== undefined
                ? transitiveNodeId(expansion.manager, parentName, parentVersion)
                : rootNodeId;
            addEdge(source, depNodeId, "transitive");
          });
        });
    });

    const lines = [
      "digraph github_repository_dependencies {",
      "    graph [rankdir=LR]",
      "    node [shape=box style=\"rounded,filled\" fontname=\"Inter, Arial\"]",
      "    edge [color=\"#64748b\"]",
    ];
    Array.from(nodes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([id, attrs]) => {
        lines.push(`    ${dotQuote(id)} [${attrs.join(" ")}]`);
      });
    Array.from(edges.values())
      .sort((a, b) =>
        a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from),
      )
      .forEach((edge) => {
        lines.push(
          `    ${dotQuote(edge.from)} -> ${dotQuote(edge.to)} [kind=${dotQuote(edge.kind)}]`,
        );
      });
    lines.push("    subgraph cluster_legend {");
    lines.push(`        label=${dotQuote("Repository import status")}`);
    lines.push(`        color=${dotQuote("#cbd5e1")}`);
    lines.push(`        style=${dotQuote("rounded")}`);
    [
      ["vulnerable", "#fb7185"],
      ["no OSV advisory", "#22c55e"],
      ["unresolved OSV", "#d4a83a"],
      ["license review", "#fde68a"],
      ["not checked", "#94a3b8"],
    ].forEach(([label, color], index) => {
      lines.push(
        `        ${dotQuote(`__repo_legend_${index}`)} [label=${dotQuote(label)} style=${dotQuote("filled")} fillcolor=${dotQuote(color)}]`,
      );
    });
    lines.push("    }");
    lines.push("}");
    return `${lines.join("\n")}\n`;
  };
  const exportGithubRepoGraphViz = () => {
    if (!githubRepoResult || filteredGithubRepoPackages.length === 0) return;
    downloadText(
      `${githubRepoExportBaseName()}-repository-graph.dot`,
      "text/vnd.graphviz",
      buildGithubRepoGraphVizDot(),
    );
  };
  const previewGithubRepoVuln = previewGithubRepoPackage
    ? githubRepoPackageVulnRecord(previewGithubRepoPackage)
    : null;
  const previewGithubRepoLicensePolicy = previewGithubRepoPackage
    ? githubPackageLicensePolicy(previewGithubRepoPackage)
    : null;
  const applyGithubRepoStatusFilter = (filter) => {
    const nextFilter =
      filter !== "all" && githubRepoStatusFilter === filter ? "all" : filter;
    setGithubRepoStatusFilter(nextFilter);
    setSelectedGithubRepoPackage(null);
  };
  const githubRepoSummaryFilterButton = (filter, label, options = {}) => {
    const active = githubRepoStatusFilter === filter;
    return e(
      "button",
      {
        key: options.key || `repo-filter-${filter}`,
        type: "button",
        className: [
          "github-import-stat",
          active && "active",
          options.risk && "github-import-risk-stat",
          options.high && "high",
          options.policy && "github-import-policy-stat",
        ]
          .filter(Boolean)
          .join(" "),
        onClick: () => applyGithubRepoStatusFilter(filter),
        "aria-pressed": active,
        title: options.title || `Filter repository packages by ${label}`,
      },
      label,
    );
  };
  const githubRepoSummaryStatus = (label) =>
    e(
      "span",
      { className: "github-import-stat is-static" },
      label,
    );
  const renderGithubRepoSkippedPackage = (pkg, index) => {
    const label = githubUnsupportedPackageLabel(pkg);
    const license = githubPackageLicense(pkg);
    const policy = githubPackageLicensePolicy(pkg);
    const refs = pkg.external_refs || [];
    return e(
      "article",
      {
        key: pkg.spdx_id || pkg.purl || `${label}-${pkg.version || ""}-${index}`,
        className: "github-skipped-package-card",
        title: refs.length > 0 ? refs.join("\n") : label,
      },
      e(
        "span",
        { className: "github-package-main" },
        e("span", { className: "github-package-name" }, label),
        e(
          "span",
          { className: "github-package-version" },
          pkg.version ? `@${pkg.version}` : "version unavailable",
        ),
        e(
          "span",
          { className: "github-skipped-reason" },
          "Unsupported ecosystem",
        ),
        license &&
          e(
            "span",
            {
              className: "github-package-license-badge",
              title: githubPackageLicenseTitle(pkg),
            },
            license,
          ),
        policy.status !== "permissive" &&
          e(
            "span",
            {
              className: `github-package-policy-badge ${policy.status}`,
              title: policy.detail,
            },
            policy.shortLabel,
          ),
      ),
      e(
        "span",
        { className: "github-skipped-ref" },
        pkg.purl || refs[0] || pkg.spdx_id || "No package URL",
      ),
    );
  };
  const githubRepoFilterEmptyMessage =
    githubRepoStatusFilter === "skipped"
      ? githubRepoUnsupportedPackages.length > 0
        ? "No skipped dependencies match the active filter."
        : `${githubRepoResult?.unsupported_count || 0} skipped dependenc${
            githubRepoResult?.unsupported_count === 1 ? "y was" : "ies were"
          } counted by GitHub but are not included in the supported package graph.`
      : githubRepoStatusFilter !== "all" || githubRepoQuery
        ? "No imported dependencies match the active filters."
        : "No supported dependencies were returned.";
  const cancelGithubRepoTransitiveDependencies = () => {
    if (githubRepoTransitiveAbortRef.current) {
      githubRepoTransitiveAbortRef.current.abort();
      githubRepoTransitiveAbortRef.current = null;
    }
    setGithubRepoTransitiveLoading(false);
    setGithubRepoTransitiveMode("");
    setGithubRepoTransitiveActiveKey("");
    setGithubRepoTransitiveProgress("Dependency-chain resolution cancelled");
  };
  const clearGithubRepoTransitiveDependencies = () => {
    cancelGithubRepoTransitiveDependencies();
    setGithubRepoTransitiveDeps({});
    setGithubRepoTransitiveProgress("");
    setGithubRepoTransitiveError("");
    setGithubRepoTreeCollapsed({});
    githubRepoGraphPositionsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
    githubRepoGraphAnchorsRef.current = {
      height: 0,
      positions: new Map(),
      width: 0,
    };
  };
  const toggleGithubRepoTreeNode = (key) => {
    setGithubRepoTreeCollapsed((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  const githubRepoTreeSecurityBadge = (pkg) => {
    const record = githubRepoPackageVulnRecord(pkg);
    if (record?.status === "vulnerable") {
      const riskClass = githubRepoPackageRiskClass(record);
      return e(
        "span",
        {
          className: `github-package-tree-status vulnerable${riskClass}`,
          title: githubRepoRiskLabel(record),
        },
        githubRepoRiskLabel(record),
      );
    }
    if (record?.status === "no_advisory") {
      return e(
        "span",
        {
          className: "github-package-tree-status clean",
          title: "OSV checked: no advisory",
        },
        "Clean",
      );
    }
    if (record?.status === "unknown") {
      return e(
        "span",
        {
          className: "github-package-tree-status unresolved",
          title: record.error || "OSV status unresolved",
        },
        "OSV unresolved",
      );
    }
    if (!githubRepoHasExactVersion(pkg)) {
      return e(
        "span",
        {
          className: "github-package-tree-status muted",
          title: "No exact version available for OSV lookup",
        },
        "No exact version",
      );
    }
    return e(
      "span",
      {
        className: "github-package-tree-status checking",
        title: "Waiting for OSV status",
      },
      "Checking",
    );
  };
  const githubRepoExpansionDependencyPackage = (expansion, depName) =>
    githubRepoPackageFromFormattedName(
      expansion.manager,
      depName,
      expansion.dependencies?.[depName],
    );
  const githubRepoExpansionChildren = (expansion, parentName) => {
    if (!expansion || expansion.failed) return [];
    const dependencies = expansion.dependencies || {};
    const parents = expansion.parents || {};
    return Object.keys(dependencies)
      .filter((depName) => {
        if (!depName || depName === parentName) return false;
        const parentValues = Array.isArray(parents[depName])
          ? parents[depName]
          : [parents[depName] || ""];
        return parentValues.some((value) =>
          parentName === expansion.rootPackageName
            ? !value || value === expansion.rootPackageName
            : value === parentName,
        );
      })
      .sort((a, b) => {
        const aPkg = githubRepoExpansionDependencyPackage(expansion, a);
        const bPkg = githubRepoExpansionDependencyPackage(expansion, b);
        const aRecord = githubRepoPackageVulnRecord(aPkg);
        const bRecord = githubRepoPackageVulnRecord(bPkg);
        return (
          (riskRank[bRecord?.risk] || 0) - (riskRank[aRecord?.risk] || 0) ||
          a.localeCompare(b)
        );
      });
  };
  const renderGithubRepoTreeNode = (
    pkg,
    {
      depth = 0,
      hasChildren = false,
      isCollapsed = false,
      isRoot = false,
      isResolving = false,
      nodeKey,
      onToggle = null,
    } = {},
  ) => {
    const identityKey = githubRepoPackageIdentityKey(pkg);
    const isSelected = identityKey && identityKey === selectedGithubRepoPackageKey;
    const vulnRecord = githubRepoPackageVulnRecord(pkg);
    const riskClass = githubRepoPackageRiskClass(vulnRecord);
    return e(
      "div",
      {
        className: [
          "github-package-tree-node",
          isRoot && "root",
          isSelected && "selected",
          isResolving && "resolving",
          riskClass.trim(),
        ]
          .filter(Boolean)
          .join(" "),
        style: { "--tree-depth": depth },
      },
      e(
        "button",
        {
          type: "button",
          className: "github-package-tree-toggle",
          disabled: !hasChildren,
          onClick: onToggle,
          title: hasChildren
            ? isCollapsed
              ? "Show dependency children"
              : "Hide dependency children"
            : "No resolved children",
          "aria-label": hasChildren
            ? isCollapsed
              ? "Show dependency children"
              : "Hide dependency children"
            : "No resolved children",
        },
        hasChildren ? (isCollapsed ? "\u25B6" : "\u25BC") : "",
      ),
      e("span", {
        className: `github-package-tree-dot${riskClass}`,
        "aria-hidden": "true",
      }),
      e(
        "button",
        {
          type: "button",
          className: "github-package-tree-label",
          onClick: () => setSelectedGithubRepoPackage(pkg),
          title: pkg.purl || githubPackageLabel(pkg),
          "aria-pressed": isSelected,
        },
        e("span", { className: "github-package-name" }, githubPackageLabel(pkg)),
        e(
          "span",
          { className: "github-package-version" },
          pkg.version || "latest",
        ),
      ),
      githubRepoTreeSecurityBadge(pkg),
      e(
        "span",
        { className: "github-package-manager" },
        pmDisplayNames[pkg.manager] || pkg.manager,
      ),
    );
  };
  const renderGithubRepoExpansionChildren = (
    expansion,
    parentName,
    depth,
    seen,
  ) => {
    const childNames = githubRepoExpansionChildren(expansion, parentName);
    if (childNames.length === 0) return null;
    return e(
      "div",
      { className: "github-package-tree-children" },
      childNames.map((childName) => {
        const childPkg = githubRepoExpansionDependencyPackage(expansion, childName);
        const childKey = `${expansion.manager}:${childName}@${
          childPkg.version || ""
        }`;
        const branchKey = `${parentName}->${childKey}:${depth}`;
        const nextSeen = new Set(seen);
        const repeatsInBranch = nextSeen.has(childKey);
        nextSeen.add(childKey);
        const hasChildren =
          !repeatsInBranch &&
          githubRepoExpansionChildren(expansion, childName).length > 0;
        const isCollapsed = Boolean(githubRepoTreeCollapsed[branchKey]);
        return e(
          "div",
          { key: branchKey, className: "github-package-tree-branch" },
          renderGithubRepoTreeNode(childPkg, {
            depth,
            hasChildren,
            isCollapsed,
            nodeKey: branchKey,
            onToggle: hasChildren
              ? () => toggleGithubRepoTreeNode(branchKey)
              : null,
          }),
          hasChildren &&
            !isCollapsed &&
            renderGithubRepoExpansionChildren(
              expansion,
              childName,
              depth + 1,
              nextSeen,
            ),
        );
      }),
    );
  };
  const renderGithubRepoTreeRoot = (pkg, index) => {
    const rootKey = githubRepoPackageKey(pkg);
    const expansion = rootKey ? githubRepoTransitiveDeps[rootKey] : null;
    const hasChildren =
      expansion &&
      !expansion.failed &&
      githubRepoExpansionChildren(expansion, expansion.rootPackageName).length > 0;
    const isCollapsed = Boolean(githubRepoTreeCollapsed[rootKey]);
    const isResolving =
      githubRepoTransitiveLoading && githubRepoTransitiveActiveKey === rootKey;
    return e(
      "div",
      {
        key:
          rootKey ||
          `${pkg.manager || "pkg"}-${pkg.name || "dependency"}-${index}`,
        className: "github-package-tree-root",
      },
      renderGithubRepoTreeNode(pkg, {
        depth: 0,
        hasChildren,
        isCollapsed,
        isResolving,
        isRoot: true,
        nodeKey: rootKey,
        onToggle: hasChildren ? () => toggleGithubRepoTreeNode(rootKey) : null,
      }),
      isResolving &&
        e(
          "div",
          { className: "github-package-tree-state" },
          "Resolving this package chain...",
        ),
      expansion?.failed &&
        e(
          "div",
          { className: "github-package-tree-state warning" },
          expansion.error || "Unable to resolve this package chain.",
        ),
      hasChildren &&
        !isCollapsed &&
        renderGithubRepoExpansionChildren(
          expansion,
          expansion.rootPackageName,
          1,
          new Set([`${pkg.manager}:${expansion.rootPackageName}@${pkg.version || ""}`]),
        ),
    );
  };
  const resolveGithubRepoTransitiveDependencies = async (scope = "visible") => {
    if (githubRepoTransitiveLoading) {
      cancelGithubRepoTransitiveDependencies();
      return;
    }
    const allRoots =
      scope === "project"
        ? githubRepoAllRootCandidates
        : githubRepoTransitiveRootCandidates;
    const roots = allRoots.filter(
      (pkg) => !githubRepoTransitiveDeps[githubRepoPackageKey(pkg)],
    );
    if (roots.length === 0) {
      setGithubRepoTransitiveError("");
      setGithubRepoTransitiveProgress(
        allRoots.length === 0
          ? scope === "project"
            ? "No repository packages have exact versions to resolve"
            : "No visible packages have exact versions to resolve"
          : scope === "project"
            ? "Complete project chain is already resolved"
            : "Transitive graph is already resolved for the visible packages",
      );
      return;
    }

    const controller = new AbortController();
    githubRepoTransitiveAbortRef.current = controller;
    setGithubRepoTransitiveLoading(true);
    setGithubRepoTransitiveMode(scope);
    setGithubRepoTransitiveActiveKey("");
    setGithubRepoTransitiveError("");
    setGithubRepoTransitiveProgress(
      scope === "project"
        ? `Building project chain 0/${roots.length} package roots`
        : `Resolving 0/${roots.length} package graphs`,
    );

    const nextDeps = { ...githubRepoTransitiveDeps };
    let completed = 0;
    let failed = 0;
    const commitProgress = (force = false) => {
      if (controller.signal.aborted) return;
      if (force || completed % 8 === 0 || scope === "project") {
        setGithubRepoTransitiveDeps({ ...nextDeps });
      }
      setGithubRepoTransitiveProgress(
        scope === "project"
          ? `Building project chain ${completed}/${roots.length} package roots${
              failed ? `; ${failed} failed` : ""
            }`
          : `Resolving ${completed}/${roots.length} package graphs${
              failed ? `; ${failed} failed` : ""
            }`,
      );
    };

    await mapLimit(roots, scope === "project" ? 1 : 4, async (pkg) => {
      if (controller.signal.aborted) return null;
      const rootKey = githubRepoPackageKey(pkg);
      const rootPackageName = formatPackage(
        pkg.manager,
        pkg.namespace || "",
        pkg.name,
      );
      setGithubRepoTransitiveActiveKey(rootKey);
      try {
        const resp = await fetchInternal(githubRepoDependencyApiUrl(pkg), {
          signal: controller.signal,
        });
        const text = await resp.text();
        if (!resp.ok) {
          throw new Error(text.trim() || `dependency lookup failed: ${resp.status}`);
        }
        const data = JSON.parse(text);
        nextDeps[rootKey] = {
          manager: pkg.manager,
          rootPackageName,
          rootVersion: pkg.version || "",
          dependencies: data.dependencies || {},
          parents: data.parents || {},
          errors: data.errors || {},
        };
        const dependencyPackages = Object.entries(data.dependencies || {})
          .map(([depName, depVersion]) =>
            githubRepoPackageFromFormattedName(pkg.manager, depName, depVersion),
          )
          .filter((depPkg) => githubRepoHasExactVersion(depPkg));
        await ensureGithubRepoPackageOsvStatuses(
          [pkg, ...dependencyPackages],
          controller.signal,
          (checked, total, vulnerable) => {
            if (controller.signal.aborted) return;
            setGithubRepoTransitiveProgress(
              scope === "project"
                ? `Building ${githubPackageLabel(pkg)}: OSV ${checked}/${total}${
                    vulnerable ? `; ${vulnerable} vulnerable` : ""
                  }`
                : `Checking OSV ${checked}/${total} for ${githubPackageLabel(pkg)}`,
            );
          },
        );
      } catch (err) {
        if (controller.signal.aborted) return null;
        failed += 1;
        nextDeps[rootKey] = {
          manager: pkg.manager,
          rootPackageName,
          rootVersion: pkg.version || "",
          dependencies: {},
          parents: {},
          failed: true,
          error: err && err.message ? err.message : "Unable to resolve package graph",
        };
      } finally {
        if (!controller.signal.aborted) {
          completed += 1;
          setGithubRepoTransitiveActiveKey("");
          commitProgress(false);
        }
      }
      return null;
    });

    if (controller.signal.aborted) {
      setGithubRepoTransitiveLoading(false);
      setGithubRepoTransitiveMode("");
      setGithubRepoTransitiveActiveKey("");
      setGithubRepoTransitiveProgress("Dependency-chain resolution cancelled");
      return;
    }

    githubRepoTransitiveAbortRef.current = null;
    setGithubRepoTransitiveDeps({ ...nextDeps });
    setGithubRepoTransitiveLoading(false);
    setGithubRepoTransitiveMode("");
    setGithubRepoTransitiveActiveKey("");
    setGithubRepoTransitiveProgress(
      scope === "project"
        ? `Complete project chain resolved for ${completed - failed}/${roots.length} package roots${
            failed ? `; ${failed} failed` : ""
          }`
        : `Resolved ${completed - failed}/${roots.length} package graphs${
            failed ? `; ${failed} failed` : ""
          }`,
    );
    setGithubRepoTransitiveError(
      failed ? `${failed} package graph${failed === 1 ? "" : "s"} could not be resolved.` : "",
    );
  };

  React.useEffect(() => {
    let cancelled = false;
    const packages = githubRepoResult?.packages || [];
    if (packages.length === 0) {
      setGithubRepoVulnStatus({});
      setGithubRepoVulnLoading(false);
      setGithubRepoVulnProgress("");
      return () => {
        cancelled = true;
      };
    }

    const initialStatus = {};
    const groupedChecks = new Map();
    packages.forEach((pkg) => {
      const key = githubRepoPackageKey(pkg);
      const identityKey = githubRepoPackageIdentityKey(pkg);
      const target = githubRepoPackageOsvTarget(pkg);
      if (!key || !target) return;
      const cacheKey = versionRiskKey(
        target.manager,
        target.packageName,
        target.version,
      );
      const cached = versionRiskCacheRef.current.get(cacheKey);
      if (cached) {
        initialStatus[key] = cached;
        if (identityKey) initialStatus[identityKey] = cached;
        return;
      }
      if (!groupedChecks.has(cacheKey)) {
        groupedChecks.set(cacheKey, {
          ...target,
          cacheKey,
          keys: [],
        });
      }
      groupedChecks.get(cacheKey).keys.push(key);
      if (identityKey && identityKey !== key) {
        groupedChecks.get(cacheKey).keys.push(identityKey);
      }
    });

    const checks = Array.from(groupedChecks.values());
    setGithubRepoVulnStatus(initialStatus);
    if (checks.length === 0) {
      setGithubRepoVulnLoading(false);
      setGithubRepoVulnProgress(
        Object.keys(initialStatus).length > 0
          ? "OSV status loaded from cache"
          : "No exact package versions available for OSV coloring",
      );
      return () => {
        cancelled = true;
      };
    }

    setGithubRepoVulnLoading(true);
    setGithubRepoVulnProgress(
      `Checking OSV for 0/${checks.length} versioned packages`,
    );

    const accumulatedStatus = { ...initialStatus };
    let completed = 0;
    const commitStatus = (force = false) => {
      if (cancelled) return;
      if (force || completed % 25 === 0) {
        setGithubRepoVulnStatus({ ...accumulatedStatus });
      }
      setGithubRepoVulnProgress(
        `Checking OSV for ${completed}/${checks.length} versioned packages`,
      );
    };

    mapLimit(checks, 6, async (item) => {
      let record;
      const result = await queryOsvVulns(
        item.manager,
        item.packageName,
        item.version,
      );
      const status = result.status || {};
      if (status.status === "vulnerable" || status.status === "no_advisory") {
        record = summarizeVersionRisk(result.vulns || []);
        versionRiskCacheRef.current.set(item.cacheKey, record);
      } else {
        record = {
          status: status.status || "unknown",
          score: 0,
          risk: null,
          advisoryCount: 0,
          advisoryIds: [],
          cveIds: [],
          error: status.error || "",
        };
      }
      item.keys.forEach((key) => {
        accumulatedStatus[key] = record;
      });
      completed += 1;
      commitStatus(false);
      return record;
    })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err && err.message ? err.message : "Unable to resolve repository OSV status.";
        setGithubRepoVulnProgress(message);
      })
      .finally(() => {
        if (cancelled) return;
        setGithubRepoVulnStatus({ ...accumulatedStatus });
        setGithubRepoVulnLoading(false);
        const vulnerable = Object.values(accumulatedStatus).filter(
          (record) => record.status === "vulnerable",
        ).length;
        setGithubRepoVulnProgress(
          vulnerable > 0
            ? `${vulnerable} vulnerable package${vulnerable === 1 ? "" : "s"} found by OSV`
            : `OSV checked ${completed} versioned package${completed === 1 ? "" : "s"}`,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [githubRepoResult]);

  React.useEffect(() => {
    const svgEl = repoGraphRef.current;
    if (!svgEl) return undefined;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const repoGraphPackages = filteredGithubRepoPackages;
    if (!githubRepoResult || repoGraphPackages.length === 0) {
      return undefined;
    }

    const isDark = appearanceMode === "dark";
    const width = Math.max(svgEl.clientWidth || 560, 360);
    const height = Math.max(svgEl.clientHeight || 420, 320);
    const rootId = "__repository__";
    const managers = Array.from(
      new Set(repoGraphPackages.map((pkg) => pkg.manager || "unknown")),
    ).sort((a, b) => a.localeCompare(b));
    const palette = isDark
      ? ["#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#fb7185", "#f472b6"]
      : ["#0f6970", "#7c3aed", "#b26a00", "#16845a", "#b42318", "#9a3412"];
    const managerColor = managers.reduce((acc, mgr, index) => {
      acc[mgr] = palette[index % palette.length];
      return acc;
    }, {});
    const trimGraphLabel = (value, max = 24) => {
      const text = String(value || "");
      return text.length > max ? `${text.slice(0, max - 1)}...` : text;
    };

    const nodes = [
      {
        id: rootId,
        label: githubRepoResult.repository || "Repository",
        root: true,
      },
      ...managers.map((mgr) => ({
        id: `manager:${mgr}`,
        label: pmDisplayNames[mgr] || mgr,
        manager: mgr,
        managerGroup: true,
      })),
    ];
    const packageNodes = repoGraphPackages.map((pkg, index) => {
      const key = githubRepoPackageKey(pkg);
      const identityKey = githubRepoPackageIdentityKey(pkg);
      const vulnRecord = key ? githubRepoVulnStatus[key] || null : null;
      return {
        id: githubRepoGraphPackageNodeId(pkg, index),
        identityKey,
        key,
        label: githubPackageLabel(pkg),
        version: pkg.version || "",
        manager: pkg.manager || "unknown",
        vulnRecord: githubRepoPackageVulnRecord(pkg) || vulnRecord,
        pkg,
        selected: identityKey && identityKey === selectedGithubRepoPackageKey,
      };
    });
    nodes.push(...packageNodes);
    const transitiveNodesById = new Map();
    const transitiveLinks = [];
    const transitiveNodeId = (managerKey, packageName, versionValue) =>
      `transitive:${managerKey}:${packageName}@${versionValue || ""}`;
    packageNodes.forEach((packageNode) => {
      if (!packageNode.key) return;
      const expansion = githubRepoTransitiveDeps[packageNode.key];
      if (!expansion || expansion.failed) return;
      const dependencyEntries = Object.entries(expansion.dependencies || {});
      const parents = expansion.parents || {};
      dependencyEntries.forEach(([depName, depVersion]) => {
        if (!depName || depName === expansion.rootPackageName) return;
        const depNodeId = transitiveNodeId(expansion.manager, depName, depVersion);
        if (!transitiveNodesById.has(depNodeId)) {
          const depPkg = githubRepoPackageFromFormattedName(
            expansion.manager,
            depName,
            depVersion,
          );
          const depKey = githubRepoPackageKey(depPkg);
          const depIdentityKey = githubRepoPackageIdentityKey(depPkg);
          const depRecord = githubRepoPackageVulnRecord(depPkg);
          transitiveNodesById.set(depNodeId, {
            id: depNodeId,
            identityKey: depIdentityKey,
            key: depKey,
            label: githubPackageLabel(depPkg),
            version: depVersion || "",
            manager: expansion.manager,
            vulnRecord: depRecord,
            pkg: depPkg,
            transitiveDep: true,
            selected:
              depIdentityKey && depIdentityKey === selectedGithubRepoPackageKey,
          });
        }

        const parentValues = Array.isArray(parents[depName])
          ? parents[depName]
          : [parents[depName] || ""];
        parentValues.forEach((parentName) => {
          const parentVersion = expansion.dependencies[parentName];
          const source =
            parentName &&
            parentName !== expansion.rootPackageName &&
            parentVersion !== undefined
              ? transitiveNodeId(expansion.manager, parentName, parentVersion)
              : packageNode.id;
          transitiveLinks.push({
            source,
            target: depNodeId,
            kind: "transitive",
          });
        });
      });
    });
    const transitiveNodes = Array.from(transitiveNodesById.values());
    nodes.push(...transitiveNodes);

    const links = managers
      .map((mgr) => ({ source: rootId, target: `manager:${mgr}`, kind: "manager" }))
      .concat(
        packageNodes.map((node) => ({
          source: `manager:${node.manager}`,
          target: node.id,
          kind: "package",
        })),
        transitiveLinks,
      );

    const hashGraphNode = (value) => {
      let hash = 0;
      const text = String(value || "");
      for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) % 9973;
      }
      return hash;
    };
    const previousGraph = githubRepoGraphPositionsRef.current || {
      height,
      positions: new Map(),
      width,
    };
    const previousPositions = previousGraph.positions || new Map();
    const scaleX =
      previousGraph.width > 0 && previousGraph.width !== width
        ? width / previousGraph.width
        : 1;
    const scaleY =
      previousGraph.height > 0 && previousGraph.height !== height
        ? height / previousGraph.height
        : 1;
    const dependencyAnchorGraph =
      previousPositions.size > 0 &&
      (githubRepoTransitiveLoading ||
        Object.keys(githubRepoTransitiveDeps).length > 0);
    const softAnchorGraph =
      dependencyAnchorGraph ||
      (previousPositions.size > 0 && githubRepoGraphExpanded);
    const previousAnchorGraph = githubRepoGraphAnchorsRef.current || {
      height,
      positions: new Map(),
      width,
    };
    const rawAnchorPositions =
      dependencyAnchorGraph && previousAnchorGraph.positions?.size
        ? previousAnchorGraph.positions
        : previousPositions;
    const anchorScaleX =
      previousAnchorGraph.width > 0 &&
      previousAnchorGraph.width !== width &&
      rawAnchorPositions === previousAnchorGraph.positions
        ? width / previousAnchorGraph.width
        : scaleX;
    const anchorScaleY =
      previousAnchorGraph.height > 0 &&
      previousAnchorGraph.height !== height &&
      rawAnchorPositions === previousAnchorGraph.positions
        ? height / previousAnchorGraph.height
        : scaleY;
    const anchorPositions = new Map();
    rawAnchorPositions.forEach((position, id) => {
      anchorPositions.set(id, {
        x: Math.max(18, Math.min(width - 18, position.x * anchorScaleX)),
        y: Math.max(18, Math.min(height - 18, position.y * anchorScaleY)),
      });
    });
    const initialPositions = new Map();
    nodes.forEach((d) => {
      const saved = previousPositions.get(d.id);
      if (saved) {
        d.x = Math.max(18, Math.min(width - 18, saved.x * scaleX));
        d.y = Math.max(18, Math.min(height - 18, saved.y * scaleY));
        const anchor = anchorPositions.get(d.id);
        if (anchor && softAnchorGraph) {
          d.anchorX = anchor.x;
          d.anchorY = anchor.y;
        }
        initialPositions.set(d.id, { x: d.x, y: d.y });
        return;
      }
      if (d.root) {
        d.x = width / 2;
        d.y = height / 2;
      } else {
        const incoming = links.find((linkItem) => linkItem.target === d.id);
        const currentParentPosition = incoming
          ? initialPositions.get(incoming.source)
          : null;
        const savedParentPosition =
          incoming && !currentParentPosition
            ? previousPositions.get(incoming.source)
            : null;
        const parentX = currentParentPosition
          ? currentParentPosition.x
          : savedParentPosition
            ? savedParentPosition.x * scaleX
            : 0;
        const parentY = currentParentPosition
          ? currentParentPosition.y
          : savedParentPosition
            ? savedParentPosition.y * scaleY
            : 0;
        const angle = (hashGraphNode(d.id) / 9973) * Math.PI * 2;
        const distance = d.transitiveDep ? 34 : d.managerGroup ? 86 : 52;
        d.x = currentParentPosition || savedParentPosition
          ? parentX + Math.cos(angle) * distance
          : width / 2 + Math.cos(angle) * distance;
        d.y = currentParentPosition || savedParentPosition
          ? parentY + Math.sin(angle) * distance
          : height / 2 + Math.sin(angle) * distance;
      }
      d.x = Math.max(18, Math.min(width - 18, d.x));
      d.y = Math.max(18, Math.min(height - 18, d.y));
      initialPositions.set(d.id, { x: d.x, y: d.y });
    });

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.attr("preserveAspectRatio", "xMidYMid meet");

    const layer = svg.append("g").attr("class", "repo-graph-layer");
    const link = layer
      .append("g")
      .attr("class", "repo-graph-links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", isDark ? "rgba(148, 163, 184, 0.34)" : "rgba(83, 100, 113, 0.28)")
      .attr("stroke-width", 1.2);

    const node = layer
      .append("g")
      .attr("class", "repo-graph-nodes")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", (d) =>
        githubRepoGraphNodeClassName(d, d.vulnRecord),
      )
      .attr("r", (d) => {
        if (d.root) return 15;
        if (d.managerGroup) return 10;
        if (d.transitiveDep) return d.selected ? 7 : 4.4;
        return d.selected ? 8 : 5.5;
      })
      .attr("fill", (d) => {
        if (d.root) return isDark ? "#2dd4bf" : "#0f6970";
        if (d.managerGroup) return managerColor[d.manager] || palette[0];
        return githubRepoGraphPackageFill(d, d.vulnRecord);
      })
      .attr("stroke", (d) => {
        if (d.root) return isDark ? "#99f6e4" : "#0b4f55";
        if (d.managerGroup) return "#ffffff";
        return githubRepoGraphPackageStroke(d, d.vulnRecord);
      })
      .attr("stroke-width", (d) =>
        d.pkg ? githubRepoGraphPackageStrokeWidth(d, d.vulnRecord) : 2.2,
      )
      .style("cursor", (d) => (d.pkg ? "pointer" : "default"))
      .on("click", (event, d) => {
        if (!d.pkg) return;
        event.stopPropagation();
        setSelectedGithubRepoPackage(d.pkg);
      });

    node
      .append("title")
      .text((d) => {
        if (!d.pkg) return d.label;
        return [
          `${githubPackageLabel(d.pkg)}${d.pkg.version ? `@${d.pkg.version}` : ""}`,
          pmDisplayNames[d.pkg.manager] || d.pkg.manager,
          githubRepoRiskLabel(d.vulnRecord),
        ]
          .filter(Boolean)
          .join(" - ");
      });

    const graphPackageLikeCount = packageNodes.length + transitiveNodes.length;
    const graphLabelCapacity = githubRepoGraphExpanded
      ? 56
      : Math.max(14, Math.floor((width * height) / 26000));
    const shouldShowPackageLabels = graphPackageLikeCount <= graphLabelCapacity;
    const label = layer
      .append("g")
      .attr("class", "repo-graph-labels")
      .selectAll("text")
      .data(
        nodes.filter(
          (d) => d.root || d.managerGroup || d.selected || (shouldShowPackageLabels && d.pkg),
        ),
      )
      .enter()
      .append("text")
      .attr("class", (d) =>
        ["repo-graph-label", d.selected && "selected"].filter(Boolean).join(" "),
      )
      .attr("font-size", (d) => (d.root ? 12 : d.managerGroup ? 10 : 9))
      .attr("font-weight", (d) => (d.root || d.managerGroup || d.selected ? 800 : 650))
      .attr("fill", isDark ? "#d7e2ea" : "#1f2937")
      .text((d) => {
        if (d.root) return "Repository";
        if (d.managerGroup) return d.label;
        return trimGraphLabel(`${d.label}${d.version ? `@${d.version}` : ""}`);
      })
      .style("pointer-events", (d) => (d.pkg ? "auto" : "none"))
      .style("cursor", (d) => (d.pkg ? "pointer" : "default"))
      .on("click", (event, d) => {
        if (!d.pkg) return;
        event.stopPropagation();
        setSelectedGithubRepoPackage(d.pkg);
      });

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.kind === "manager") return 108;
            if (d.kind === "transitive") return 32;
            return 44;
          })
          .strength(0.72),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => {
          const base =
            graphPackageLikeCount > 1200
              ? -18
              : graphPackageLikeCount > 80
                ? -34
                : -74;
          return d.anchorX !== undefined && softAnchorGraph ? base * 0.35 : base;
        }),
      )
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d) =>
            d.root ? 26 : d.managerGroup ? 20 : d.transitiveDep ? 9 : 13,
          ),
      )
      .force(
        "x",
        d3
          .forceX((d) => (d.anchorX !== undefined ? d.anchorX : width / 2))
          .strength((d) => {
            if (d.anchorX === undefined) return 0.04;
            if (!softAnchorGraph) return 0.12;
            if (d.root) return 0.82;
            if (d.managerGroup) return 0.62;
            return d.transitiveDep ? 0.38 : 0.44;
          }),
      )
      .force(
        "y",
        d3
          .forceY((d) => (d.anchorY !== undefined ? d.anchorY : height / 2))
          .strength((d) => {
            if (d.anchorY === undefined) return 0.06;
            if (!softAnchorGraph) return 0.14;
            if (d.root) return 0.86;
            if (d.managerGroup) return 0.66;
            return d.transitiveDep ? 0.42 : 0.48;
          }),
      );

    svg.on("click", () => setSelectedGithubRepoPackage(null));

    const renderSettledGraph = () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node
        .attr("cx", (d) => Math.max(18, Math.min(width - 18, d.x)))
        .attr("cy", (d) => Math.max(18, Math.min(height - 18, d.y)));
      label
        .attr("x", (d) => Math.max(24, Math.min(width - 24, d.x + 11)))
        .attr("y", (d) => Math.max(22, Math.min(height - 22, d.y + 4)));
    };

    const tickCount =
      graphPackageLikeCount > 1600
        ? 65
        : graphPackageLikeCount > 900
        ? 80
        : graphPackageLikeCount > 250
          ? 110
          : 150;
    const driftLimitFor = (d) => {
      if (d.root) return 3;
      if (d.managerGroup) return 7;
      if (d.selected) return 6;
      if (d.transitiveDep) return 12;
      return 9;
    };
    const applySubtleAnchorDrift = () => {
      if (!softAnchorGraph) return;
      nodes.forEach((d) => {
        if (d.anchorX === undefined || d.anchorY === undefined) return;
        const dx = d.x - d.anchorX;
        const dy = d.y - d.anchorY;
        const distance = Math.hypot(dx, dy);
        const limit = driftLimitFor(d);
        if (distance <= limit || distance === 0) return;
        d.x = d.anchorX + (dx / distance) * limit;
        d.y = d.anchorY + (dy / distance) * limit;
        d.vx *= 0.35;
        d.vy *= 0.35;
      });
    };
    simulation.stop();
    for (let i = 0; i < tickCount; i += 1) {
      simulation.tick();
      applySubtleAnchorDrift();
    }
    renderSettledGraph();
    const nextPositions = new Map();
    nodes.forEach((d) => {
      nextPositions.set(d.id, {
        x: Math.max(18, Math.min(width - 18, d.x || width / 2)),
        y: Math.max(18, Math.min(height - 18, d.y || height / 2)),
      });
    });
    githubRepoGraphPositionsRef.current = {
      height,
      positions: nextPositions,
      width,
    };
    if (dependencyAnchorGraph) {
      const nextAnchors = new Map(anchorPositions);
      nextPositions.forEach((position, id) => {
        if (!nextAnchors.has(id)) nextAnchors.set(id, position);
      });
      githubRepoGraphAnchorsRef.current = {
        height,
        positions: nextAnchors,
        width,
      };
    } else if (!githubRepoGraphExpanded) {
      githubRepoGraphAnchorsRef.current = {
        height: 0,
        positions: new Map(),
        width: 0,
      };
    }

    return () => simulation.stop();
  }, [
    githubRepoResult,
    selectedGithubRepoPackageKey,
    appearanceMode,
    githubRepoGraphPackageSignature,
    githubRepoTransitiveGraphSignature,
    githubRepoTransitiveLoading,
    githubRepoGraphExpanded,
  ]);

  React.useEffect(() => {
    const svgEl = repoGraphRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    const packageNodes = svg.selectAll(".repo-graph-node.package");
    if (packageNodes.empty()) return;

    packageNodes
      .attr("class", (d) => {
        const record = githubRepoPackageVulnRecord(d.pkg);
        d.vulnRecord = record;
        return githubRepoGraphNodeClassName(d, record);
      })
      .attr("fill", (d) => {
        const record = githubRepoPackageVulnRecord(d.pkg);
        return githubRepoGraphPackageFill(d, record);
      })
      .attr("stroke", (d) => {
        const record = githubRepoPackageVulnRecord(d.pkg);
        return githubRepoGraphPackageStroke(d, record);
      })
      .attr("stroke-width", (d) => {
        const record = githubRepoPackageVulnRecord(d.pkg);
        return githubRepoGraphPackageStrokeWidth(d, record);
      });

    packageNodes.select("title").text((d) => {
      const record = githubRepoPackageVulnRecord(d.pkg);
      return [
        `${githubPackageLabel(d.pkg)}${d.pkg.version ? `@${d.pkg.version}` : ""}`,
        pmDisplayNames[d.pkg.manager] || d.pkg.manager,
        githubRepoRiskLabel(record),
      ]
        .filter(Boolean)
        .join(" - ");
    });
  }, [
    githubRepoVulnStatus,
    appearanceMode,
    selectedGithubRepoPackageKey,
    githubRepoGraphPackageSignature,
  ]);

  const selectPackageTypeaheadItem = (pkg) => {
    if (!pkg) return;
    applyPackageSuggestion(pkg);
  };
  const handlePackageTypeaheadKeyDown = (evt) => {
    if (evt.key === "Escape") {
      setPackageTypeaheadOpen(false);
      return;
    }
    if (evt.key === "ArrowDown") {
      evt.preventDefault();
      setPackageTypeaheadOpen(true);
      setPackageTypeaheadActive((idx) =>
        Math.min(idx + 1, Math.max(visiblePackageSuggestions.length - 1, 0)),
      );
      return;
    }
    if (evt.key === "ArrowUp") {
      evt.preventDefault();
      setPackageTypeaheadOpen(true);
      setPackageTypeaheadActive((idx) => Math.max(idx - 1, 0));
      return;
    }
    if (evt.key === "Enter" && showPackageTypeahead) {
      evt.preventDefault();
      selectPackageTypeaheadItem(
        visiblePackageSuggestions[packageTypeaheadActive] ||
          visiblePackageSuggestions[0],
      );
    }
  };

  const advisoryReferenceLabel = (ref) => {
    if (ref.type) return ref.type;
    try {
      return new URL(ref.url).hostname;
    } catch (_) {
      return ref.url;
    }
  };

  const cvePanel =
    searchMode === "cve" &&
    (cveSubmitted || cveLoading || cveResult || cveError) &&
    (() => {
      const id = (cveResult && cveResult.id) || extractAdvisoryId(cveQuery);
      const score = cveResult ? vulnerabilityScore(cveResult) : 0;
      const risk = cveResult ? riskFromScore(score) : "";
      const aliases = Array.isArray(cveResult?.aliases)
        ? cveResult.aliases.filter((alias) => alias && alias !== id).slice(0, 6)
        : [];
      const affected = Array.isArray(cveResult?.affected)
        ? cveResult.affected
        : [];
      const affectedRecords = affected
        .slice(0, 24)
        .map((record, idx) => remediationRecordDetails(record, idx));
      const remediationFixCount = affectedRecords.filter(
        (record) => record.hasFix,
      ).length;
      const references = Array.isArray(cveResult?.references)
        ? cveResult.references.filter((ref) => ref && ref.url).slice(0, 8)
        : [];
      const sourceLabel =
        cveResult?.database_specific?.source || (cveResult ? "OSV" : "");
      const sourceNote = cveResult?.database_specific?.lookup_note || "";
      const statusLabel =
        cveResult?.database_specific?.status ||
        cveResult?.database_specific?.nvd_status ||
        "";
      const sourceIdentifier =
        cveResult?.database_specific?.sourceIdentifier ||
        cveResult?.database_specific?.nvd_source ||
        "";
      const weaknesses = Array.isArray(cveResult?.weaknesses)
        ? cveResult.weaknesses.filter(Boolean).slice(0, 8)
        : [];
      const primaryVector = Array.isArray(cveResult?.severity)
        ? cveResult.severity.find((sev) => sev && sev.vector)?.vector
        : "";
      const nvdUrl = /^CVE-/i.test(id)
        ? `https://nvd.nist.gov/vuln/detail/${id}`
        : "";
      const osvUrl = id ? `https://osv.dev/vulnerability/${id}` : "";

      return e(
        "section",
        { className: "cve-results-panel" },
        e(
          "div",
          { className: "cve-results-header" },
          e(
            "div",
            null,
            e("p", { className: "section-label" }, "Advisory lookup"),
            e("h2", null, id || "CVE search"),
          ),
          e(
            "div",
            { className: "cve-actions" },
            cveResult &&
              score > 0 &&
              e(
                "span",
                {
                  className: `risk-number compact ${
                    risk ? `risk-${risk}` : ""
                  }`,
                  title: "Highest severity found across advisory sources",
                },
                score.toFixed(1),
              ),
            sourceLabel &&
              e("span", { className: "cve-source-badge" }, sourceLabel),
            id &&
              e(
                "a",
                {
                  className: "share-link-button",
                  href: currentCveDeepLink(),
                  onClick: copyCveDeepLink,
                  title: "Copy or open a deep link to this advisory",
                },
                shareStatus || "Copy CVE link",
              ),
            osvUrl &&
              e(
                "a",
                {
                  className: "registry-badge action-link",
                  href: osvUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "OSV",
              ),
            nvdUrl &&
              e(
                "a",
                {
                  className: "registry-badge action-link",
                  href: nvdUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "NVD",
              ),
          ),
        ),
        cveLoading &&
          e(
            "div",
            { className: "cve-loading-state" },
            "Checking OSV, NVD, affected products, and references...",
          ),
        cveError &&
          e(
            "div",
            { className: "github-import-error cve-error" },
            cveError,
            nvdUrl &&
              e(
                "a",
                {
                  href: nvdUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                " Check NVD",
              ),
          ),
        cveError &&
          !cveResult &&
          e(
            React.Fragment,
            null,
            e(
              "div",
              { className: "cve-section-header remediation-header" },
              e("h3", null, "Remediation"),
              e("span", null, "Advisory data unavailable"),
            ),
            e(
              "div",
              { className: "remediation-panel" },
              e(
                "div",
                { className: "remediation-summary-card" },
                e("span", { className: "remediation-step-number" }, "1"),
                e(
                  "div",
                  null,
                  e("h4", null, "Retry authoritative sources"),
                  e(
                    "p",
                    null,
                    "The advisory source did not return details. Open NVD or OSV directly, then retry this lookup when the upstream service is reachable.",
                  ),
                ),
              ),
              e(
                "div",
                { className: "remediation-summary-card" },
                e("span", { className: "remediation-step-number" }, "2"),
                e(
                  "div",
                  null,
                  e("h4", null, "Inventory possible exposure"),
                  e(
                    "p",
                    null,
                    "Identify packages, products, and deployed versions that may map to this CVE before assigning remediation work.",
                  ),
                ),
              ),
              e(
                "div",
                { className: "remediation-summary-card" },
                e("span", { className: "remediation-step-number" }, "3"),
                e(
                  "div",
                  null,
                  e("h4", null, "Use temporary controls"),
                  e(
                    "p",
                    null,
                    "Prioritize exposed systems, restrict risky input paths, and monitor vendor guidance until fixed versions or workarounds are confirmed.",
                  ),
                ),
              ),
            ),
          ),
        cveResult &&
          e(
            React.Fragment,
            null,
            e(
              "div",
              { className: "cve-summary-grid" },
              e(
                "div",
                { className: "cve-summary-main" },
                e("h3", null, cveResult.summary || id),
                (cveResult.details || cveResult.summary) &&
                  e(
                    "p",
                    null,
                    compactText(cveResult.details || cveResult.summary, 620),
                  ),
                sourceNote && e("p", { className: "cve-source-note" }, sourceNote),
                aliases.length > 0 &&
                  e(
                    "div",
                    { className: "cve-aliases" },
                    aliases.map((alias) =>
                      e("span", { key: alias }, alias),
                    ),
                  ),
                weaknesses.length > 0 &&
                  e(
                    "div",
                    { className: "cve-aliases cve-weaknesses" },
                    weaknesses.map((weakness) =>
                      e("span", { key: weakness }, weakness),
                    ),
                  ),
                primaryVector &&
                  e("code", { className: "cvss-vector" }, primaryVector),
              ),
              e(
                "div",
                { className: "cve-meta-panel" },
                sourceLabel &&
                  e(
                    "div",
                    null,
                    e("span", null, "Source"),
                    e("strong", null, sourceLabel),
                  ),
                statusLabel &&
                  e(
                    "div",
                    null,
                    e("span", null, "Status"),
                    e("strong", null, statusLabel),
                  ),
                cveResult.published &&
                  e(
                    "div",
                    null,
                    e("span", null, "Published"),
                    e("strong", null, cveResult.published.slice(0, 10)),
                  ),
                cveResult.modified &&
                  e(
                    "div",
                    null,
                    e("span", null, "Modified"),
                    e("strong", null, cveResult.modified.slice(0, 10)),
                  ),
                cveResult.database_specific?.severity &&
                  e(
                    "div",
                    null,
                    e("span", null, "Severity"),
                    e("strong", null, cveResult.database_specific.severity),
                  ),
                sourceIdentifier &&
                  e(
                    "div",
                    null,
                    e("span", null, "Reporter"),
                    e("strong", null, sourceIdentifier),
                  ),
                Array.isArray(cveResult.severity) &&
                  cveResult.severity.slice(0, 3).map((sev, idx) =>
                    e(
                      "div",
                      { key: `${sev.type || "severity"}-${idx}` },
                      e("span", null, sev.type || "Score"),
                      e(
                        "strong",
                        null,
                        `${sev.score}${sev.severity ? ` ${sev.severity}` : ""}`,
                      ),
                    ),
                  ),
              ),
            ),
            e(
              "div",
              { className: "cve-section-header remediation-header" },
              e("h3", null, "Remediation"),
              e(
                "span",
                null,
                affectedRecords.length > 0
                  ? `${remediationFixCount} fix paths listed`
                  : "Guidance checklist",
              ),
            ),
            e(
              "div",
              { className: "remediation-panel" },
              e(
                "div",
                { className: "remediation-summary-card" },
                e(
                  "span",
                  { className: "remediation-step-number" },
                  "1",
                ),
                e(
                  "div",
                  null,
                  e(
                    "h4",
                    null,
                    remediationFixCount > 0
                      ? "Upgrade impacted components"
                      : affected.length > 0
                        ? "Confirm affected versions"
                        : "Determine exposure first",
                  ),
                  e(
                    "p",
                    null,
                    remediationFixCount > 0
                      ? "Apply the first fixed version available for each affected package, then rerun the package analyzer to verify the dependency graph is clean."
                      : affected.length > 0
                        ? "No fixed version is listed for every affected record. Match the published ranges against deployed versions and follow vendor guidance before rollout."
                        : "No affected package data was published with this advisory. Use the references, NVD status, and vendor notes to identify impacted assets before making code changes.",
                  ),
                ),
              ),
              e(
                "div",
                { className: "remediation-summary-card" },
                e(
                  "span",
                  { className: "remediation-step-number" },
                  "2",
                ),
                e(
                  "div",
                  null,
                  e("h4", null, "Reduce risk while patching"),
                  e(
                    "p",
                    null,
                    "Prioritize internet-facing services, restrict vulnerable input paths, and apply vendor workarounds or compensating controls until patched builds are deployed.",
                  ),
                ),
              ),
              e(
                "div",
                { className: "remediation-summary-card" },
                e(
                  "span",
                  { className: "remediation-step-number" },
                  "3",
                ),
                e(
                  "div",
                  null,
                  e("h4", null, "Verify and monitor"),
                  e(
                    "p",
                    null,
                    "Rebuild lockfiles or manifests, redeploy, scan again, and monitor OSV/NVD references for late-breaking fixed versions or scope changes.",
                  ),
                ),
              ),
            ),
            e(
              "div",
              { className: "cve-section-header" },
              e("h3", null, "Affected Packages & Fix Guidance"),
              e("span", null, `${affectedRecords.length} package records`),
            ),
            affectedRecords.length > 0
              ? e(
                  "div",
                  { className: "affected-package-grid" },
                  affectedRecords.map((record) => {
                    const details = record.details;
                    const display = record.display;
                    const versionSummaries = record.versionSummaries;
                    const versionForLink = record.versionForLink;
                    const versionCount = Array.isArray(record.affected.versions)
                      ? record.affected.versions.length
                      : 0;
                    const externalPackageLink =
                      display.collectionURL || display.repo || "";
                    return e(
                      "article",
                      {
                        key: record.key,
                        className: "affected-package-card",
                      },
                      e(
                        "div",
                        { className: "affected-package-title" },
                        e(
                          "strong",
                          null,
                          display.packageName || "Unknown package",
                        ),
                        e(
                          "span",
                          null,
                          display.managerLabel || "Unsupported",
                        ),
                        e(
                          "span",
                          {
                            className: record.hasFix
                              ? "remediation-status remediation-status-fixed"
                              : "remediation-status remediation-status-review",
                          },
                          record.hasFix ? "Fix available" : "Review range",
                        ),
                      ),
                      e(
                        "div",
                        { className: "affected-package-meta" },
                        versionCount > 0 &&
                          e(
                            "span",
                            { className: "affected-version-chip" },
                            `${versionCount} affected versions`,
                          ),
                        versionSummaries.map((summary) => {
                          const summaryVersion =
                            versionFromAffectedSummary(summary) || versionForLink;
                          if (details && summaryVersion) {
                            const summaryLink = buildPackageDeepLink({
                              manager: details.manager,
                              namespace: details.namespace,
                              name: details.name,
                              version: summaryVersion,
                            });
                            return e(
                              "a",
                              {
                                key: summary,
                                className:
                                  "affected-version-chip affected-version-link",
                                href: summaryLink,
                                title: `Analyze ${display.packageName} ${summaryVersion}`,
                                onClick: (event) => {
                                  event.preventDefault();
                                  analyzeAffectedPackage(
                                    record.affected,
                                    summaryVersion,
                                  );
                                },
                              },
                              summary,
                            );
                          }
                          if (externalPackageLink) {
                            return e(
                              "a",
                              {
                                key: summary,
                                className:
                                  "affected-version-chip affected-version-link",
                                href: externalPackageLink,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                title:
                                  "Open package source because the local explorer does not support this ecosystem",
                              },
                              summary,
                            );
                          }
                          return e(
                            "span",
                            {
                              key: summary,
                              className: "affected-version-chip",
                              title:
                                "Package explorer unavailable for this ecosystem",
                            },
                            summary,
                          );
                        }),
                        record.affected.database_specific?.defaultStatus &&
                          e(
                            "span",
                            { className: "affected-version-chip" },
                            `Default ${record.affected.database_specific.defaultStatus}`,
                          ),
                      ),
                      e(
                        "div",
                        {
                          className:
                            "affected-package-note affected-remediation-note",
                        },
                        record.hasFix
                          ? `Upgrade to ${record.fixedVersions
                              .slice(0, 3)
                              .join(", ")} or later where applicable.`
                          : `Affected range: ${record.versionSummaries
                              .slice(0, 3)
                              .join("; ")}`,
                      ),
                      (display.modules.length > 0 ||
                        display.programFiles.length > 0) &&
                        e(
                          "div",
                          { className: "affected-package-note" },
                          [
                            display.modules.length > 0 &&
                              `Module: ${display.modules.slice(0, 3).join(", ")}`,
                            display.programFiles.length > 0 &&
                              `File: ${display.programFiles
                                .slice(0, 3)
                                .join(", ")}`,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        ),
                      (display.repo || display.collectionURL) &&
                        e(
                          "div",
                          { className: "affected-package-links" },
                          display.repo &&
                            e(
                              "a",
                              {
                                href: display.repo,
                                target: "_blank",
                                rel: "noopener noreferrer",
                              },
                              "Repository",
                            ),
                          display.collectionURL &&
                            e(
                              "a",
                              {
                                href: display.collectionURL,
                                target: "_blank",
                                rel: "noopener noreferrer",
                              },
                              "Vendor packages",
                            ),
                        ),
                      details
                        ? e(
                            "a",
                            {
                              className: "affected-package-action",
                              href: record.localLink,
                              onClick: (event) => {
                                event.preventDefault();
                                analyzeAffectedPackage(record.affected);
                              },
                            },
                            "Analyze package",
                          )
                        : e(
                            "span",
                            { className: "affected-package-unavailable" },
                            "Package explorer unavailable for this ecosystem",
                          ),
                    );
                  }),
                )
              : e(
                  "div",
                  { className: "empty-dependencies security-empty" },
                  "No affected package or product records were published by OSV or NVD.",
                ),
            references.length > 0 &&
              e(
                React.Fragment,
                null,
                e(
                  "div",
                  { className: "cve-section-header reference-header" },
                  e("h3", null, "References"),
                  e("span", null, `${references.length} links`),
                ),
                e(
                  "div",
                  { className: "reference-list" },
                  references.map((ref, idx) =>
                    e(
                      "a",
                      {
                        key: `${ref.url}-${idx}`,
                        href: ref.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                      advisoryReferenceLabel(ref),
                    ),
                  ),
                ),
              ),
          ),
      );
    })();

  const mcpApiOrigin = apiOrigin.replace(/\/$/, "");
  const mcpExampleManager = manager || submittedManager || "npm";
  const mcpExampleNamespace = (namespace || submittedNamespace || "").trim();
  const mcpExampleName = (name || submittedName || "axios").trim();
  const mcpExampleVersion = (version || submittedVersion || "").trim();
  const mcpExampleArgs = { manager: mcpExampleManager };
  if (mcpExampleNamespace) mcpExampleArgs.namespace = mcpExampleNamespace;
  mcpExampleArgs.name = mcpExampleName;
  if (mcpExampleVersion) mcpExampleArgs.version = mcpExampleVersion;
  mcpExampleArgs.recursive = true;
  mcpExampleArgs.vulnerabilities = true;
  mcpExampleArgs.scorecard = true;
  const mcpClientConfig = JSON.stringify(
    {
      mcpServers: {
        "oss-deps-explorer": {
          command: "go",
          args: ["run", "./cmd/oss-deps-mcp", "-api", mcpApiOrigin],
          env: {
            OSS_DEPS_EXPLORER_API: mcpApiOrigin,
          },
        },
      },
    },
    null,
    2,
  );
  const mcpInfoPanel =
    showMcpInfo &&
    ReactDOM.createPortal(
      e(
        "div",
        {
          className: "mcp-dialog-backdrop",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) setShowMcpInfo(false);
          },
          role: "presentation",
        },
        e(
          "section",
          {
            className: "mcp-dialog",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "mcp-dialog-title",
          },
          e(
            "div",
            { className: "mcp-dialog-header" },
            e(
              "div",
              null,
              e("p", { className: "mcp-eyebrow" }, "Agent integration"),
              e("h3", { id: "mcp-dialog-title" }, "OSS Dependency Explorer MCP"),
            ),
            e(
              "button",
              {
                type: "button",
                className: "mcp-dialog-close",
                onClick: () => setShowMcpInfo(false),
                "aria-label": "Close MCP server details",
              },
              "Close",
            ),
          ),
          e(
            "p",
            { className: "mcp-dialog-copy" },
            "A read-only stdio MCP server is included with this project. It calls the running API so agent workflows query the same dependency graph, OSV results, repository metadata, and OpenSSF Scorecard data shown here.",
          ),
          e(
            "div",
            { className: "mcp-command-grid" },
            e(
              "div",
              { className: "mcp-command-block" },
              e("span", null, "Start API"),
              e("code", null, "docker-compose up --build api redis"),
            ),
            e(
              "div",
              { className: "mcp-command-block" },
              e("span", null, "Run MCP server"),
              e(
                "code",
                null,
                `go run ./cmd/oss-deps-mcp -api ${mcpApiOrigin}`,
              ),
            ),
          ),
          e("h4", null, "Client config"),
          e(
            "pre",
            { className: "mcp-code-block" },
            e("code", null, mcpClientConfig),
          ),
          e("h4", null, "Available tools"),
          e(
            "ul",
            { className: "mcp-tool-list" },
            [
              "search_packages: search supported ecosystems before deeper analysis",
              "research_dependencies: resolve direct and transitive dependencies with OSV and Scorecard context",
              "assess_package_reputation: summarize repository metadata and OpenSSF Scorecard signals",
              "plan_vulnerability_remediation: produce upgrade guidance from advisories, fixed versions, and parent paths",
            ].map((tool) => e("li", { key: tool }, tool)),
          ),
          e("h4", null, "Example research payload"),
          e(
            "pre",
            { className: "mcp-code-block" },
            e("code", null, JSON.stringify(mcpExampleArgs, null, 2)),
          ),
        ),
      ),
      document.body,
    );

  const packageChainCandidates = showPackageResults
    ? collectPackageChainCandidates(packageChainDeps)
    : [];
  const packageChainResolvedCount = Object.keys(packageChainDeps).length;
  const packageChainComplete =
    packageChainCandidates.length > 0 &&
    packageChainResolvedCount >= packageChainCandidates.length &&
    !packageChainLoading;
  const packageChainButtonText = packageChainLoading
    ? "Stop chain"
    : packageChainComplete
      ? "Chain complete"
      : "Build full chain";
  const packageChainStatusText =
    packageChainProgress ||
    (packageChainResolvedCount > 0
      ? `${packageChainResolvedCount}/${packageChainCandidates.length} chains resolved`
      : "");

  return e(
    "div",
    null,
    mcpInfoPanel,
    loading &&
      e(
        "div",
        { className: "loading-overlay" },
        e(
          "div",
          null,
          e("br"),
          e("br"),
          e("br"),
          "Loading...".split("").map((ch, idx) =>
            e(
              "span",
              {
                key: idx,
                className: "bounce-char",
                style: { animationDelay: `${idx * 0.1}s` },
              },
              ch,
            ),
          ),
        ),
        status &&
          e(
            "div",
            { className: "loading-status fade", key: statusKey },
            status,
          ),
        e(
          "div",
          { className: "loading-actions" },
          consoleLines.length > 0 &&
            e(
              "button",
              {
                className: "console-toggle",
                onClick: () => setShowConsole((v) => !v),
              },
              showConsole ? "Hide Console" : "Show Console",
            ),
          e(
            "button",
            {
              className: "cancel-button",
              onClick: cancelFetch,
            },
            "Cancel",
          ),
        ),
        consoleLines.length > 0 &&
          showConsole &&
          e(
            "pre",
            {
              ref: consoleBoxRef,
              className: "console-box",
              "aria-live": "polite",
              "aria-label": "Request console output",
            },
            consoleLines.join("\n"),
          ),
      ),

    e(
      "div",
      { className: "form-wrapper" },
      e(
        "form",

        { onSubmit: handlePrimarySubmit, autoComplete: "off", name: uniqueFormName },

        e(
          React.Fragment,
          null,
          e(
            "h2",
            { className: "page-title" },
              e("img", {
                src: "icons/globe.svg",
                className: "title-icon",
                onClick: () => window.location.reload(),
              }),
            " OSS Dependency Explorer",
            e(
              "button",
              {
                type: "button",
                className: "mcp-icon-button",
                onClick: (event) => {
                  event.preventDefault();
                  setShowMcpInfo(true);
                },
                title: "MCP server details",
                "aria-label": "Open MCP server details",
              },
              e("img", {
                src: "icons/server.svg",
                alt: "",
                className: "mcp-icon",
              }),
            ),
            e(
              "span",
              {
                className: "alert-icon-container",

                onClick: () => {
                  if (alerts.length) setAlerts([]);
                },
              },
              e("img", {
                src: "icons/bell.svg",
                className: `alert-icon${bellBounce ? " bell-bounce" : ""}`,
              }),
              alerts.length > 0 &&
                e("span", { className: "notification-badge" }),
              alerts.length > 0 &&
                e(
                  "div",
                  { className: "alert-box" },
                  alerts.map((msg, i) => e("div", { key: i }, msg))
                ),
            ),
            e(
              "button",
              {
                type: "button",
                className: "theme-toggle-button",
                onClick: () =>
                  setAppearanceMode((mode) =>
                    mode === "dark" ? "light" : "dark",
                  ),
                "aria-label":
                  appearanceMode === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode",
                "aria-pressed": appearanceMode === "dark",
                title:
                  appearanceMode === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode",
              },
              e("img", {
                src:
                  appearanceMode === "dark"
                    ? "icons/sun.svg"
                    : "icons/moon.svg",
                alt: "",
                className: "theme-toggle-icon",
              }),
            ),
          ),
          e("br"),
          e(
            "div",
            {
              className: "search-mode-tabs",
              role: "tablist",
              "aria-label": "Search mode",
            },
            e(
              "button",
              {
                type: "button",
                role: "tab",
                "aria-selected": searchMode === "package",
                className: searchMode === "package" ? "active" : "",
                onClick: () => setSearchMode("package"),
              },
              "Package",
            ),
            e(
              "button",
              {
                type: "button",
                role: "tab",
                "aria-selected": searchMode === "cve",
                className: searchMode === "cve" ? "active" : "",
                onClick: () => setSearchMode("cve"),
              },
              "CVE",
            ),
            e(
              "button",
              {
                type: "button",
                role: "tab",
                "aria-selected": searchMode === "repository",
                className: searchMode === "repository" ? "active" : "",
                onClick: () => setSearchMode("repository"),
              },
              "Repository",
            ),
          ),
          e(
            "div",
            {
              className: "icons-options-row",
              style: { display: searchMode === "package" ? "" : "none" },
            },
            e(
              "div",
              { className: "fields-row" },
              e(
                "div",
                { className: "manager-select" },
                e(
                  "select",
                  {
                    value: manager,
                    onPointerDown: suppressPackageSuggestionsBriefly,
                    onMouseDown: suppressPackageSuggestionsBriefly,
                    onChange: (e) => {
                      suppressPackageSuggestionsBriefly();
                      setManager(e.target.value);
                      setNameSuggestions([]);
                      setVersionRisk({});
                      setPackageTypeaheadActive(0);
                      setPackageTypeaheadOpen(false);
                    },
                  },
                  Object.entries(pmDisplayNames).map(([key, label]) =>
                    e("option", { key, value: key }, label),
                  ),
                ),
              ),
              e(
                "div",
                { className: "input-container" },
                e("input", {
                  placeholder: "Namespace (optional)",
                  value: namespace,
                  onChange: (e) => setNamespace(e.target.value),
                }),
                namespace &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => setNamespace(""),
                    },
                    "\u00d7",
                  ),
                e(
                  "div",
                  { className: "input-tooltip" },
                  "e.g. scope, group or module path",
                ),
              ),
              e(
                "div",
                { className: "input-container" },
                e("input", {
                  placeholder: "Package name",
                  value: name,
                  role: "combobox",
                  autoComplete: "off",
                  "aria-autocomplete": "list",
                  "aria-expanded": showPackageTypeahead,
                  "aria-controls": "package-typeahead-list",
                  "aria-activedescendant": showPackageTypeahead
                    ? `package-typeahead-option-${Math.min(
                        packageTypeaheadActive,
                        visiblePackageSuggestions.length - 1,
                      )}`
                    : undefined,
                  onFocus: () => setPackageTypeaheadOpen(true),
                  onBlur: () => {
                    setTimeout(() => setPackageTypeaheadOpen(false), 120);
                  },
                  onKeyDown: handlePackageTypeaheadKeyDown,
                  onChange: (e) => {
                    setName(e.target.value);
                    setPackageTypeaheadOpen(true);
                    setPackageTypeaheadActive(0);
                  },
                }),
                name &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => {
                        setName("");
                        setNameSuggestions([]);
                        setPackageTypeaheadActive(0);
                        setPackageTypeaheadOpen(false);
                      },
                    },
                    "\u00d7",
                  ),
                e("div", { className: "input-tooltip" }, "name of the package"),
                showPackageTypeahead &&
                  e(
                    "ul",
                    {
                      id: "package-typeahead-list",
                      className: "package-typeahead",
                      role: "listbox",
                    },
                    visiblePackageSuggestions.map((pkg, idx) => {
                      const value = packageDisplayName(pkg);
                      const meta = pkg.version
                        ? `latest ${pkg.version}`
                        : pkg.label && pkg.label !== value
                          ? pkg.label
                          : "";
                      const active = idx === packageTypeaheadActive;
                      return e(
                        "li",
                        {
                          key: `${manager}-${pkg.namespace || ""}-${pkg.name || pkg.value}-${pkg.version || ""}-${idx}`,
                          role: "presentation",
                        },
                        e(
                          "button",
                          {
                            id: `package-typeahead-option-${idx}`,
                            type: "button",
                            role: "option",
                            "aria-selected": active,
                            className: active ? "active" : "",
                            onMouseEnter: () => setPackageTypeaheadActive(idx),
                            onMouseDown: (evt) => evt.preventDefault(),
                            onClick: () => selectPackageTypeaheadItem(pkg),
                          },
                          e("span", { className: "typeahead-name" }, value),
                          meta &&
                            e("span", { className: "typeahead-meta" }, meta),
                        ),
                      );
                    }),
                  ),
              ),
              e(
                "div",
                { className: "input-container" },
                e("input", {
                  placeholder: "Version (optional)",
                  value: version,
                  onChange: (e) => setVersion(e.target.value),
                }),
                version &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => setVersion(""),
                    },
                    "\u00d7",
                  ),
                e(
                  "div",
                  { className: "input-tooltip" },
                  "leave blank for latest",
                ),
              ),
              e(
                "div",
                { className: "form-actions" },
                e(
                  "button",
                  { type: "submit", className: "fetch-button" },
                  "Analyze",
                ),
                e(
                  "button",
                  {
                    type: "button",
                    className: "clear-form-button",
                    onClick: clearForm,
                    disabled: !hasClearableFormState,
                    title: "Clear package search and results",
                  },
                  "Clear",
                ),
              ),
            ),
            cacheStatus &&
              e(
                "div",
                {
                  className: `cache-indicator ${
                    cacheStatus === "HIT" ? "cache-hit" : "cache-miss"
                  }`,
                },
                e("img", { src: "icons/cache.svg", className: "cache-icon" }),
                cacheStatus === "HIT" ? "Cached" : "Live",
              ),
            e(
              "div",
              { className: "version-suggestions" },
              showVersionSuggestions
              ? e(
                  React.Fragment,
                  null,
                  visibleVersionSuggestions.map((v) => {
                    const riskRecord = versionRisk[v];
                    const badge = versionRiskBadgeLabel(riskRecord);
                    const riskClass = badge ? `version-risk-${riskRecord.risk}` : "";
                    return e(
                      "button",
                      {
                        key: v,
                        type: "button",
                        className: [
                          "version-suggestion-btn",
                          riskClass,
                          riskRecord?.status === "checking"
                            ? "version-risk-checking"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" "),
                        title: versionRiskTitle(v, riskRecord),
                        onClick: (evt) => {
                          setVersion(v);
                          fetchDeps(evt, v);
                        },
                      },
                      e("span", { className: "version-suggestion-text" }, v),
                      badge &&
                        e(
                          "span",
                          {
                            className: "version-risk-badge",
                            "aria-label": `${riskRecord.risk} OSV risk`,
                          },
                          badge,
                        ),
                    );
                  }),
                  versionsToShow < versionSuggestionLimit
                    ? e(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            setVersionsToShow((prev) =>
                              Math.min(
                                prev + VERSION_SUGGESTION_PAGE_SIZE,
                                versionSuggestionLimit,
                              ),
                            );
                          },
                          className: "load-more-btn",
                        },
                        "more...",
                      )
                    : null,
                )
              : showPackageSuggestions
                ? e(
                    React.Fragment,
                    null,
                    visiblePackageSuggestions.map((pkg) =>
                      e(
                        "button",
                        {
                          key: `${manager}-${packageDisplayName(pkg)}`,
                          type: "button",
                          className: "package-suggestion-btn",
                          onClick: () => applyPackageSuggestion(pkg),
                          title: packageDisplayName(pkg),
                        },
                        packageDisplayName(pkg),
                      ),
                    ),
                  )
              : null,
          ),
          ),
          e(
            "div",
            {
              className: "cve-search-shell",
              style: { display: searchMode === "cve" ? "" : "none" },
            },
            e(
              "div",
              { className: "cve-search-row" },
              e(
                "div",
                { className: "input-container cve-input-container" },
                e("input", {
                  placeholder: "CVE-2024-3094",
                  value: cveQuery,
                  onChange: (event) => {
                    setCveQuery(event.target.value);
                    if (cveError) setCveError("");
                  },
                }),
                cveQuery &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => setCveQuery(""),
                    },
                    "\u00d7",
                  ),
                e(
                  "div",
                  { className: "input-tooltip" },
                  "paste a CVE, OSV, or GHSA advisory ID",
                ),
              ),
              e(
                "div",
                { className: "form-actions cve-form-actions" },
                e(
                  "button",
                  {
                    type: "submit",
                    className: "fetch-button",
                    disabled: cveLoading || !extractAdvisoryId(cveQuery),
                  },
                  cveLoading ? "Looking up..." : "Look up",
                ),
                e(
                  "button",
                  {
                    type: "button",
                    className: "clear-form-button",
                    onClick: clearForm,
                    disabled: !hasClearableFormState,
                    title: "Clear CVE search and results",
                  },
                  "Clear",
                ),
              ),
            ),
            e(
              "p",
              { className: "search-helper-copy" },
            "Search by advisory ID to see affected packages, references, severity, and package-analysis deep links.",
            ),
          ),
          e(
            "div",
            {
              className: "repository-search-shell",
              style: { display: searchMode === "repository" ? "" : "none" },
            },
            e(
              "div",
              { className: "github-import" },
              e(
                "div",
                { className: "github-import-row" },
                e("input", {
                  placeholder: "GitHub repo URL",
                  value: githubRepoUrl,
                  onChange: (event) => {
                    setGithubRepoUrl(event.target.value);
                    if (githubRepoError) setGithubRepoError("");
                  },
                  onKeyDown: (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      importGithubRepoDependencies(event);
                    }
                  },
                }),
                e(
                  "button",
                  {
                    type: "button",
                    className: "repo-import-button",
                    onClick: importGithubRepoDependencies,
                    disabled: githubRepoLoading || !githubRepoUrl.trim(),
                  },
                  githubRepoLoading ? "Importing..." : "Import repo",
                ),
              ),
              e(
                "p",
                { className: "search-helper-copy" },
                "Import a GitHub dependency graph, then choose any supported package for deeper analysis.",
              ),
              githubRepoError &&
                e("div", { className: "github-import-error" }, githubRepoError),
              githubRepoResult &&
                e(
                  "div",
                  { className: "github-import-results" },
                  e(
                    "div",
                    { className: "github-import-summary" },
                    e(
                      "div",
                      { className: "github-import-heading" },
                      e(
                        "div",
                        { className: "github-import-title-row" },
                        e("strong", null, githubRepoResult.repository),
                        e("span", null, "dependency graph"),
                      ),
                      e(
                        "a",
                        {
                          className: "share-link-button github-repo-share-link",
                          href: currentGithubRepoDeepLink(),
                          onClick: copyGithubRepoDeepLink,
                          title: "Copy or open a deep link to this repository import",
                        },
                        githubRepoShareStatus || "Copy repo link",
                      ),
                    ),
                    e(
                      "div",
                      { className: "github-import-stats" },
                      githubRepoSummaryFilterButton(
                        "all",
                        `${githubRepoResult.package_count} supported`,
                        {
                          title: "Show all supported packages in this repository import",
                        },
                      ),
                      githubRepoResult.unsupported_count > 0 &&
                        githubRepoSummaryFilterButton(
                          "skipped",
                          `${githubRepoResult.unsupported_count} skipped`,
                          {
                            title:
                              "Show skipped dependencies counted by GitHub but unavailable in the supported package graph",
                          },
                        ),
                      githubRepoVulnLoading &&
                        githubRepoSummaryStatus(
                          githubRepoVulnProgress || "Checking OSV",
                        ),
                      !githubRepoVulnLoading &&
                        githubRepoVulnProgress &&
                        githubRepoSummaryFilterButton(
                          githubRepoVulnerableCount > 0
                            ? "osv-findings"
                            : "checked",
                          githubRepoVulnProgress,
                          {
                            key: "repo-osv-progress-filter",
                            risk: githubRepoVulnerableCount > 0,
                            title:
                              githubRepoVulnerableCount > 0
                                ? "Show packages with OSV advisories"
                                : "Show packages with completed OSV checks",
                          },
                        ),
                      githubRepoVulnerableCount > 0 &&
                        githubRepoSummaryFilterButton(
                          "vulnerable",
                          `${githubRepoVulnerableCount} vulnerable`,
                          {
                            risk: true,
                            title: "Show vulnerable packages",
                          },
                        ),
                      githubRepoHighRiskCount > 0 &&
                        githubRepoSummaryFilterButton(
                          "high",
                          `${githubRepoHighRiskCount} high or critical`,
                          {
                            risk: true,
                            high: true,
                            title: "Show high and critical vulnerable packages",
                          },
                        ),
                      githubRepoLicenseReviewCount > 0 &&
                        githubRepoSummaryFilterButton(
                          "license-policy:needs-review",
                          `${githubRepoLicenseReviewCount} license review`,
                          {
                            key: "repo-license-policy-review",
                            policy: true,
                            title:
                              "Show packages with copyleft, missing, custom, or non-allowlisted license metadata",
                          },
                        ),
                      (githubRepoLicensePolicyCounts.copyleft || 0) > 0 &&
                        githubRepoSummaryFilterButton(
                          "license-policy:copyleft",
                          `${githubRepoLicensePolicyCounts.copyleft} copyleft`,
                          {
                            key: "repo-license-policy-copyleft",
                            high: true,
                            policy: true,
                            title: "Show packages with GPL-family copyleft licenses",
                          },
                        ),
                      (githubRepoLicensePolicyCounts.permissive || 0) > 0 &&
                        githubRepoSummaryFilterButton(
                          "license-policy:permissive",
                          `${githubRepoLicensePolicyCounts.permissive} permissive`,
                          {
                            key: "repo-license-policy-permissive",
                            policy: true,
                            title:
                              "Show packages with licenses in the built-in permissive allowlist",
                          },
                        ),
                      githubRepoCheckedCount > 0 &&
                        githubRepoSummaryFilterButton(
                          "checked",
                          `${githubRepoCheckedCount} OSV checked`,
                          { title: "Show packages with completed OSV checks" },
                        ),
                      Object.entries(githubRepoManagerCounts).map(([mgr, count]) =>
                        githubRepoSummaryFilterButton(
                          `manager:${mgr}`,
                          `${pmDisplayNames[mgr] || mgr}: ${count}`,
                          {
                            key: `repo-count-${mgr}`,
                            title: `Show ${pmDisplayNames[mgr] || mgr} packages`,
                          },
                        ),
                      ),
                      githubRepoTopLicenses.map(([license, count]) =>
                        githubRepoSummaryFilterButton(
                          `license:${license}`,
                          `${license}: ${count}`,
                          {
                            key: `repo-license-${license}`,
                            title: `Show packages with ${license} license metadata`,
                          },
                        ),
                      ),
                      githubRepoMissingLicenseCount > 0 &&
                        githubRepoSummaryFilterButton(
                          "license:missing",
                          `${githubRepoMissingLicenseCount} missing license`,
                          {
                            key: "repo-license-missing",
                            title:
                              "Show packages where GitHub dependency graph did not return SPDX license metadata",
                          },
                        ),
                    ),
                  ),
                  e(
                    "div",
                    { className: "github-import-layout" },
                    e(
                      "section",
                      {
                        className: "github-package-list-panel",
                        "aria-label": "Imported packages",
                      },
                      e(
                        "div",
                        { className: "github-package-list-header" },
                        e(
                          "div",
                          null,
                          e(
                            "strong",
                            null,
                            githubRepoShowingSkipped
                              ? "Skipped dependencies"
                              : "Packages",
                          ),
                          e(
                            "span",
                            null,
                            `${githubRepoActiveInventoryCount} shown`,
                          ),
                        ),
                        e(
                          "div",
                          { className: "github-package-list-actions" },
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: copyGithubRepoAuditBrief,
                              disabled: githubRepoActiveInventoryCount === 0,
                              title:
                                "Copy a Markdown audit brief for the current repository package filter",
                            },
                            "Copy brief",
                          ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: exportGithubRepoAuditBrief,
                              disabled: githubRepoActiveInventoryCount === 0,
                              title:
                                "Export a Markdown audit brief for the current repository package filter",
                            },
                            "Export brief",
                          ),
                          githubRepoBriefStatus &&
                            e(
                              "span",
                              {
                                className: "github-repo-brief-status",
                                role: "status",
                              },
                              githubRepoBriefStatus,
                            ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: exportGithubRepoInventory,
                              disabled: githubRepoActiveInventoryCount === 0,
                              title:
                                githubRepoShowingSkipped
                                  ? "Export skipped GitHub SBOM records as CSV"
                                  : githubRepoTransitiveExportRecords.length > 0
                                    ? `Export the current imported package filter plus ${formatNumber(githubRepoTransitiveExportRecords.length)} resolved transitive rows as CSV`
                                    : "Export the current imported package filter as CSV with license and OSV columns",
                            },
                            "Export CSV",
                          ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: githubRepoShowingSkipped
                                ? exportGithubRepoSkippedJson
                                : exportGithubRepoSbom,
                              disabled: githubRepoShowingSkipped
                                ? filteredGithubRepoUnsupportedPackages.length === 0
                                : filteredGithubRepoPackages.length === 0,
                              "aria-label": githubRepoShowingSkipped
                                ? "Export skipped dependency JSON"
                                : "Export CycloneDX SBOM",
                              title:
                                githubRepoShowingSkipped
                                  ? "Export skipped GitHub SBOM records as JSON with license and external references"
                                  : githubRepoTransitiveExportRecords.length > 0
                                    ? `Export CycloneDX JSON with direct packages, ${formatNumber(githubRepoTransitiveExportRecords.length)} resolved transitive components, and dependency edges`
                                    : "Export the current imported package filter as CycloneDX JSON with license and OSV status properties",
                            },
                            githubRepoShowingSkipped ? "Export JSON" : "Export SBOM",
                          ),
                          e(
                            "span",
                            { className: "github-package-list-count" },
                            githubRepoShowingSkipped
                              ? `${githubRepoUnsupportedPackages.length} skipped total`
                              : `${githubRepoPackages.length} total`,
                          ),
                        ),
                      ),
                      e("input", {
                        className: "github-package-filter",
                        placeholder: githubRepoShowingSkipped
                          ? "Filter skipped dependencies"
                          : "Filter imported dependencies",
                        value: githubRepoFilter,
                        onChange: (event) => setGithubRepoFilter(event.target.value),
                      }),
                      e(
                        "div",
                        {
                          className: `github-package-list${
                            githubRepoPackagePanelShowsTree && !githubRepoShowingSkipped
                              ? " tree"
                              : ""
                          }`,
                        },
                        githubRepoShowingSkipped
                          ? visibleGithubRepoUnsupportedPackages.map(
                              renderGithubRepoSkippedPackage,
                            )
                          : githubRepoPackagePanelShowsTree
                            ? filteredGithubRepoPackages.map(renderGithubRepoTreeRoot)
                            : visibleGithubRepoPackages.map((pkg, index) => {
                              const packageKey = githubRepoPackageKey(pkg);
                              const packageIdentityKey =
                                githubRepoPackageIdentityKey(pkg);
                              const vulnRecord = githubRepoPackageVulnRecord(pkg);
                              const riskClass =
                                githubRepoPackageRiskClass(vulnRecord);
                              const license = githubPackageLicense(pkg);
                              const licensePolicy =
                                githubPackageLicensePolicy(pkg);
                              const isSelected =
                                packageIdentityKey &&
                                packageIdentityKey === selectedGithubRepoPackageKey;
                              return e(
                                "button",
                                {
                                  key:
                                    packageKey ||
                                    `${pkg.manager || "pkg"}-${pkg.name || "dependency"}-${index}`,
                                  type: "button",
                                  className: `github-package-card${riskClass}${
                                    isSelected ? " selected" : ""
                                  }`,
                                  onClick: () => setSelectedGithubRepoPackage(pkg),
                                  title: pkg.purl || githubPackageLabel(pkg),
                                  "aria-pressed": isSelected,
                                },
                                e(
                                  "span",
                                  { className: "github-package-main" },
                                  e(
                                    "span",
                                    { className: "github-package-name" },
                                    githubPackageLabel(pkg),
                                  ),
                                  e(
                                    "span",
                                    { className: "github-package-version" },
                                    pkg.version || "latest",
                                  ),
                                  vulnRecord?.status === "vulnerable" &&
                                    e(
                                      "span",
                                      {
                                        className: `github-package-risk-badge${riskClass}`,
                                        title: githubRepoRiskLabel(vulnRecord),
                                      },
                                      githubRepoRiskLabel(vulnRecord),
                                    ),
                                  license &&
                                    e(
                                      "span",
                                      {
                                        className: "github-package-license-badge",
                                        title: githubPackageLicenseTitle(pkg),
                                      },
                                      license,
                                    ),
                                  licensePolicy.status !== "permissive" &&
                                    e(
                                      "span",
                                      {
                                        className: `github-package-policy-badge ${licensePolicy.status}`,
                                        title: licensePolicy.detail,
                                      },
                                      licensePolicy.shortLabel,
                                    ),
                                ),
                                e(
                                  "span",
                                  { className: "github-package-manager" },
                                  pmDisplayNames[pkg.manager] || pkg.manager,
                                ),
                              );
                            }),
                      ),
                      githubRepoShowingSkipped &&
                        filteredGithubRepoUnsupportedPackages.length >
                          visibleGithubRepoUnsupportedPackages.length &&
                        e(
                          "div",
                          { className: "github-import-more" },
                          `Showing ${visibleGithubRepoUnsupportedPackages.length} of ${filteredGithubRepoUnsupportedPackages.length}. Narrow the filter to see more.`,
                        ),
                      !githubRepoShowingSkipped &&
                        !githubRepoPackagePanelShowsTree &&
                        filteredGithubRepoPackages.length >
                          visibleGithubRepoPackages.length &&
                        e(
                          "div",
                          { className: "github-import-more" },
                          `Showing ${visibleGithubRepoPackages.length} of ${filteredGithubRepoPackages.length}. Narrow the filter to see more.`,
                        ),
                      githubRepoActiveInventoryCount === 0 &&
                        e(
                          "div",
                          { className: "github-import-empty" },
                          githubRepoFilterEmptyMessage,
                        ),
                    ),
                    e(
                      "section",
                      {
                        className: `github-repo-graph-panel${
                          githubRepoGraphExpanded ? " expanded" : ""
                        }`,
                        "aria-label": "Repository dependency graph",
                      },
                      e(
                        "div",
                        { className: "github-repo-graph-header" },
                        e(
                          "div",
                          null,
                          e("strong", null, "Dependency graph"),
                          e(
                            "span",
                            null,
                            "Repository, ecosystems, and imported packages",
                          ),
                        ),
                        e(
                          "div",
                          { className: "github-repo-graph-toolbar" },
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: () =>
                                setGithubRepoGraphExpanded((expanded) => !expanded),
                              "aria-pressed": githubRepoGraphExpanded,
                              title: githubRepoGraphExpanded
                                ? "Return the graph to the repository panel"
                                : "Expand the graph to the full site workspace",
                            },
                            githubRepoGraphExpanded ? "Collapse" : "Expand",
                          ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: "repo-graph-action-button",
                              onClick: exportGithubRepoGraphViz,
                              disabled: filteredGithubRepoPackages.length === 0,
                              title:
                                "Export the filtered repository graph as GraphViz DOT, including resolved transitive edges",
                            },
                            "Export DOT",
                          ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: `repo-graph-action-button${
                                githubRepoTransitiveLoading &&
                                githubRepoTransitiveMode === "visible"
                                  ? " danger"
                                  : " primary"
                              }`,
                              onClick: githubRepoTransitiveLoading
                                ? githubRepoTransitiveMode === "visible"
                                  ? cancelGithubRepoTransitiveDependencies
                                  : undefined
                                : () => resolveGithubRepoTransitiveDependencies("visible"),
                              disabled:
                                (githubRepoTransitiveLoading &&
                                  githubRepoTransitiveMode !== "visible") ||
                                (!githubRepoTransitiveLoading &&
                                  githubRepoTransitiveRootCandidates.length === 0),
                              title:
                                githubRepoTransitiveRootCandidates.length === 0
                                  ? "No visible packages have exact versions to resolve"
                                  : "Resolve transitive dependencies for the visible package set",
                            },
                            githubRepoTransitiveLoading &&
                              githubRepoTransitiveMode === "visible"
                              ? "Cancel visible"
                              : githubRepoTransitiveNodeCount > 0
                                ? "Resolve visible"
                                : "Resolve visible",
                          ),
                          e(
                            "button",
                            {
                              type: "button",
                              className: `repo-graph-action-button${
                                githubRepoTransitiveLoading &&
                                githubRepoTransitiveMode === "project"
                                  ? " danger"
                                  : githubRepoProjectResolutionComplete
                                    ? ""
                                    : " primary"
                              }`,
                              onClick:
                                githubRepoTransitiveLoading &&
                                githubRepoTransitiveMode === "project"
                                  ? cancelGithubRepoTransitiveDependencies
                                  : () =>
                                      resolveGithubRepoTransitiveDependencies(
                                        "project",
                                      ),
                              disabled:
                                (githubRepoTransitiveLoading &&
                                  githubRepoTransitiveMode !== "project") ||
                                (!githubRepoTransitiveLoading &&
                                  (githubRepoProjectRootCount === 0 ||
                                    githubRepoProjectResolutionComplete)),
                              title:
                                githubRepoProjectRootCount === 0
                                  ? "No repository packages have exact versions to resolve"
                                  : githubRepoProjectResolutionComplete
                                    ? "Complete dependency chain has been resolved"
                                    : "Build the complete dependency chain one package at a time",
                            },
                            githubRepoTransitiveLoading &&
                              githubRepoTransitiveMode === "project"
                              ? "Stop chain"
                              : githubRepoProjectResolutionComplete
                                ? "Chain complete"
                                : "Build full chain",
                          ),
                          githubRepoTransitiveNodeCount > 0 &&
                            !githubRepoTransitiveLoading &&
                            e(
                              "button",
                              {
                                type: "button",
                                className: "repo-graph-action-button",
                                onClick: clearGithubRepoTransitiveDependencies,
                                title: "Remove resolved transitive nodes from the graph",
                              },
                              "Clear",
                            ),
                          e(
                            "span",
                            { className: "github-package-list-count" },
                            `${formatNumber(githubRepoGraphNodeCount)} nodes`,
                          ),
                        ),
                      ),
                      (githubRepoTransitiveProgress ||
                        githubRepoTransitiveError ||
                        githubRepoTransitiveNodeCount > 0) &&
                        e(
                          "div",
                          {
                            className: `github-repo-graph-status${
                              githubRepoTransitiveError ? " warning" : ""
                            }`,
                          },
                          githubRepoTransitiveProgress ||
                            `${formatNumber(
                              githubRepoTransitiveNodeCount,
                            )} transitive nodes resolved`,
                          githubRepoTransitiveError &&
                            e("span", null, githubRepoTransitiveError),
                        ),
                      !githubRepoShowingSkipped &&
                        e(
                          "div",
                          {
                            className: "github-repo-export-manifest",
                            "aria-label": "Repository export contents",
                          },
                          e(
                            "span",
                            {
                              className: `github-repo-export-scope${
                                githubRepoTransitiveExportRecords.length > 0
                                  ? " ready"
                                  : ""
                              }`,
                            },
                            githubRepoExportCoverageLabel,
                          ),
                          e(
                            "span",
                            null,
                            `${formatNumber(filteredGithubRepoPackages.length)} direct rows`,
                          ),
                          e(
                            "span",
                            null,
                            `${formatNumber(
                              githubRepoTransitiveExportRecords.length,
                            )} transitive rows`,
                          ),
                          githubRepoFilteredRootCount > 0 &&
                            e(
                              "span",
                              null,
                              `${formatNumber(
                                githubRepoFilteredResolvedRootCount,
                              )}/${formatNumber(
                                githubRepoFilteredRootCount,
                              )} visible roots`,
                            ),
                          githubRepoTransitiveExportRootCount > 0 &&
                            e(
                              "span",
                              null,
                              `${formatNumber(
                                githubRepoTransitiveExportRootCount,
                              )} export roots`,
                            ),
                        ),
                      e("svg", {
                        ref: repoGraphRef,
                        className: "github-repo-graph",
                        role: "img",
                        "aria-label": `${githubRepoResult.repository} dependency graph`,
                      }),
                      previewGithubRepoPackage
                        ? e(
                            "div",
                            {
                              className: `github-package-detail${githubRepoPackageRiskClass(
                                previewGithubRepoVuln,
                              )}`,
                            },
                            e(
                              "div",
                              { className: "github-package-detail-header" },
                              e(
                                "div",
                                { className: "github-package-detail-heading" },
                                e(
                                  "span",
                                  { className: "github-package-detail-kicker" },
                                  "Selected package",
                                ),
                                e(
                                  "strong",
                                  { className: "github-package-detail-title" },
                                  githubPackageLabel(previewGithubRepoPackage),
                                ),
                              ),
                              e(
                                "span",
                                { className: "github-package-manager" },
                                pmDisplayNames[previewGithubRepoPackage.manager] ||
                                  previewGithubRepoPackage.manager,
                              ),
                            ),
                            e(
                              "div",
                              { className: "github-package-detail-meta" },
                              e(
                                "div",
                                { className: "github-package-detail-item" },
                                e(
                                  "span",
                                  { className: "github-package-detail-label" },
                                  "Version",
                                ),
                                e(
                                  "strong",
                                  { className: "github-package-detail-value" },
                                  previewGithubRepoPackage.version || "latest",
                                ),
                              ),
                              e(
                                "div",
                                { className: "github-package-detail-item" },
                                e(
                                  "span",
                                  { className: "github-package-detail-label" },
                                  "Security",
                                ),
                                e(
                                  "strong",
                                  {
                                    className: previewGithubRepoVuln?.status
                                      ? `github-package-security-pill${githubRepoPackageRiskClass(
                                          previewGithubRepoVuln,
                                        )}`
                                      : "github-package-security-pill",
                                  },
                                  githubRepoRiskLabel(previewGithubRepoVuln) ||
                                    (githubRepoVulnLoading
                                      ? "Checking OSV"
                                      : "Not checked"),
                                ),
                              ),
                              e(
                                "div",
                                { className: "github-package-detail-item" },
                                e(
                                  "span",
                                  { className: "github-package-detail-label" },
                                  "License",
                                ),
                                e(
                                  "strong",
                                  {
                                    className: githubPackageLicense(
                                      previewGithubRepoPackage,
                                    )
                                      ? "github-package-license-pill"
                                      : "github-package-license-pill missing",
                                    title: githubPackageLicenseTitle(
                                      previewGithubRepoPackage,
                                    ),
                                  },
                                  githubPackageLicense(previewGithubRepoPackage) ||
                                    "Missing",
                                ),
                              ),
                              e(
                                "div",
                                { className: "github-package-detail-item" },
                                e(
                                  "span",
                                  { className: "github-package-detail-label" },
                                  "Policy",
                                ),
                                e(
                                  "strong",
                                  {
                                    className: `github-package-policy-pill ${
                                      previewGithubRepoLicensePolicy?.status ||
                                      "missing"
                                    }`,
                                    title:
                                      previewGithubRepoLicensePolicy?.detail || "",
                                  },
                                  previewGithubRepoLicensePolicy?.label ||
                                    "Missing SPDX",
                                ),
                              ),
                              e(
                                "div",
                                {
                                  className:
                                    "github-package-detail-item github-package-detail-item-wide",
                                },
                                e(
                                  "span",
                                  { className: "github-package-detail-label" },
                                  "Package URL",
                                ),
                                e(
                                  "code",
                                  { className: "github-package-detail-code" },
                                  previewGithubRepoPackage.purl || "Unavailable",
                                ),
                              ),
                            ),
                            e(
                              "div",
                              { className: "github-package-detail-actions" },
                              e(
                                "button",
                                {
                                  type: "button",
                                  className:
                                    "repo-import-button github-package-detail-button",
                                  onClick: () =>
                                    analyzeGithubDependency(previewGithubRepoPackage),
                                },
                                "Analyze package",
                              ),
                            ),
                          )
                        : e(
                            "div",
                            { className: "github-package-detail-empty" },
                            "Select a package to preview package details.",
                          ),
                    ),
                  ),
                ),
            ),
          ),
          // hidden submit button to allow pressing Enter
          e(
            "button",
            {
              type: "submit",
              style: { display: "none" },
              "aria-hidden": "true",
            },
            "Submit",
          ),
        ),
      ),
    ),
      cvePanel,
      showPackageResults &&
        e(
          "div",
          { className: "graph-row" },
          e(
            "div",
            { className: "column graph-column" },
          e(
            "div",
            { className: "graph-container" },
            e("svg", { id: "graph" }),
            e(
              "div",
              { className: "graph-controls" },
              e(
                "div",
                { className: "search-wrapper" },
                e(
                  "button",
                  {
                    type: "button",
                    onClick: goBack,
                    disabled: history.length === 0,
                    className: "previous-btn",
                  },
                  "Back",
                ),
                e("input", {
                  placeholder: "Search graph",
                  value: search,
                  onChange: (e) => setSearch(e.target.value),
                  className: "search-box",
                }),
                search &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => setSearch(""),
                    },
                    "\u00d7",
                  ),
              ),
              e(
                "div",
                { className: "package-chain-actions" },
                e(
                  "button",
                  {
                    type: "button",
                    className: `package-chain-button${
                      packageChainLoading ? " danger" : " primary"
                    }`,
                    onClick: packageChainLoading
                      ? cancelPackageChainResolution
                      : resolvePackageDependencyChains,
                    disabled:
                      !packageChainLoading &&
                      (packageChainCandidates.length === 0 ||
                        packageChainComplete),
                    title:
                      packageChainCandidates.length === 0
                        ? "No exact-version dependency nodes are available to resolve"
                        : packageChainComplete
                          ? "Complete dependency chain has been resolved"
                          : "Resolve each dependency node one package chain at a time",
                  },
                  packageChainButtonText,
                ),
                packageChainResolvedCount > 0 &&
                  !packageChainLoading &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "package-chain-button secondary",
                      onClick: clearPackageChainResolution,
                      title: "Remove resolved dependency-chain expansions",
                    },
                    "Clear chain",
                  ),
                packageChainStatusText &&
                  e(
                    "span",
                    {
                      className: `package-chain-status${
                        packageChainError ? " warning" : ""
                      }`,
                    },
                    packageChainError || packageChainStatusText,
                  ),
              ),
            ),
                  ),
                e("br"),
          depLists,
        ),
        showPackageResults &&
          e(
            "div",
            {
              className: "column scorecard-column",
            },
            (() => {
            const key = formatPackage(
              submittedManager,
              submittedNamespace,
              submittedName,
            );
            const sc = scorecards[key] || null;
            const overall =
              sc && (sc.score || (sc.scorecard && sc.scorecard.score));
            const date = sc && (sc.date || (sc.scorecard && sc.scorecard.date));
            const checks = sc && Array.isArray(sc.checks) ? sc.checks : [];

            const checkCategories = {
              "Packaging & Releases": [
                "Packaging",
                "Signed-Releases",
                "Binary-Artifacts",
                "Pinned-Dependencies",
              ],
              "Security & Permissions": [
                "Token-Permissions",
                "Branch-Protection",
                "Security-Policy",
                "SAST",
                "Vulnerabilities",
              ],
              "GitHub Workflow": [
                "Code-Review",
                "Dangerous-Workflow",
                "Fuzzing",
              ],
              "Community & Maintenance": [
                "Maintained",
                "License",
                "CII-Best-Practices",
              ],
            };

            const grouped = {};
            checks.forEach((c) => {
              let placed = false;
              for (const [cat, list] of Object.entries(checkCategories)) {
                if (list.includes(c.name)) {
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(c);
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                if (!grouped.Other) grouped.Other = [];
                grouped.Other.push(c);
              }
            });

            const categories = Object.keys(checkCategories).concat(
              Object.keys(grouped).filter((k) => !(k in checkCategories))
            );

            const iconForScore = (score) => {
              if (score <= 4) return "icons/error.svg";
              if (score <= 7) return "icons/warning.svg";
              return "icons/success.svg";
            };
            return e(
              React.Fragment,
              null,
              e(
                "div",
                { className: "dependency-box" },
                e(
                  "div",
                  { className: "dependency-header" },
                  e(
                    "div",
                    { className: "dependency-header-left" },
                    e(
                      "div",
                      { className: "package-title" },
                      `${key}@${submittedVersion}`,
                    ),
                  ),
                  e(
                    "div",
                    { className: "dependency-header-right" },
                    e(
                      "a",
                      {
                        className: "share-link-button",
                        href: currentPackageDeepLink(),
                        onClick: copyPackageDeepLink,
                        title: "Copy or open a deep link to this package",
                      },
                      shareStatus || "Copy link",
                    ),
                    rootScore !== null &&
                      e(
                        "div",
                        {
                          className: `risk-number ${
                            riskFromScore(rootScore) ? `risk-${riskFromScore(rootScore)}` : ""
                          }`,
                          title:
                            "Highest vulnerability severity from OSV.dev",
                        },
                        rootScore.toFixed(1),
                      ),
                    rootCves.length > 0 &&
                      e(
                        "span",
                        { className: "cve-column" },
                        rootCves.map((c, idx) =>
                          e(
                            React.Fragment,
                            { key: idx },
                            e(
                              "a",
                              {
                                href: `https://osv.dev/vulnerability/${c.id}`,
                                target: "_blank",
                                onClick: (e) => e.stopPropagation(),
                                title: (() => {
                                  const sev = riskFromScore(c.score);
                                  const parts = [
                                    `OSV severity ${c.score}${sev ? ` (${sev})` : ""}`,
                                  ];
                                  if (c.description) parts.push(c.description);
                                  return parts.join(" - ");
                                })(),
                              },
                              c.id,
                            ),
                          ),
                        ),
                      ),
                  ),
                ),
                e(
                  "div",
                  { className: "scorecard-item info" },
                  iconManagers.includes(submittedManager) &&
                    e("img", { src: `icons/${submittedManager}.svg`, alt: "" }),
                  pmDisplayNames[submittedManager] || submittedManager,
                  e(
                    "a",
                    {
                      className: "registry-badge",
                      href: packageUrl(
                        { name: key, version: submittedVersion },
                        submittedManager,
                      ),
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                    "Registry"
                  )
                ),
                submittedNamespace &&
                  e(
                    "div",
                    { className: "scorecard-item info" },
                    `Namespace: ${submittedNamespace}`
                  ),
                repos[key] &&
                  e(
                    React.Fragment,
                    null,
                    e(
                      "div",
                      { className: "scorecard-item info" },
                      e("img", { src: "icons/github.svg", alt: "" }),
                      e(
                        "a",
                        {
                          href: `https://${repos[key]}`,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                        repos[key]
                      )
                    ),
                    repoMeta[repos[key]] &&
                      repoMeta[repos[key]].description &&
                      e(
                        "div",
                        { className: "scorecard-item info" },
                        e("img", { src: "icons/card.svg", alt: "" }),
                        repoMeta[repos[key]].description
                      ),
                    e("br"),
                    repoMeta[repos[key]] &&
                      e(
                        "div",
                        { className: "repo-columns" },
                        e(
                          "div",
                          { className: "repo-column" },
                          repoMeta[repos[key]].language &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/globe.svg", alt: "" }),
                              `Language: ${repoMeta[repos[key]].language}`
                            ),
                          repoMeta[repos[key]].language && e("br"),
                          repoMeta[repos[key]].license &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/law.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/blob/${repoMeta[repos[key]].default_branch || "main"}/LICENSE`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `License: ${repoMeta[repos[key]].license}`
                              )
                            ),
                          repoMeta[repos[key]].license && e("br"),
                          repoMeta[repos[key]].default_branch &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/git-branch.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/tree/${repoMeta[repos[key]].default_branch}`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Default branch: ${repoMeta[repos[key]].default_branch}`
                              )
                            ),
                          repoMeta[repos[key]].default_branch && e("br"),
                          repoMeta[repos[key]].created &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/calendar.svg", alt: "" }),
                              `Created: ${repoMeta[repos[key]].created.slice(0, 10)}`
                            ),
                          repoMeta[repos[key]].created && e("br"),
                          repoMeta[repos[key]].updated &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/calendar.svg", alt: "" }),
                              `Updated: ${repoMeta[repos[key]].updated.slice(0, 10)}`
                            ),
                          repoMeta[repos[key]].updated && e("br"),
                          repoMeta[repos[key]].last_commit &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/clock.svg", alt: "" }),
                              `Last commit: ${repoMeta[repos[key]].last_commit.slice(0, 10)}`
                            ),
                          repoMeta[repos[key]].last_commit && e("br"),
                          repoMeta[repos[key]].archived !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/archive.svg", alt: "" }),
                              `Archived: ${repoMeta[repos[key]].archived ? "yes" : "no"}`
                            ),
                          repoMeta[repos[key]].archived !== undefined && e("br")
                        ),
                        e(
                          "div",
                          { className: "repo-column" },
                          repoMeta[repos[key]].commit_count !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/git-commit.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/commits/${repoMeta[repos[key]].default_branch || ""}`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Commits: ${formatNumber(repoMeta[repos[key]].commit_count)}`
                              )
                            ),
                          repoMeta[repos[key]].commit_count !== undefined && e("br"),
                          repoMeta[repos[key]].pulls_open !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/git-pull-request.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/pulls?q=is%3Apr+is%3Aopen`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Open PRs: ${formatNumber(repoMeta[repos[key]].pulls_open)}`
                              )
                            ),
                          repoMeta[repos[key]].pulls_open !== undefined && e("br"),
                          repoMeta[repos[key]].pulls_closed !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/git-pull-request.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/pulls?q=is%3Apr+is%3Aclosed`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Closed PRs: ${formatNumber(repoMeta[repos[key]].pulls_closed)}`
                              )
                            ),
                          repoMeta[repos[key]].pulls_closed !== undefined && e("br"),
                          repoMeta[repos[key]].watchers !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/star.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/watchers`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Watchers: ${formatNumber(repoMeta[repos[key]].watchers)}`
                              )
                            ),
                          repoMeta[repos[key]].watchers !== undefined && e("br"),
                          repoMeta[repos[key]].stars !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/star.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/stargazers`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Stars: ${formatNumber(repoMeta[repos[key]].stars)}`
                              )
                            ),
                          repoMeta[repos[key]].stars !== undefined && e("br"),
                          repoMeta[repos[key]].forks !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/git-branch.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/network/members`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Forks: ${formatNumber(repoMeta[repos[key]].forks)}`
                              )
                            ),
                          repoMeta[repos[key]].forks !== undefined && e("br"),
                          repoMeta[repos[key]].issues !== undefined &&
                            e(
                              "div",
                              { className: "scorecard-item" },
                              e("img", { src: "icons/card.svg", alt: "" }),
                              e(
                                "a",
                                {
                                  href: `https://${repos[key]}/issues`,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                },
                                `Open issues: ${formatNumber(repoMeta[repos[key]].issues)}`
                              )
                            ),
                          repoMeta[repos[key]].issues !== undefined && e("br"),
                        )
                      )
                  )
                ),
              e("br"),
              includeScorecard &&
                e(
                  "div",
                  { className: "scorecard-box" },
                  sc &&
                    sc.repo &&
                    e(
                    "a",
                    {
                      className: "scorecard-badge",
                      href: `https://scorecard.dev/viewer/?uri=${sc.repo.name}`,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      title: (() => {
                        const parts = [];
                        if (sc.scorecard && sc.scorecard.version) {
                          parts.push(`Scorecard Version: ${sc.scorecard.version}`);
                        }
                        if (sc.scorecard && sc.scorecard.commit) {
                          parts.push(
                            `Scorecard Commit: ${sc.scorecard.commit.substring(0, 7)}`,
                          );
                        }
                        if (date) {
                          parts.push(
                            `Generated at: ${new Date(date).toISOString().slice(0, 10)}`,
                          );
                        }
                        return parts.join("\n");
                      })(),
                    },
                    "OpenSSF Scorecard",
                    e("img", { src: "icons/open.svg", alt: "" })
                  ),
                sc
                    ? e(
                        React.Fragment,
                        null,
                      overall !== undefined &&
                        e(
                          "div",
                          {
                            className: "scorecard-score",
                            title: "Overall score reported by OpenSSF Scorecard",
                          },
                          e(
                            "div",
                            { className: "score-value" },
                            e("img", { src: "icons/star.svg" }),
                            overall,
                          ),
                          e("br"),
                          e(
                            "div",
                            { className: "scorecard-progress" },
                            e("div", {
                              className: "scorecard-bar",
                              style: {
                                width: `${(Math.max(overall, 0) / 10) * 100}%`,
                                backgroundColor: barColor(overall),
                              },
                            }),
                          ),
                        ),
                      overall !== undefined && e("br"),
                      sc.license &&
                        e(
                          "div",
                          {
                            className: "scorecard-item info",
                            title: "License detected for the repository",
                          },
                          `License: ${sc.license}`,
                        ),
                      categories.map((cat) =>
                        e(
                          "div",
                          { className: "check-category", key: `cat-${cat}` },
                          e("div", { className: "list-title" }, cat),
                          e(
                            "ul",
                            { className: "check-list" },
                            (grouped[cat] || []).map((c, i) =>
                              e(
                                React.Fragment,
                                { key: `check-${cat}-${i}` },
                                e(
                                  "li",
                                  {
                                    className: "scorecard-item",
                                    title: c.documentation && c.documentation.short,
                                  },
                                  e(
                                    "div",
                                    { className: "check-name" },
                                    e("img", {
                                      src: iconForScore(c.score),
                                      className: "scorecard-icon",
                                      title:
                                        c.score <= 7
                                          ? c.reason || (c.details && c.details.join("; "))
                                          : undefined,
                                    }),
                                    c.name,
                                  ),
                                  e(
                                    "div",
                                    { className: "check-score-wrapper" },
                                    e(
                                      "div",
                                      { className: "scorecard-progress small" },
                                      e("div", {
                                        className: "scorecard-bar",
                                        style: {
                                          width: `${(Math.max(c.score, 0) / 10) * 100}%`,
                                          backgroundColor: barColor(c.score),
                                        },
                                      }),
                                    ),
                                    e("span", { className: "check-score" }, c.score),
                                  ),
                                ),
                                [
                                  "Signed-Releases",
                                  "Fuzzing",
                                  "License",
                                ].includes(c.name) &&
                                i !== (grouped[cat] || []).length - 1
                                  ? e("br")
                                  : null,
                              ),
                            ),
                          ),
                        ),
                      ),
                    )
                  : e("div", null, "No Scorecard Data"),
              ),
            );
          })(),
        ),
      ),
  );
}

const container = document.getElementById("app");
if (ReactDOM.createRoot) {
  ReactDOM.createRoot(container).render(e(App));
} else {
  ReactDOM.render(e(App), container);
}
