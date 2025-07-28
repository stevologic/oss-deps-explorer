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
  const [loadMoreClicks, setLoadMoreClicks] = React.useState(0);
  const MAX_SUGGESTED_VERSIONS = 25;
  const [deps, setDeps] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [nameSuggestions, setNameSuggestions] = React.useState([]);

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
      b: 0,
      opacity: 1,
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
  const uniqueFormName = React.useMemo(() => `form-${Date.now()}`, []);
  const abortRef = React.useRef({ controller: null, timer: null });
  const [pmURLs, setPmURLs] = React.useState({});
  const [cacheStatus, setCacheStatus] = React.useState("");
  const [scorecards, setScorecards] = React.useState({});
  const [rootScore, setRootScore] = React.useState(null);
  const [rootCves, setRootCves] = React.useState([]);
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
    return v === null ? false : v === "true";
  });
  const showVersionSuggestions = !version && latestVersions.length > 0;

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

  const toggleNode = (key) => {
    setCollapsed((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const parseCvssVector = (vector) => {
    const parts = vector.split("/");
    const m = {};
    parts.forEach((p) => {
      const idx = p.indexOf(":");
      if (idx > 0) m[p.slice(0, idx)] = p.slice(idx + 1);
    });
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

  const severityScore = (sev) => {
    if (!sev || sev.score === undefined) return NaN;
    if (typeof sev.score === "number") return sev.score;
    const num = parseFloat(sev.score);
    if (!isNaN(num)) return num;
    if (typeof sev.score === "string" && sev.score.startsWith("CVSS:")) {
      return parseCvssVector(sev.score);
    }
    return NaN;
  };

  const riskColors = {
    low: "var(--success-color)",
    medium: "var(--warning-color)",
    high: "var(--error-color)",
    critical: "var(--error-color)",
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
      return "#ffffff";
    }
    if (includeVuln && d.risk && riskColors[d.risk]) {
      return riskColors[d.risk];
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
    );
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
    setLoadMoreClicks(0);
  }, [latestVersions]);

  React.useEffect(() => {
    if (!name) {
      setNameSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchInternal(`${apiOrigin}/suggest/${manager}/${encodeURIComponent(name)}`)
        .then((resp) => (resp.ok ? resp.json() : []))
        .then((data) => {
          if (!cancelled) {
            const names = data.map((d) => d.name || d);
            setNameSuggestions(names);
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
    fetchInternal(`${apiOrigin}/config`)
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
      fetchInternal(`${apiOrigin}/repo/${repo}`)
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
    const direct = {};
    deps.forEach((d) => {
      if (!d.transitive) direct[d.name] = d.version;
    });
    const rootRisk = rootScore !== null ? riskFromScore(rootScore) : null;
    buildGraph(deps, submittedName, submittedVersion, direct, rootRisk);
  }, [showResults, deps, submittedName, submittedVersion, rootScore, includeVuln]);

  const getLatestVersion = async (
    nsOverride = null,
    nameOverride = null,
    mgrOverride = null,
  ) => {
    const nsVal = nsOverride !== null ? nsOverride : namespace;
    const nameVal = nameOverride !== null ? nameOverride : name;
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    try {
      switch (mgrVal) {
        case "npm": {
          const pkg = nsVal ? `${nsVal}/${nameVal}` : nameVal;
          const resp = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
          if (!resp.ok) return "";
          const data = await resp.json();
          return data.version || "";
        }
        case "pypi": {
          const resp = await fetch(`https://pypi.org/pypi/${nameVal}/json`);
          if (!resp.ok) return "";
          const data = await resp.json();
          return (data.info && data.info.version) || "";
        }
        case "go": {
          const mod = nsVal ? `${nsVal}/${nameVal}` : nameVal;
          const resp = await fetch(`https://proxy.golang.org/${mod}/@latest`);
          if (!resp.ok) return "";
          const data = await resp.json();
          return data.Version || "";
        }
        case "maven": {
          if (!nsVal) return "";
          const groupPath = nsVal.replace(/\./g, "/");
          const resp = await fetch(
            `https://repo1.maven.org/maven2/${groupPath}/${nameVal}/maven-metadata.xml`,
          );
          if (!resp.ok) return "";
          const text = await resp.text();
          const m =
            text.match(/<latest>([^<]+)<\/latest>/) ||
            text.match(/<release>([^<]+)<\/release>/);
          return m ? m[1] : "";
        }
        case "cargo": {
          const resp = await fetch(
            `https://crates.io/api/v1/crates/${nameVal}`,
          );
          if (!resp.ok) return "";
          const data = await resp.json();
          return (
            (data.crate &&
              (data.crate.newest_version || data.crate.max_version)) ||
            ""
          );
        }
        case "rubygems": {
          const resp = await fetch(
            `https://rubygems.org/api/v1/versions/${nameVal}/latest.json`,
          );
          if (!resp.ok) return "";
          const data = await resp.json();
          return data.version || "";
        }
        case "nuget": {
          const pkg = nameVal.toLowerCase();
          const resp = await fetch(
            `https://api.nuget.org/v3-flatcontainer/${pkg}/index.json`,
          );
          if (!resp.ok) return "";
          const data = await resp.json();
          const versions = Array.isArray(data.versions) ? data.versions : [];
          return versions.length ? versions[versions.length - 1] : "";
        }
        case "composer": {
          if (!nsVal) return "";
          const pkg = `${nsVal}/${nameVal}`;
          const resp = await fetch(`https://repo.packagist.org/p2/${pkg}.json`);
          if (!resp.ok) return "";
          const data = await resp.json();
          const list =
            data.packages && Array.isArray(data.packages[pkg])
              ? data.packages[pkg]
              : [];
          return list.length ? list[0].version || "" : "";
        }
        default:
          return "";
      }
    } catch (err) {
      console.error("version lookup failed", err);
      return "";
    }
  };

  const getLatestVersions = async (
    mgrOverride = null,
    nsOverride = null,
    nameOverride = null,
  ) => {
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    const nsVal = nsOverride !== null ? nsOverride : namespace;
    const nameVal = nameOverride !== null ? nameOverride : name;
    try {
      switch (mgrVal) {
        case "npm": {
          const pkg = nsVal ? `${nsVal}/${nameVal}` : nameVal;
          const resp = await fetch(`https://registry.npmjs.org/${pkg}`);
          if (!resp.ok) return [];
          const data = await resp.json();
          const versions = Object.keys(data.versions || {}).sort((a, b) =>
            b.localeCompare(a, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
          return versions.slice(0, 10);
        }
        case "pypi": {
          const resp = await fetch(`https://pypi.org/pypi/${nameVal}/json`);
          if (!resp.ok) return [];
          const data = await resp.json();
          const versions = Object.keys(data.releases || {}).sort((a, b) =>
            b.localeCompare(a, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
          return versions.slice(0, 10);
        }
        case "go": {
          const mod = nsVal ? `${nsVal}/${nameVal}` : nameVal;
          const resp = await fetch(`https://proxy.golang.org/${mod}/@v/list`);
          if (!resp.ok) return [];
          const text = await resp.text();
          const versions = text
            .trim()
            .split("\n")
            .filter(Boolean)
            .sort((a, b) =>
              b.localeCompare(a, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );
          return versions.slice(0, 10);
        }
        case "maven": {
          if (!nsVal) return [];
          const groupPath = nsVal.replace(/\./g, "/");
          const resp = await fetch(
            `https://repo1.maven.org/maven2/${groupPath}/${nameVal}/maven-metadata.xml`,
          );
          if (!resp.ok) return [];
          const text = await resp.text();
          const versions = Array.from(
            text.matchAll(/<version>([^<]+)<\/version>/g),
          ).map((m) => m[1]);
          versions.sort((a, b) =>
            b.localeCompare(a, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
          return versions.slice(0, 10);
        }
        case "cargo": {
          const resp = await fetch(
            `https://crates.io/api/v1/crates/${nameVal}`,
          );
          if (!resp.ok) return [];
          const data = await resp.json();
          const versions = Array.isArray(data.versions)
            ? data.versions
                .map((v) => v.num)
                .sort((a, b) =>
                  b.localeCompare(a, undefined, {
                    numeric: true,
                    sensitivity: "base",
                  }),
                )
            : [];
          return versions.slice(0, 10);
        }
        default:
          return [];
      }
    } catch (err) {
      console.error("version list failed", err);
      return [];
    }
  };

  const fetchOsvVulns = async (mgr, pkg, ver) => {
    const ecoMap = {
      npm: "npm",
      pypi: "PyPI",
      go: "Go",
      maven: "Maven",
      cargo: "crates.io",
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
    const nsVal = nsOverride !== null ? nsOverride : namespace;
    const nameVal = nameOverride !== null ? nameOverride : name;
    const mgrVal = mgrOverride !== null ? mgrOverride : manager;
    if (evt) {
      setHistory((h) => [...h, { manager, namespace, name, version }]);
    }
    if (!nameVal) return;
    setFormSubmitted(true);
    setLoading(true);
    setStatus("Determining version...");
    setConsoleLines([]);
    setShowConsole(false);

    setCacheStatus("");


    let ver = forcedVer !== null ? forcedVer : version;
    if (!ver) {
      ver = await getLatestVersion(nsVal, nameVal, mgrVal);
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
        ver = await getLatestVersion(nsVal, nameVal, mgrVal);
        if (!ver) {
          return;
        }
        setVersion(ver);
      }

      const rootName = nameVal;
      const rootVersion = ver;
      setSubmittedName(rootName);
      setSubmittedVersion(rootVersion);
      setSubmittedNamespace(nsVal);
      setSubmittedManager(mgrVal);

      const base = `${apiOrigin}/dependencies/${mgrVal}`;
      const path = nsVal
        ? `${base}/${nsVal}/${nameVal}/${ver}`
        : `${base}/${nameVal}/${ver}`;

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

      setStatusMessages([]);
      setStatus("Processing results...");

      const direct = directRes.dependencies || {};
      const all = allRes.dependencies || {};

      const parents = allRes.parents || {};
      let vulns = allRes.vulnerabilities || {};
      const rootKey = formatPackage(mgrVal, nsVal, nameVal);
      if (includeVuln && !vulns[rootKey]) {
        const extra = await fetchOsvVulns(mgrVal, rootKey, ver);
        if (extra.length > 0) {
          vulns[rootKey] = extra;
        }
      }

      const depList = [];
      for (const [pkg, ver] of Object.entries(all)) {
        const plist = Array.isArray(parents[pkg])
          ? parents[pkg]
          : [parents[pkg] || ""];
        const vulnList = Array.isArray(vulns[pkg]) ? vulns[pkg] : [];
        const cveMap = new Map();
        let maxScore = 0;
        vulnList.forEach((v) => {
          let vulnScore = 0;
          if (Array.isArray(v.severity)) {
            v.severity.forEach((s) => {
              const sc = severityScore(s);
              if (!isNaN(sc) && sc > vulnScore) vulnScore = sc;
            });
          }
          if (vulnScore > maxScore) maxScore = vulnScore;
          if (v.id && v.id.startsWith("CVE-")) {
            cveMap.set(v.id, Math.max(cveMap.get(v.id) || 0, vulnScore));
          }
          if (Array.isArray(v.aliases)) {
            v.aliases.forEach((a) => {
              if (typeof a === "string" && a.startsWith("CVE-")) {
                cveMap.set(a, Math.max(cveMap.get(a) || 0, vulnScore));
              }
            });
          }
        });
        let risk = null;
        if (maxScore >= 9) risk = "critical";
        else if (maxScore >= 7) risk = "high";
        else if (maxScore >= 4) risk = "medium";
        else if (maxScore > 0) risk = "low";
        const cves = Array.from(cveMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, score]) => ({ id, score }));
        plist.forEach((p) => {
          depList.push({
            name: pkg,
            version: ver,
            transitive: !direct[pkg],
            parent: p,
            cves,
            risk,
          });
        });
      }
      const rootKeyLookup = formatPackage(mgrVal, nsVal, nameVal);
      const rootVulnList = Array.isArray(vulns[rootKeyLookup])
        ? vulns[rootKeyLookup]
        : [];
      const rootCveMap = new Map();
      let rootMax = 0;
      rootVulnList.forEach((v) => {
        let vs = 0;
        if (Array.isArray(v.severity)) {
          v.severity.forEach((s) => {
            const sc = severityScore(s);
            if (!isNaN(sc) && sc > vs) vs = sc;
          });
        }
        if (vs > rootMax) rootMax = vs;
        if (v.id && v.id.startsWith("CVE-")) {
          rootCveMap.set(v.id, Math.max(rootCveMap.get(v.id) || 0, vs));
        }
        if (Array.isArray(v.aliases)) {
          v.aliases.forEach((a) => {
            if (typeof a === "string" && a.startsWith("CVE-")) {
              rootCveMap.set(a, Math.max(rootCveMap.get(a) || 0, vs));
            }
          });
        }
      });
      const rootCves = Array.from(rootCveMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, score]) => ({ id, score }));
      let rootRisk = null;
      if (rootMax >= 9) rootRisk = "critical";
      else if (rootMax >= 7) rootRisk = "high";
      else if (rootMax >= 4) rootRisk = "medium";
      else if (rootMax > 0) rootRisk = "low";
      setRootScore(rootMax || null);
      setRootCves(rootCves);
      setDeps(depList);
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

  const buildGraph = (list, rootName, rootVersion, direct, rootRisk) => {
    const nodes = [
      { id: `${rootName}@${rootVersion}`, root: true, risk: rootRisk },
    ];
    const links = [];
    const added = new Set([`${rootName}@${rootVersion}`]);
    const versionMap = {};
    list.forEach((d) => {
      versionMap[d.name] = d.version;
    });
    list.forEach((d) => {
      const id = `${d.name}@${d.version}`;
      const isTransitive = !direct[d.name];
      if (!added.has(id)) {
        nodes.push({ id, transitive: isTransitive, risk: d.risk });
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
          .distance(60),
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("collide", d3.forceCollide(20))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("float", floatForce);

    const link = zoomLayer
      .append("g")
      .attr("stroke", "#999")
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
      .attr("r", 8)
      .attr("fill", (d) => fillFor(d))
      .attr("stroke", (d) => (d.root ? "#00e5ff" : "#fff"))
      .on("click", (_, d) => {
        const at = d.id.lastIndexOf("@");
        if (at <= 0) return;
        const pkg = d.id.slice(0, at);
        const ver = d.id.slice(at + 1);
        let url = "";
        switch (manager) {
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

    const label = zoomLayer
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) => d.id)
      .attr("font-size", 10)
      .attr("fill", "#c9d1d9")
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
      label.attr("x", (d) => d.x + 10).attr("y", (d) => d.y);
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
    const childMap = new Map();
    deps.forEach((d) => {
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
      return uniq;
    };

    const renderNode = (dep, seen = new Set()) => {
      const key = `${dep.name}@${dep.version}`;
      if (seen.has(key)) return null;
      const childSeen = new Set(seen);
      childSeen.add(key);
      const children = uniqueChildren(dep.name);
      const isCollapsed = collapsed[key];
      return e(
        "li",
        { key },
        e(
          React.Fragment,
          null,
          children.length > 0 &&
            e(
              "span",
              { className: "tree-toggle", onClick: () => toggleNode(key) },
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
              className: `risk-dot ${
                includeVuln && dep.risk ? `risk-${dep.risk}` : "risk-none"
              }`,
            }),
          ),
          e(
            "span",
            { className: "dep-name", onClick: () => pivotSearch(dep) },
            `${dep.name}@${dep.version}`,
          ),
          e(
            "span",
            { className: "cve-inline" },
            dep.cves.map((c, idx) =>
              e(
                React.Fragment,
                { key: idx },
                e(
                  "a",
                  {
                    href: `https://osv.dev/vulnerability/${c.id}`,
                    target: "_blank",
                    onClick: (ev) => ev.stopPropagation(),
                    title: (() => {
                      const sev = riskFromScore(c.score);
                      return `CVSS ${c.score}${sev ? ` (${sev})` : ""}`;
                    })(),
                  },
                  c.id,
                ),
              ),
            ),
          ),
          !isCollapsed && buildList(dep.name, childSeen),
        ),
      );
    };

    const buildList = (p, seen) => {
      const kids = uniqueChildren(p);
      if (kids.length === 0) return null;
      return e("ul", null, kids.map((c) => renderNode(c, seen)));
    };

    const transDepsRaw = deps.filter((d) => d.transitive);
    const transMap = new Map();
    transDepsRaw.forEach((d) => {
      const key = `${d.name}@${d.version}`;
      if (!transMap.has(key)) {
        transMap.set(key, { ...d, parents: new Set([d.parent]) });
      } else {
        transMap.get(key).parents.add(d.parent);
      }
    });
    const transDeps = Array.from(transMap.values()).map((d) => ({
      ...d,
      parents: Array.from(d.parents),
    }));
    const versionMap = {};
    const direct = {};
    deps.forEach((d) => {
      versionMap[d.name] = d.version;
      if (!d.transitive) {
        direct[d.name] = d.version;
      }
    });
    const rootName = submittedName;
    const rootVersion = submittedVersion;
    const rootRisk = rootScore !== null ? riskFromScore(rootScore) : null;
    return e(
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
        e(
          "ul",
          { className: "direct-list site-tree" },
          formSubmitted &&
            e(
              "li",
              { key: "root" },
              e(
              React.Fragment,
              null,
              e(
                "a",
                {
                  href: packageUrl(
                    { name: rootName, version: rootVersion },
                    submittedManager,
                  ),
                  target: "_blank",
                  onClick: (e) => e.stopPropagation(),
                  className: "risk-link",
                },
                e("span", {
                  className: `risk-dot ${
                    includeVuln && rootRisk
                      ? `risk-${rootRisk}`
                      : "risk-none"
                  }`,
                }),
              ),
              e(
                "span",
                { className: "dep-name" },
                `${rootName}@${rootVersion}`
              ),
              e(
                "span",
                { className: "cve-inline" },
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
                          return `CVSS ${c.score}${sev ? ` (${sev})` : ""}`;
                        })(),
                      },
                      c.id,
                    ),
                  ),
                ),
              ),
              buildList("", new Set()),
            ),
          ),
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
        e(
          "ul",
          { className: "transitive-list" },
          formSubmitted &&
            e(
              "li",
              { key: "root-trans" },
              e(
                React.Fragment,
                null,
                e(
                  "a",
                  {
                    href: packageUrl(
                      { name: rootName, version: rootVersion },
                      submittedManager,
                    ),
                    target: "_blank",
                    onClick: (e) => e.stopPropagation(),
                    className: "risk-link",
                  },
                  e("span", {
                    className: `risk-dot ${
                      includeVuln && rootRisk ? `risk-${rootRisk}` : "risk-none"
                    }`,
                  }),
                ),
                e(
                  "span",
                  { className: "dep-name" },
                  `${rootName}@${rootVersion}`,
                ),
                e(
                  "span",
                  { className: "cve-inline" },
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
                            return `CVSS ${c.score}${sev ? ` (${sev})` : ""}`;
                          })(),
                        },
                        c.id,
                      ),
                    ),
                  ),
                ),
                buildList("", new Set()),
              ),
            ),
        ),
      ),
    );
  })();

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
                    onChange: (e) => setManager(e.target.value),
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
                  list: "name-suggestions",
                  onChange: (e) => setName(e.target.value),
                }),
                name &&
                  e(
                    "button",
                    {
                      type: "button",
                      className: "clear-btn",
                      onClick: () => setName(""),
                    },
                    "\u00d7",
                  ),
                e("div", { className: "input-tooltip" }, "name of the package"),
                e(
                  "datalist",
                  { id: "name-suggestions" },
                  nameSuggestions.map((n) => e("option", { key: n, value: n })),
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
                "button",
                { type: "submit", className: "fetch-button" },
                "Fetch",
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
                  latestVersions.slice(0, versionsToShow).map((v) =>
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
                  loadMoreClicks < 5 &&
                  versionsToShow < Math.min(latestVersions.length, MAX_SUGGESTED_VERSIONS)
                    ? e(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            setVersionsToShow((prev) =>
                              Math.min(prev + 5, latestVersions.length, MAX_SUGGESTED_VERSIONS),
                            );
                            setLoadMoreClicks((prev) => prev + 1);
                          },
                          className: "load-more-btn",
                        },
                        "more...",
                      )
                    : null,
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
                            "Highest vulnerability score from OSV.dev (CVSS)",
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
                                  return `CVSS ${c.score}${sev ? ` (${sev})` : ""}`;
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
                namespace &&
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
