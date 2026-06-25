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

function App() {
  const apiOrigin =
    window.location.port === "8081"
      ? window.location.origin.replace("8081", "8080")
      : window.location.origin;
  const initialDeepLink = React.useMemo(() => parsePackageDeepLink(), []);
  const initialCveDeepLink = React.useMemo(() => parseCveDeepLink(), []);
  const initialDeepLinkRef = React.useRef(initialDeepLink);
  const initialCveDeepLinkRef = React.useRef(initialCveDeepLink);
  const deepLinkLoadedRef = React.useRef(false);
  const [searchMode, setSearchMode] = React.useState(
    initialCveDeepLink ? "cve" : "package",
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
  const [showPalette, setShowPalette] = React.useState(false);
  const [showMcpInfo, setShowMcpInfo] = React.useState(false);
  const paletteRef = React.useRef(null);
  const MIN_BRIGHTNESS = 10;
  const [bgSettings, setBgSettings] = React.useState(() => {
    const v = localStorage.getItem("bgSettings");
    const defaults = {
      r: 0,
      g: 0,
      b: 30,
      opacity: 0.65,
      brightness: 100,
      elementOpacity: 1,
    };
    const parsed = v ? { ...defaults, ...JSON.parse(v) } : defaults;
    if (parsed.brightness < MIN_BRIGHTNESS) parsed.brightness = MIN_BRIGHTNESS;
    if (parsed.elementOpacity > 1) parsed.elementOpacity = 1;
    if (parsed.elementOpacity < 0.9) parsed.elementOpacity = 0.9;
    return parsed;
  });
  const nodesRef = React.useRef(null);
  const labelsRef = React.useRef(null);
  const centeredRef = React.useRef(false);
  const graphSizeRef = React.useRef({ width: 0, height: 0 });
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
  const [repos, setRepos] = React.useState({});
  const [repoMeta, setRepoMeta] = React.useState({});
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = React.useState("");
  const [githubRepoLoading, setGithubRepoLoading] = React.useState(false);
  const [githubRepoResult, setGithubRepoResult] = React.useState(null);
  const [githubRepoError, setGithubRepoError] = React.useState("");
  const [githubRepoFilter, setGithubRepoFilter] = React.useState("");
  const [cveQuery, setCveQuery] = React.useState(
    initialCveDeepLink?.id || "",
  );
  const [cveLoading, setCveLoading] = React.useState(false);
  const [cveResult, setCveResult] = React.useState(null);
  const [cveError, setCveError] = React.useState("");
  const [cveSubmitted, setCveSubmitted] = React.useState(false);
  const showResults = formSubmitted && !loading;
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

  React.useEffect(() => {
    const el = document.querySelector(".console-box");
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [consoleLines]);

  React.useEffect(() => {
    const { r, g, b, opacity, brightness, elementOpacity } = bgSettings;
    const factor = Math.max(brightness, MIN_BRIGHTNESS) / 100;
    const adjust = (value) => {
      const v =
        factor >= 1
          ? value + (255 - value) * (factor - 1)
          : value * factor;
      return Math.round(v > 255 ? 255 : v);
    };
    const adjustedR = adjust(r);
    const adjustedG = adjust(g);
    const adjustedB = adjust(b);
    document.body.style.backgroundColor = `rgba(${adjustedR},${adjustedG},${adjustedB},${opacity})`;
    document.body.style.filter = "";
    document.documentElement.style.setProperty(
      "--element-opacity",
      elementOpacity.toString()
    );
  }, [bgSettings]);


  const saveBgSettings = React.useCallback(() => {
    localStorage.setItem("bgSettings", JSON.stringify(bgSettings));
  }, [bgSettings]);

  React.useEffect(() => {
    if (!showPalette) return;
    const handleClick = (ev) => {
      if (paletteRef.current && !paletteRef.current.contains(ev.target)) {
        setShowPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPalette]);

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
    URL.revokeObjectURL(url);
  };

  const csvValue = (value) => {
    const str = String(value === undefined || value === null ? "" : value);
    return `"${str.replace(/"/g, '""')}"`;
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
    labelsRef.current.attr("fill", (d) =>
      term && d.id.toLowerCase().includes(term) ? "#f00" : "#c9d1d9",
    ).style("display", (d) => {
      const matches = term && d.id.toLowerCase().includes(term);
      return matches || d.labelBaseVisible ? null : "none";
    });
  }, [search]);

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
        .catch((err) => console.error("suggest failed", err));
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
    if (!showResults) return;
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
  }, [showResults]);

  React.useEffect(() => {
    if (!showResults) return;
    const direct = {};
    deps.forEach((d) => {
      if (!d.transitive) direct[d.name] = d.version;
    });
    const rootRisk = rootScore !== null ? riskFromScore(rootScore) : null;
    const rootKey = formatPackage(
      submittedManager,
      submittedNamespace,
      submittedName,
    );
    const rootOsvStatus = vulnerabilityStatus[rootKey] || null;
    buildGraph(deps, rootKey || submittedName, submittedVersion, direct, rootRisk, rootOsvStatus);
  }, [
    showResults,
    deps,
    submittedName,
    submittedVersion,
    submittedNamespace,
    submittedManager,
    rootScore,
    includeVuln,
    vulnerabilityStatus,
    graphResizeKey,
  ]);

  React.useEffect(
    () => () => {
      if (shareStatusTimerRef.current) {
        clearTimeout(shareStatusTimerRef.current);
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

  const githubPackageSearchText = (pkg) =>
    [
      githubPackageLabel(pkg),
      pkg.version,
      pkg.manager,
      pmDisplayNames[pkg.manager],
      pkg.purl,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

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
      console.error("version lookup failed", err);
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
      console.error("osv query failed", err);
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

  const analyzeAffectedPackage = (affected) => {
    const details = affectedPackageDetails(affected);
    if (!details) return;
    suppressPackageSuggestionsBriefly();
    setSearchMode("package");
    setManager(details.manager);
    setNamespace(details.namespace);
    setName(details.name);
    setVersion("");
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
      null,
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
        if (resp.status === 404) {
          throw new Error(
            `${id} was not found in OSV. Try the NVD link or confirm the CVE ID.`,
          );
        }
        throw new Error(text.trim() || `OSV lookup failed: ${resp.status}`);
      }
      const data = JSON.parse(text);
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
    setFormSubmitted(true);
    setLoading(true);
    setStatus("Determining version...");
    setConsoleLines([]);
    setShowConsole(false);
    setVulnerabilityStatus({});

    setCacheStatus("");


    let ver = forcedVer !== null ? forcedVer : version;
    if (!ver) {
      const info = await getVersionInfo(mgrVal, nsVal, nameVal, true);
      if (info) {
        nsVal = info.namespace || "";
        nameVal = info.name || nameVal;
        ver = info.latest || (Array.isArray(info.versions) && info.versions[0]) || "";
      }
      if (!ver) {
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

      const enc = encodeURIComponent;
      const base = `${apiOrigin}/api/dependencies/${enc(mgrVal)}`;
      let path = "";
      if (mgrVal === "go") {
        const modulePath = nsVal ? `${nsVal}/${nameVal}` : nameVal;
        path = `${base}/${modulePath.split("/").map(enc).join("/")}/${enc(ver)}`;
      } else {
        path = nsVal
          ? `${base}/${enc(nsVal)}/${enc(nameVal)}/${enc(ver)}`
          : `${base}/${enc(nameVal)}/${enc(ver)}`;
      }

      const urlDirect = `${path}?recursive=false&vuln=true&scorecard=true`;
      const urlAll = `${path}?recursive=true&vuln=true&scorecard=true`;

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
      let fetchedResults = false;
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
        fetchedResults = true;
        setCacheStatus(resArr[1].cache || resArr[0].cache);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
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
      if (fetchedResults && options.updateUrl !== false) {
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

  const importGithubRepoDependencies = async (evt) => {
    if (evt && evt.preventDefault) evt.preventDefault();
    const repo = githubRepoUrl.trim();
    if (!repo || githubRepoLoading) return;
    setGithubRepoLoading(true);
    setGithubRepoError("");
    setGithubRepoResult(null);
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
        cacheStatus ||
        githubRepoUrl ||
        githubRepoFilter ||
        githubRepoResult ||
        githubRepoError ||
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
    setRepos({});
    setGithubRepoUrl("");
    setGithubRepoLoading(false);
    setGithubRepoResult(null);
    setGithubRepoError("");
    setGithubRepoFilter("");
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
    const added = new Set([`${rootName}@${rootVersion}`]);
    const versionMap = {};
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
          links.push({ source: `${d.parent}@${pv}`, target: id });
        }
      } else {
        links.push({ source: `${rootName}@${rootVersion}`, target: id });
      }
    });
    const svg = d3.select("#graph");
    svg.selectAll("*").remove();
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const largeGraph = nodes.length > 55;
    const compactGraph = width < 520;
    nodes.forEach((node) => {
      node.labelBaseVisible =
        compactGraph ||
        (!largeGraph && !compactGraph) ||
        node.root ||
        node.risk ||
        isUnresolvedOsvStatus(node.osvStatus) ||
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

    const zoomToFit = () => {
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padding = 40;
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const scale = Math.min(
        1,
        width / (contentW + padding * 2),
        height / (contentH + padding * 2)
      );
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

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(largeGraph ? 90 : compactGraph ? 44 : 60),
      )
      .force(
        "charge",
        d3.forceManyBody().strength(largeGraph ? -230 : compactGraph ? -75 : -120),
      )
      .force("collide", d3.forceCollide(largeGraph ? 24 : compactGraph ? 15 : 20))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("float", floatForce);

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

    const label = zoomLayer
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) => d.id)
      .attr("font-size", compactGraph ? 5.5 : largeGraph ? 9 : 10)
      .attr("fill", (d) => (d.risk ? fillFor(d) : "#c9d1d9"))
      .attr("text-anchor", compactGraph ? "middle" : "start")
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(13, 17, 23, 0.92)")
      .attr("stroke-width", compactGraph ? 2 : 2.5)
      .attr("stroke-linejoin", "round")
      .style("display", (d) => (d.labelBaseVisible ? null : "none"))
      .style("pointer-events", "none")
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const at = d.id.lastIndexOf("@");
        if (at <= 0) return;
        pivotSearch({ name: d.id.slice(0, at), version: d.id.slice(at + 1) });
      });

    nodesRef.current = node;
    labelsRef.current = label;

    if (!centeredRef.current) {
      setTimeout(() => {
        if (largeGraph || compactGraph) {
          zoomToFit();
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
      }, 500);
      centeredRef.current = true;
    }

    // Keep simulation running after it stabilizes
    simulation.on("end", () => {
      simulation.alphaTarget(0.05).restart();
    });
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label
        .attr("x", (d) => (compactGraph ? d.x : d.x + 10))
        .attr("y", (d) => (compactGraph ? d.y - 7 : d.y));
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
    if (!showResults) return null;
    const displayDeps = normalizeDependencyRisks(deps);
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

    const renderSecurityOverview = (analysis) =>
      e(
        "section",
        { className: "security-overview" },
        e(
          "div",
          { className: "security-overview-header" },
          e(
            "div",
            null,
            e("h3", null, "Security Triage"),
            e(
              "p",
              null,
              includeVuln
                ? `${analysis.totals.checkedPackages} packages tracked; ${analysis.totals.cleanPackages} checked clean; ${analysis.totals.unresolvedPackages} OSV unresolved`
                : `${analysis.totals.checkedPackages} packages tracked; OSV not checked`,
            ),
          ),
          e(
            "div",
            { className: "security-actions" },
            e(
              "button",
              {
                type: "button",
                onClick: () => exportSecurityAnalysis(analysis, "json"),
              },
              "Export JSON",
            ),
            e(
              "button",
              {
                type: "button",
                onClick: () => exportSecurityAnalysis(analysis, "cyclonedx"),
                title: "Export CycloneDX SBOM with OSV vulnerability details",
              },
              "Export SBOM",
            ),
            e(
              "button",
              {
                type: "button",
                onClick: () => exportSecurityAnalysis(analysis, "csv"),
                disabled: analysis.findings.length === 0,
              },
              "Export CSV",
            ),
          ),
        ),
        e(
          "div",
          { className: "security-stat-grid" },
          e(
            "div",
            { className: "security-stat" },
            e("span", { className: "security-stat-value" }, analysis.totals.findings),
            e("span", null, "vulnerable packages"),
          ),
          e(
            "div",
            { className: "security-stat" },
            e(
              "span",
              { className: "security-stat-value risk-high" },
              analysis.severity.high + analysis.severity.critical,
            ),
            e("span", null, "high or critical"),
          ),
          e(
            "div",
            { className: "security-stat" },
            e("span", { className: "security-stat-value" }, analysis.totals.transitiveFindings),
            e("span", null, "transitive findings"),
          ),
          e(
            "div",
            { className: "security-stat" },
            e("span", { className: "security-stat-value" }, analysis.totals.cleanPackages),
            e("span", null, "no OSV advisory"),
          ),
          e(
            "div",
            { className: "security-stat" },
            e(
              "span",
              { className: "security-stat-value risk-unknown" },
              analysis.totals.unresolvedPackages,
            ),
            e("span", null, "OSV unresolved"),
          ),
        ),
        includeVuln &&
          e(
            "p",
            { className: "osv-status-note" },
            "Gray dots mean OSV checked the resolved version and returned no advisory. Amber outlined dots mean OSV was not resolved or not checked.",
          ),
        e(
          "div",
          { className: "dependency-filter-row" },
          e(
            "button",
            {
              type: "button",
              className: dependencyListFilter === "all" ? "active" : "",
              onClick: () => setDependencyListFilter("all"),
            },
            "All dependencies",
          ),
          e(
            "button",
            {
              type: "button",
              className: dependencyListFilter === "vulnerable" ? "active" : "",
              onClick: () => setDependencyListFilter("vulnerable"),
              disabled: !includeVuln || analysis.findings.length === 0,
            },
            "Vulnerable only",
          ),
          e(
            "button",
            {
              type: "button",
              className: dependencyListFilter === "unknown" ? "active" : "",
              onClick: () => setDependencyListFilter("unknown"),
              disabled: !includeVuln || analysis.totals.unresolvedPackages === 0,
            },
            "OSV unresolved",
          ),
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
      const defaultCollapsed =
        !dep.root && largeDependencySet && children.length > 0 && !dep.risk;
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
  const githubRepoQuery = githubRepoFilter.trim().toLowerCase();
  const filteredGithubRepoPackages = githubRepoQuery
    ? githubRepoPackages.filter((pkg) =>
        githubPackageSearchText(pkg).includes(githubRepoQuery),
      )
    : githubRepoPackages;
  const visibleGithubRepoPackages = filteredGithubRepoPackages.slice(0, 80);
  const githubRepoManagerCounts = githubRepoPackages.reduce((acc, pkg) => {
    acc[pkg.manager] = (acc[pkg.manager] || 0) + 1;
    return acc;
  }, {});
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
      const references = Array.isArray(cveResult?.references)
        ? cveResult.references.filter((ref) => ref && ref.url).slice(0, 8)
        : [];
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
                  title: "Highest severity found in the OSV record",
                },
                score.toFixed(1),
              ),
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
            "Looking up the advisory and affected packages...",
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
                aliases.length > 0 &&
                  e(
                    "div",
                    { className: "cve-aliases" },
                    aliases.map((alias) =>
                      e("span", { key: alias }, alias),
                    ),
                  ),
              ),
              e(
                "div",
                { className: "cve-meta-panel" },
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
                Array.isArray(cveResult.severity) &&
                  cveResult.severity.slice(0, 3).map((sev, idx) =>
                    e(
                      "div",
                      { key: `${sev.type || "severity"}-${idx}` },
                      e("span", null, sev.type || "Score"),
                      e("strong", null, sev.score),
                    ),
                  ),
              ),
            ),
            e(
              "div",
              { className: "cve-section-header" },
              e("h3", null, "Affected Packages"),
              e("span", null, `${affected.length} package records`),
            ),
            affected.length > 0
              ? e(
                  "div",
                  { className: "affected-package-grid" },
                  affected.slice(0, 24).map((record, idx) => {
                    const details = affectedPackageDetails(record);
                    const fixed = affectedFixedVersions(record).slice(0, 4);
                    const versionCount = Array.isArray(record.versions)
                      ? record.versions.length
                      : 0;
                    const localLink = details
                      ? buildPackageDeepLink({
                          manager: details.manager,
                          namespace: details.namespace,
                          name: details.name,
                          version: "",
                        })
                      : "";
                    return e(
                      "article",
                      {
                        key: `${details?.packageName || "affected"}-${idx}`,
                        className: "affected-package-card",
                      },
                      e(
                        "div",
                        { className: "affected-package-title" },
                        e(
                          "strong",
                          null,
                          details?.packageName ||
                            record.package?.name ||
                            "Unknown package",
                        ),
                        e(
                          "span",
                          null,
                          details?.managerLabel ||
                            record.package?.ecosystem ||
                            "Unsupported",
                        ),
                      ),
                      e(
                        "div",
                        { className: "affected-package-meta" },
                        versionCount > 0 &&
                          e("span", null, `${versionCount} affected versions`),
                        fixed.length > 0
                          ? e("span", null, `Fixed in ${fixed.join(", ")}`)
                          : e("span", null, "No fixed version listed"),
                      ),
                      details
                        ? e(
                            "a",
                            {
                              className: "affected-package-action",
                              href: localLink,
                              onClick: (event) => {
                                event.preventDefault();
                                analyzeAffectedPackage(record);
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
                  "OSV did not list affected packages for this advisory.",
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
          e("pre", { className: "console-box" }, consoleLines.join("\n")),
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
                "span",
                {
                  className: "palette-icon-container",
                },
                e("img", {
                  src: "icons/palette.svg",
                  className: "palette-icon",
                  onClick: () => setShowPalette((v) => !v),
                }),
                showPalette &&
                  ReactDOM.createPortal(
                    e(
                      "div",
                      { className: "palette-box", ref: paletteRef },
                    [
                    ["R", 255],
                    ["G", 255],
                    ["B", 255],
                  ].map(([label, max], idx) =>
                    e(
                      "label",
                      { key: label },
                      `${label}: ${bgSettings[label.toLowerCase()]}`,
                      e("input", {
                        type: "range",
                        min: 0,
                        max: max,
                        value: bgSettings[label.toLowerCase()],
                        onChange: (ev) =>
                          setBgSettings((s) => ({
                            ...s,
                            [label.toLowerCase()]: Number(ev.target.value),
                          })),
                      })
                    )
                  ),
                  e(
                    "label",
                    null,
                    `Opacity: ${bgSettings.opacity}`,
                    e("input", {
                      type: "range",
                      min: 0,
                      max: 1,
                      step: 0.05,
                      value: bgSettings.opacity,
                      onChange: (ev) =>
                        setBgSettings((s) => ({
                          ...s,
                          opacity: parseFloat(ev.target.value),
                        })),
                    })
                  ),
                  e(
                    "label",
                    null,
                    `Background Brightness: ${bgSettings.brightness}`,
                    e("input", {
                      type: "range",
                      min: MIN_BRIGHTNESS,
                      max: 150,
                      value: bgSettings.brightness,
                      onChange: (ev) =>
                        setBgSettings((s) => ({
                          ...s,
                          brightness: Math.max(
                            MIN_BRIGHTNESS,
                            Number(ev.target.value)
                          ),
                        })),
                    })
                  ),
                  e(
                    "label",
                    null,
                    `Item Transparency: ${Math.round(
                      (1 - bgSettings.elementOpacity) * 100
                    )}%`,
                    e("input", {
                      type: "range",
                      min: 0.9,
                      max: 1,
                      step: 0.01,
                      value: bgSettings.elementOpacity,
                      onChange: (ev) =>
                        setBgSettings((s) => ({
                          ...s,
                          elementOpacity: parseFloat(ev.target.value),
                        })),
                    })
                  ),
                  e(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                          saveBgSettings();
                          setShowPalette(false);
                        },
                      },
                    "Save"
                  )
                ),
                document.body
              )
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
              className: "search-row",
              style: { display: searchMode === "package" ? "" : "none" },
            },
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
                    null,
                    e("strong", null, githubRepoResult.repository),
                    ` dependency graph`,
                  ),
                  e(
                    "div",
                    { className: "github-import-stats" },
                    e("span", null, `${githubRepoResult.package_count} supported`),
                    githubRepoResult.unsupported_count > 0 &&
                      e(
                        "span",
                        null,
                        `${githubRepoResult.unsupported_count} skipped`,
                      ),
                    Object.entries(githubRepoManagerCounts).map(([mgr, count]) =>
                      e(
                        "span",
                        { key: `repo-count-${mgr}` },
                        `${pmDisplayNames[mgr] || mgr}: ${count}`,
                      ),
                    ),
                  ),
                ),
                e("input", {
                  className: "github-package-filter",
                  placeholder: "Filter imported dependencies",
                  value: githubRepoFilter,
                  onChange: (event) => setGithubRepoFilter(event.target.value),
                }),
                e(
                  "div",
                  { className: "github-package-grid" },
                  visibleGithubRepoPackages.map((pkg) =>
                    e(
                      "button",
                      {
                        key: `${pkg.purl}-${pkg.spdx_id || ""}`,
                        type: "button",
                        className: "github-package-card",
                        onClick: () => analyzeGithubDependency(pkg),
                        title: pkg.purl,
                      },
                      e(
                        "span",
                        { className: "github-package-main" },
                        e("span", { className: "github-package-name" }, githubPackageLabel(pkg)),
                        e(
                          "span",
                          { className: "github-package-version" },
                          pkg.version || "latest",
                        ),
                      ),
                      e(
                        "span",
                        { className: "github-package-manager" },
                        pmDisplayNames[pkg.manager] || pkg.manager,
                      ),
                    ),
                  ),
                ),
                filteredGithubRepoPackages.length > visibleGithubRepoPackages.length &&
                  e(
                    "div",
                    { className: "github-import-more" },
                    `Showing ${visibleGithubRepoPackages.length} of ${filteredGithubRepoPackages.length}. Narrow the filter to see more.`,
                  ),
                filteredGithubRepoPackages.length === 0 &&
                  e(
                    "div",
                    { className: "github-import-empty" },
                    "No imported dependencies match this filter.",
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
      showResults &&
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
            ),
                  ),
                e("br"),
          depLists,
        ),
        formSubmitted &&
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
