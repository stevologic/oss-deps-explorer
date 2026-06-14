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
  ],
  go: [
    { namespace: "github.com/gin-gonic", name: "gin" },
    { namespace: "github.com/spf13", name: "cobra" },
    { namespace: "golang.org/x", name: "net" },
    { namespace: "google.golang.org", name: "grpc" },
    { namespace: "github.com/stretchr", name: "testify" },
    { namespace: "github.com/go-chi", name: "chi/v5" },
  ],
  maven: [
    { namespace: "org.apache.logging.log4j", name: "log4j-core" },
    { namespace: "org.springframework", name: "spring-core" },
    { namespace: "com.fasterxml.jackson.core", name: "jackson-databind" },
    { namespace: "org.apache.commons", name: "commons-lang3" },
    { namespace: "com.google.guava", name: "guava" },
    { namespace: "junit", name: "junit" },
  ],
  cargo: [
    { name: "serde" },
    { name: "tokio" },
    { name: "rand" },
    { name: "reqwest" },
    { name: "clap" },
    { name: "anyhow" },
    { name: "thiserror" },
  ],
  rubygems: [
    { name: "rails" },
    { name: "rack" },
    { name: "nokogiri" },
    { name: "sidekiq" },
    { name: "puma" },
    { name: "devise" },
  ],
  nuget: [
    { name: "Newtonsoft.Json" },
    { name: "Serilog" },
    { name: "Microsoft.Extensions.Logging" },
    { name: "Dapper" },
    { name: "NUnit" },
    { name: "AutoMapper" },
    { name: "Polly" },
  ],
  composer: [
    { namespace: "laravel", name: "framework" },
    { namespace: "symfony", name: "console" },
    { namespace: "guzzlehttp", name: "guzzle" },
    { namespace: "monolog", name: "monolog" },
    { namespace: "phpunit", name: "phpunit" },
    { namespace: "doctrine", name: "orm" },
    { namespace: "psr", name: "log" },
  ],
};

function App() {
  const apiOrigin =
    window.location.port === "8081"
      ? window.location.origin.replace("8081", "8080")
      : window.location.origin;
  const [manager, setManager] = React.useState("npm");
  const [namespace, setNamespace] = React.useState("");
  const [name, setName] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [latestVersions, setLatestVersions] = React.useState([]);
  const [versionsToShow, setVersionsToShow] = React.useState(5);
  const VERSION_SUGGESTION_PAGE_SIZE = 5;
  const MAX_SUGGESTED_VERSIONS = 24;
  const PACKAGE_SUGGESTION_LIMIT = 8;
  const [deps, setDeps] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [nameSuggestions, setNameSuggestions] = React.useState([]);
  const [packageTypeaheadOpen, setPackageTypeaheadOpen] =
    React.useState(false);
  const [packageTypeaheadActive, setPackageTypeaheadActive] =
    React.useState(0);

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
  const [repos, setRepos] = React.useState({});
  const [repoMeta, setRepoMeta] = React.useState({});
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const showResults = formSubmitted && !loading;
  const [includeVuln, setIncludeVuln] = React.useState(() => {
    const v = localStorage.getItem("includeVuln");
    return v === null ? true : v === "true";
  });
  const [includeTransitive, setIncludeTransitive] = React.useState(() => {
    const v = localStorage.getItem("includeTransitive");
    return v === null ? true : v === "true";
  });
  const [includeScorecard, setIncludeScorecard] = React.useState(() => {
    const v = localStorage.getItem("includeScorecard");
    return v === null ? true : v === "true";
  });
  const showVersionSuggestions =
    !packageTypeaheadOpen && !version && latestVersions.length > 0;

  React.useEffect(() => {
    if (formSubmitted) {
      const el = document.getElementById('quote-overlay');
      if (el) {
        el.remove();
        document.body.classList.add('show-scroll');
      }
    }
  }, [formSubmitted]);

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
      const advisoryRisk = riskFromScore(Math.max(0, ...advisoryScores));
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

  const applyPackageSuggestion = (pkg) => {
    const parsed = parsePackageInput(
      manager,
      pkg.namespace || "",
      pkg.name || pkg.value || "",
    );
    setNamespace(parsed.namespace || "");
    setName(parsed.name || "");
    setVersion("");
    setLatestVersions([]);
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

  const fetchOsvVulns = async (mgr, pkg, ver) => {
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
    if (!ecosystem) return [];
    try {
      const resp = await fetch("https://api.osv.dev/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package: { name: pkg, ecosystem },
          version: ver,
        }),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data.vulns) ? data.vulns : [];
    } catch (err) {
      console.error("osv query failed", err);
      return [];
    }
  };

  const fetchDeps = async (
    evt,
    forcedVer = null,
    nsOverride = null,
    nameOverride = null,
    mgrOverride = null,
    clearInputs = false,
  ) => {
    if (evt && evt.preventDefault) evt.preventDefault();
    let nsVal = nsOverride !== null ? nsOverride : namespace;
    let nameVal = nameOverride !== null ? nameOverride : name;
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    if (evt) {
      setHistory((h) => [...h, { manager, namespace, name, version }]);
    }
    if (!nameVal) return;
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

      const urlDirect = `${path}?recursive=false${includeVuln ? "&vuln=true" : "&vuln=false"}${includeScorecard ? "&scorecard=true" : "&scorecard=false"}`;
      const urlAll = `${path}?recursive=${includeTransitive ? "true" : "false"}${includeVuln ? "&vuln=true" : "&vuln=false"}${includeScorecard ? "&scorecard=true" : "&scorecard=false"}`;

      const pmUrl = pmURLs[mgrVal] || "";
      const msgs = [`Fetching dependencies from ${pmUrl}`];
      if (includeVuln) msgs.push("Fetching vulnerabilities from https://osv.dev");
      if (includeScorecard) msgs.push(
        "Fetching reputation from https://api.securityscorecards.dev"
      );
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
      if (includeVuln && !vulns[rootKey]) {
        const extra = await fetchOsvVulns(mgrVal, rootKey, ver);
        if (extra.length > 0) {
          vulns[rootKey] = extra;
          vulnStatus[rootKey] = {
            status: "vulnerable",
            checked: true,
            advisory_count: extra.length,
          };
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

  const cancelFetch = () => {
    if (abortRef.current.controller) abortRef.current.controller.abort();
    if (abortRef.current.timer) clearTimeout(abortRef.current.timer);
    abortRef.current = { controller: null, timer: null };
    setLoading(false);
    setStatusMessages([]);
    setStatus("");
  };

  const hasClearableFormState =
    Boolean(namespace || name || version || search || cacheStatus) ||
    formSubmitted ||
    loading ||
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
    setRepos({});
    setFormSubmitted(false);
    setLoading(false);
    setStatusMessages([]);
    setStatus("");
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
      .text((d) => `${d.id} - ${osvStatusLabel(d.osvStatus)}`);

    const label = zoomLayer
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) => d.id)
      .attr("font-size", compactGraph ? 8 : largeGraph ? 9 : 10)
      .attr("fill", "#c9d1d9")
      .attr("text-anchor", compactGraph ? "middle" : "start")
      .style("display", (d) => (d.labelBaseVisible ? null : "none"))
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
        .attr("y", (d) => (compactGraph ? d.y - 12 : d.y));
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

    const renderNode = (dep, seen = new Set(), depth = 0) => {
      const key = `${dep.name}@${dep.version}`;
      if (seen.has(key)) return null;
      const childSeen = new Set(seen);
      childSeen.add(key);
      const childParentKey = dep.root ? "" : dep.name;
      const children = uniqueChildren(childParentKey);
      const defaultCollapsed =
        !dep.root && largeDependencySet && children.length > 0 && !dep.risk;
      const isCollapsed = collapsed[key] ?? defaultCollapsed;
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
            "span",
            { className: "dep-name", onClick: () => pivotSearch(dep) },
            `${dep.name}@${dep.version}`,
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
      const visibleKids =
        dependencyListFilter === "all" ? kids : kids.filter(matchesDependencyFilter);
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
    const filteredTransDeps =
      dependencyListFilter === "all"
        ? transDeps
        : transDeps.filter(matchesDependencyFilter);
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
      osvStatus: rootOsvStatus,
      root: true,
    };
    const rootMatchesFilter = matchesDependencyFilter(rootTreeNode);
    const showRootTree =
      dependencyListFilter === "all" ||
      rootMatchesFilter ||
      filteredDirectDeps.length > 0;
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
            "Transitive Dependencies",
          ),
          renderSummary(transDeps.length, transitiveRiskCount, transDeps),
          e(
            "ul",
            { className: "transitive-list" },
            formSubmitted &&
              (filteredTransDeps.length > 0
                ? filteredTransDeps.map((d) => renderNode(d, new Set()))
                : emptyDependencyMessage(
                    dependencyListFilter === "vulnerable"
                      ? "No vulnerable transitive dependencies"
                      : dependencyListFilter === "unknown"
                        ? "No unresolved OSV transitive dependencies"
                      : "No transitive dependencies",
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
  const packageSuggestionCandidates =
    !version && (packageTypeaheadOpen || !showVersionSuggestions)
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

  return e(
    "div",
    null,
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

        { onSubmit: fetchDeps, autoComplete: "off", name: uniqueFormName },

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
            { className: "icons-options-row" },
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
                    onChange: (e) => {
                      setManager(e.target.value);
                      setNameSuggestions([]);
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
                  "Fetch",
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
            e(
              "div",
              { className: "options-row" },
              e(
                "label",
                null,
                e("input", {
                  type: "checkbox",
                  checked: includeTransitive,
                  onChange: (ev) => {
                    setIncludeTransitive(ev.target.checked);
                    localStorage.setItem(
                      "includeTransitive",
                      ev.target.checked,
                    );
                  },
                }),
                " Transitive Dependencies",
              ),
              e(
                "label",
                null,
                e("input", {
                  type: "checkbox",
                  checked: includeVuln,
                  onChange: (ev) => {
                    setIncludeVuln(ev.target.checked);
                    localStorage.setItem("includeVuln", ev.target.checked);
                  },
                }),
                " OSV",
              ),
              e(
                "label",
                null,
                e("input", {
                  type: "checkbox",
                  checked: includeScorecard,
                  onChange: (ev) => {
                    setIncludeScorecard(ev.target.checked);
                    localStorage.setItem("includeScorecard", ev.target.checked);
                  },
                }),
                " OpenSSF Scorecard",
              ),
            ),
          ),
        ),
          e(
            "div",
            { className: "search-row" },
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
                  visibleVersionSuggestions.map((v) =>
                    e(
                      "button",
                      {
                        key: v,
                        type: "button",
                        onClick: (evt) => {
                          setVersion(v);
                          fetchDeps(evt, v);
                        },
                      },
                      v,
                    ),
                  ),
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
                      `${submittedName}@${submittedVersion}`,
                    ),
                  ),
                  e(
                    "div",
                    { className: "dependency-header-right" },
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
                        { name: submittedName, version: submittedVersion },
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
