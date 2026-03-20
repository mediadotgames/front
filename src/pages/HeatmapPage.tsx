import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHeatmap, fetchHeatmapSummary, fetchOutlets } from "../api/client";
import type { HeatmapRow, HeatmapSummary, Outlet, PaginatedResponse } from "../api/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BIAS_GROUPS = ["Left", "Lean Left", "Center", "Lean Right", "Right"] as const;
type BiasGroup = (typeof BIAS_GROUPS)[number];

const BIAS_GROUP_COLORS: Record<BiasGroup, string> = {
  Left: "var(--gap-left)",
  "Lean Left": "#8BADC4",
  Center: "var(--text-tertiary)",
  "Lean Right": "#CB9D8F",
  Right: "var(--gap-right)",
};

const BIAS_GROUP_BAR_CLASS: Record<BiasGroup, string> = {
  Left: "left",
  "Lean Left": "leanleft",
  Center: "center",
  "Lean Right": "leanright",
  Right: "right",
};

/** Map outlet domain -> short display name for column headers */
const DISPLAY_NAMES: Record<string, string> = {
  "ms.now": "MSNBC",
  "theguardian.com": "Guardian",
  "us.cnn.com": "CNN",
  "aljazeera.com": "Al Jazeera",
  "nytimes.com": "NYT",
  "washingtonpost.com": "WaPo",
  "latimes.com": "LA Times",
  "nbcnews.com": "NBC",
  "cbsnews.com": "CBS",
  "politico.com": "Politico",
  "abcnews.com": "ABC",
  "axios.com": "Axios",
  "bloomberg.com": "Bloomberg",
  "yahoo.com": "Yahoo",
  "cbc.ca": "CBC",
  "abc.net.au": "ABC AU",
  "newsweek.com": "Newsweek",
  "bbc.com": "BBC",
  "apnews.com": "AP",
  "asia.nikkei.com": "Nikkei",
  "reuters.com": "Reuters",
  "usatoday.com": "USA Today",
  "thehill.com": "The Hill",
  "channelnewsasia.com": "CNA",
  "scmp.com": "SCMP",
  "theglobeandmail.com": "Globe&Mail",
  "wsj.com": "WSJ",
  "timesofindia.indiatimes.com": "TOI",
  "jpost.com": "J.Post",
  "telegraph.co.uk": "Telegraph",
  "nypost.com": "NY Post",
  "foxnews.com": "Fox",
  "washingtonexaminer.com": "Wash.Exam",
  "nationalreview.com": "Nat.Review",
  "rt.com": "RT",
  "dailywire.com": "Daily Wire",
};

const CATEGORIES = [
  "Politics",
  "Business",
  "World",
  "Technology",
  "Health",
  "Science",
  "Environment",
  "Entertainment",
  "Sports",
  "General",
];

const GEO_OPTIONS = ["US", "Global", "Foreign", "State & Local"];

const TIME_RANGES = ["Last 24h", "Last 48h", "Last 7 days", "Last 30 days"];

const MIN_CLUSTER_OPTIONS = [2, 3, 4, 5, 10];

type SortField = "clusterSize" | "polSkew" | "geoSkew";
type SortDir = "asc" | "desc";

interface QuickFilters {
  forPolitics: boolean;
  publicInterestOnly: boolean;
  usFocusOnly: boolean;
  exclSports: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function biasGroupForScore(score: number): BiasGroup {
  if (score <= -14) return "Left";
  if (score <= -4) return "Lean Left";
  if (score <= 4) return "Center";
  if (score <= 14) return "Lean Right";
  return "Right";
}

/** PI-rate-based heat cell styling: intensity = article count, hue = PI percentage */
function getHeatStyle(count: number, piCount: number, isDark: boolean): { bg: string; fg: string } {
  if (count === 0) return { bg: "transparent", fg: "transparent" };
  const piRate = piCount / count;
  const alpha = Math.min(0.10 + (count - 1) * 0.07, 0.70);
  let r: number, g: number, b: number;
  if (piRate <= 0.5) {
    const t = piRate / 0.5;
    r = Math.round(180 + t * 10);
    g = Math.round(60 + t * 100);
    b = 50;
  } else {
    const t = (piRate - 0.5) / 0.5;
    r = Math.round(190 - t * 140);
    g = Math.round(160 - t * 10);
    b = Math.round(50 + t * 20);
  }
  const bg = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
  const fg = isDark
    ? "#e0e0e0"
    : alpha > 0.45 ? "#fff" : alpha > 0.25 ? "#2D2B28" : "#6B6560";
  return { bg, fg };
}

function formatSkew(val: number): string {
  if (val === 0) return "0";
  const sign = val > 0 ? "+" : "";
  return `${sign}${Math.round(val)}`;
}

function shortName(domain: string): string {
  return DISPLAY_NAMES[domain] || domain.replace(/\.(com|org|net|co\.uk|net\.au)$/, "");
}

// ---------------------------------------------------------------------------
// SVG Icons (inline to avoid external deps)
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="12" y1="18" x2="20" y2="18" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function HeatmapPage() {
  const navigate = useNavigate();

  // --- Data state ---
  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState("");

  // --- Quick filters ---
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({
    forPolitics: false,
    publicInterestOnly: false,
    usFocusOnly: false,
    exclSports: false,
  });

  // --- Outlets picker ---
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set());
  const [outletsDrawerOpen, setOutletsDrawerOpen] = useState(false);

  // --- Advanced filters ---
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<string>("Last 7 days"); // TODO: wire to API when supported
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(CATEGORIES),
  );
  const [selectedGeo, setSelectedGeo] = useState<Set<string>>(new Set(GEO_OPTIONS)); // TODO: wire to API when supported
  const [publicInterestOnly, setPublicInterestOnly] = useState(false); // TODO: wire to API when supported
  const [minClusterSize, setMinClusterSize] = useState(2);

  // --- Table view ---
  const [tableView, setTableView] = useState<"outlets-bias" | "outlets-region" | "bias" | "region">("outlets-bias");

  // --- Sort ---
  const [sortField, setSortField] = useState<SortField>("clusterSize");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // --- Theme detection for heat cell text color ---
  const isDark = typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  // --- Derived: group outlets by bias ---
  const outletsByBias = useMemo(() => {
    const groups: Record<BiasGroup, Outlet[]> = {
      Left: [],
      "Lean Left": [],
      Center: [],
      "Lean Right": [],
      Right: [],
    };
    for (const o of outlets) {
      const score = Number(o.adfontesBiasScore);
      const group = biasGroupForScore(score);
      groups[group].push(o);
    }
    // Sort each group by score
    for (const g of BIAS_GROUPS) {
      groups[g].sort(
        (a, b) => Number(a.adfontesBiasScore) - Number(b.adfontesBiasScore),
      );
    }
    return groups;
  }, [outlets]);

  // --- Derived: ordered list of selected outlet domains for table columns ---
  const visibleOutlets = useMemo(() => {
    const result: { domain: string; group: BiasGroup }[] = [];
    for (const g of BIAS_GROUPS) {
      for (const o of outletsByBias[g]) {
        if (selectedOutlets.has(o.outletDomain)) {
          result.push({ domain: o.outletDomain, group: g });
        }
      }
    }
    return result;
  }, [outletsByBias, selectedOutlets]);

  // --- Derived: group spans for table header ---
  const groupSpans = useMemo(() => {
    const spans: { group: BiasGroup; count: number }[] = [];
    let current: BiasGroup | null = null;
    let count = 0;
    for (const o of visibleOutlets) {
      if (o.group !== current) {
        if (current !== null && count > 0) {
          spans.push({ group: current, count });
        }
        current = o.group;
        count = 1;
      } else {
        count++;
      }
    }
    if (current !== null && count > 0) {
      spans.push({ group: current, count });
    }
    return spans;
  }, [visibleOutlets]);

  // --- Compute the active API category ---
  const activeApiCategory = useMemo((): string | undefined => {
    if (quickFilters.forPolitics) return "politics";
    // If exactly one category is selected in advanced filters, use it
    if (selectedCategories.size === 1) {
      return [...selectedCategories][0].toLowerCase();
    }
    return undefined;
  }, [quickFilters.forPolitics, selectedCategories]);

  // --- Load data ---
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts: Parameters<typeof fetchHeatmap>[0] = {};
      if (activeApiCategory) opts.category = activeApiCategory;
      if (minClusterSize > 1) opts.limit = 500; // fetch more to compensate for client filtering
      // TODO: send minStories param when API supports it as a query param
      // For now we filter client-side

      const [heatmap, sum, outletsResp] = await Promise.all([
        fetchHeatmap(opts),
        fetchHeatmapSummary(),
        fetchOutlets(),
      ]);
      setRows(heatmap.data);
      setSummary(sum);
      const outletList = outletsResp.data;
      setOutlets(outletList);
      // Initialize selected outlets to all on first load
      setSelectedOutlets((prev) => {
        if (prev.size === 0) {
          return new Set(outletList.map((o) => o.outletDomain));
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, [activeApiCategory, minClusterSize]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Client-side filtering & sorting ---
  const filteredRows = useMemo(() => {
    let result = rows;

    // Search filter (client-side)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => r.topicLabel.toLowerCase().includes(q));
    }

    // Min cluster size filter
    if (minClusterSize > 1) {
      result = result.filter((r) => Number(r.clusterSize) >= minClusterSize);
    }

    // Quick filter: exclude sports
    if (quickFilters.exclSports) {
      result = result.filter(
        (r) => r.topCategory?.toLowerCase() !== "sports",
      );
    }

    // TODO: Quick filter "Public interest only" — needs API field
    // TODO: Quick filter "US focus only" — needs geo relevance data

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = Number(a[sortField]) || 0;
      const bVal = Number(b[sortField]) || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [rows, searchQuery, minClusterSize, quickFilters, sortField, sortDir]);

  // --- Handlers ---

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleQuickFilter = (key: keyof QuickFilters) => {
    setQuickFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleOutlet = (domain: string) => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const toggleBiasGroup = (group: BiasGroup) => {
    const groupDomains = outletsByBias[group].map((o) => o.outletDomain);
    const allSelected = groupDomains.every((d) => selectedOutlets.has(d));
    setSelectedOutlets((prev) => {
      const next = new Set(prev);
      for (const d of groupDomains) {
        if (allSelected) {
          next.delete(d);
        } else {
          next.add(d);
        }
      }
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleGeo = (geo: string) => {
    setSelectedGeo((prev) => {
      const next = new Set(prev);
      if (next.has(geo)) {
        next.delete(geo);
      } else {
        next.add(geo);
      }
      return next;
    });
  };

  const closeDrawers = () => {
    setOutletsDrawerOpen(false);
    setFiltersDrawerOpen(false);
  };

  // --- Loading state ---
  if (loading && rows.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14 }}>
        Loading heatmap...
      </div>
    );
  }

  // --- Error state ---
  if (error && rows.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--gap-right)", fontSize: 14 }}>
        {error}
      </div>
    );
  }

  const totalCount = summary?.totalTopics ?? rows.length;
  const filteredCount = filteredRows.length;
  const anyDrawerOpen = outletsDrawerOpen || filtersDrawerOpen;

  return (
    <div style={{ maxWidth: "100vw" }}>
      {/* ═══ Drawer overlay ═══ */}
      {anyDrawerOpen && (
        <div
          onClick={closeDrawers}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(45,43,40,0.15)",
            zIndex: 50,
          }}
        />
      )}

      {/* ═══ Row 1: Search bar + Outlets & Advanced Filters buttons ═══ */}
      <div style={{ position: "relative", maxWidth: "100vw", overflow: "visible" }}>
        <div
          style={{
            background: "var(--surface-white)",
            padding: "10px 32px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "background 0.3s",
          }}
        >
          {/* Search bar */}
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <span
              style={{
                position: "absolute",
                left: 13,
                color: "var(--text-tertiary)",
                zIndex: 1,
                display: "flex",
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for topics, events & outlets"
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "10px 80px 10px 40px",
                borderRadius: 10,
                fontSize: 15,
                transition: "all 0.15s",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand)";
                e.currentTarget.style.background = "var(--surface-white)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--focus-ring)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 14,
                fontSize: 13,
                color: "var(--text-tertiary)",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              }}
            >
              {filteredCount} / {totalCount}
            </span>
          </div>

          {/* Outlets button */}
          <button
            onClick={() => {
              setFiltersDrawerOpen(false);
              setOutletsDrawerOpen((v) => !v);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: outletsDrawerOpen ? "var(--accent-bg)" : "var(--surface)",
              border: `1px solid ${outletsDrawerOpen ? "var(--accent)" : "var(--border)"}`,
              color: outletsDrawerOpen ? "var(--accent)" : "var(--text-secondary)",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
              userSelect: "none",
              whiteSpace: "nowrap",
              fontWeight: outletsDrawerOpen ? 500 : 400,
            }}
          >
            <GridIcon />
            Outlets
            <span
              style={{
                background: "var(--brand-bg)",
                color: "var(--brand)",
                padding: "1px 7px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {selectedOutlets.size}
            </span>
          </button>

          {/* Advanced Filters button */}
          <button
            onClick={() => {
              setOutletsDrawerOpen(false);
              setFiltersDrawerOpen((v) => !v);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: filtersDrawerOpen ? "var(--accent-bg)" : "var(--surface)",
              border: `1px solid ${filtersDrawerOpen ? "var(--accent)" : "var(--border)"}`,
              color: filtersDrawerOpen ? "var(--accent)" : "var(--text-secondary)",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
              userSelect: "none",
              whiteSpace: "nowrap",
              fontWeight: filtersDrawerOpen ? 500 : 400,
            }}
          >
            <FilterIcon />
            Advanced Filters
          </button>
        </div>

        {/* ═══ Outlets Drawer ═══ */}
        {outletsDrawerOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              width: 600,
              background: "var(--surface-white)",
              border: "1px solid var(--border)",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              boxShadow: "var(--drawer-shadow)",
              zIndex: 60,
              padding: "20px 24px",
              maxHeight: 560,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              Select Outlets
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>
                {selectedOutlets.size} of {outlets.length} selected
              </span>
            </div>

            {/* View by toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 0, marginLeft: "auto" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    marginRight: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  View by:
                </span>
                <button
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    border: "1px solid var(--brand-border)",
                    borderRight: "none",
                    background: "var(--brand-bg)",
                    color: "var(--brand)",
                    cursor: "pointer",
                    borderRadius: "4px 0 0 4px",
                    lineHeight: 1.3,
                  }}
                >
                  Bias
                </button>
                <button
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "3px 10px",
                    border: "1px solid var(--border)",
                    background: "var(--tag-bg)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    borderRadius: "0 4px 4px 0",
                    lineHeight: 1.3,
                  }}
                  // TODO: implement Region grouping view
                >
                  Region
                </button>
              </div>
            </div>

            {/* Outlet groups */}
            {BIAS_GROUPS.map((group) => {
              const groupOutlets = outletsByBias[group];
              if (groupOutlets.length === 0) return null;
              const allSelected = groupOutlets.every((o) =>
                selectedOutlets.has(o.outletDomain),
              );
              const someSelected =
                !allSelected &&
                groupOutlets.some((o) => selectedOutlets.has(o.outletDomain));

              return (
                <div key={group} style={{ marginBottom: 14 }}>
                  {/* Group header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={() => toggleBiasGroup(group)}
                      style={{
                        accentColor: "var(--brand)",
                        width: 15,
                        height: 15,
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleBiasGroup(group)}
                    >
                      {group}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      ({groupOutlets.length})
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        borderRadius: 1,
                        marginLeft: 8,
                        background: BIAS_GROUP_COLORS[group],
                      }}
                    />
                  </div>

                  {/* Individual outlet chips */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                      paddingLeft: 23,
                    }}
                  >
                    {groupOutlets.map((o) => {
                      const sel = selectedOutlets.has(o.outletDomain);
                      return (
                        <label
                          key={o.outletDomain}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: sel ? "var(--brand-bg)" : "var(--tag-bg)",
                            border: `1px solid ${sel ? "var(--brand)" : "var(--tag-border)"}`,
                            borderRadius: 6,
                            padding: "3px 9px",
                            fontSize: 12,
                            color: sel ? "var(--brand)" : "var(--text-secondary)",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            userSelect: "none",
                            whiteSpace: "nowrap",
                            fontWeight: sel ? 500 : 400,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleOutlet(o.outletDomain)}
                            style={{
                              accentColor: "var(--brand)",
                              width: 13,
                              height: 13,
                              cursor: "pointer",
                            }}
                          />
                          {shortName(o.outletDomain)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Advanced Filters Drawer ═══ */}
        {filtersDrawerOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              width: 600,
              background: "var(--surface-white)",
              border: "1px solid var(--border)",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              boxShadow: "var(--drawer-shadow)",
              zIndex: 60,
              padding: "20px 24px",
              maxHeight: 560,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: "2px solid var(--border)",
              }}
            >
              Advanced Filters
            </div>

            {/* TIME RANGE */}
            {/* TODO: wire time range to API when backend supports it */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--text-tertiary)",
                  marginBottom: 10,
                }}
              >
                Time Range
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {TIME_RANGES.map((t) => {
                  const sel = timeRange === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTimeRange(t)}
                      style={{
                        background: sel ? "var(--accent-bg)" : "var(--tag-bg)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--tag-border)"}`,
                        borderRadius: 6,
                        padding: "5px 14px",
                        fontSize: 13,
                        color: sel ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontWeight: sel ? 500 : 400,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CATEGORIES */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--text-tertiary)",
                  marginBottom: 10,
                }}
              >
                Categories
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map((cat) => {
                  const sel = selectedCategories.has(cat);
                  return (
                    <label
                      key={cat}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: sel ? "var(--accent-bg)" : "var(--tag-bg)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--tag-border)"}`,
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 13,
                        color: sel ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        userSelect: "none",
                        fontWeight: sel ? 500 : 400,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleCategory(cat)}
                        style={{ accentColor: "var(--accent)", width: 13, height: 13 }}
                      />
                      {cat}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* GEOGRAPHIC RELEVANCE */}
            {/* TODO: wire geo relevance to API when backend supports it */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--text-tertiary)",
                  marginBottom: 10,
                }}
              >
                Geographic Relevance
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {GEO_OPTIONS.map((geo) => {
                  const sel = selectedGeo.has(geo);
                  return (
                    <label
                      key={geo}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: sel ? "var(--accent-bg)" : "var(--tag-bg)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--tag-border)"}`,
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 13,
                        color: sel ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        userSelect: "none",
                        fontWeight: sel ? 500 : 400,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleGeo(geo)}
                        style={{ accentColor: "var(--accent)", width: 13, height: 13 }}
                      />
                      {geo}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* PUBLIC INTEREST */}
            {/* TODO: wire public interest toggle to API when backend supports it */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--text-tertiary)",
                  marginBottom: 10,
                }}
              >
                Public Interest
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    position: "relative",
                    width: 40,
                    height: 22,
                    cursor: "pointer",
                    display: "inline-block",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={publicInterestOnly}
                    onChange={(e) => setPublicInterestOnly(e.target.checked)}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: publicInterestOnly ? "var(--accent)" : "var(--toggle-track)",
                      borderRadius: 11,
                      transition: "background 0.2s",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      top: 2,
                      left: publicInterestOnly ? 20 : 2,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                </label>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>
                    Show public interest stories only
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                    Filter out gossip, celebrity news, and low-impact coverage
                  </div>
                </div>
              </div>
            </div>

            {/* MINIMUM CLUSTER SIZE */}
            <div style={{ marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--text-tertiary)",
                  marginBottom: 10,
                }}
              >
                Minimum Cluster Size
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {MIN_CLUSTER_OPTIONS.map((n) => {
                  const sel = minClusterSize === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setMinClusterSize(n)}
                      style={{
                        background: sel ? "var(--accent-bg)" : "var(--tag-bg)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--tag-border)"}`,
                        borderRadius: 6,
                        padding: "5px 14px",
                        fontSize: 13,
                        color: sel ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontWeight: sel ? 600 : 400,
                      }}
                    >
                      {n}+
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Row 2: Quick filter chips ═══ */}
      <div
        style={{
          background: "var(--surface-white)",
          padding: "12px 32px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          transition: "background 0.3s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Quick filters
          </span>
          {(
            [
              { key: "forPolitics" as const, label: "For politics" },
              { key: "publicInterestOnly" as const, label: "Public interest only" },
              { key: "usFocusOnly" as const, label: "US focus only" },
              { key: "exclSports" as const, label: "Excl. sports" },
            ] as const
          ).map(({ key, label }) => {
            const active = quickFilters[key];
            return (
              <button
                key={key}
                onClick={() => toggleQuickFilter(key)}
                style={{
                  background: active ? "var(--accent-bg)" : "var(--tag-bg)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--tag-border)"}`,
                  borderRadius: 16,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {/* Table view dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
            Table view:
          </span>
          <select
            value={tableView}
            onChange={(e) => setTableView(e.target.value as typeof tableView)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 28px 6px 10px",
              fontSize: 12,
              color: "var(--text)",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6560' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            <option value="outlets-bias">Outlets by Bias</option>
            <option value="outlets-region">Outlets by Region</option>
            <option value="bias">Grouped by Bias</option>
            <option value="region">Grouped by Region</option>
          </select>
        </div>
      </div>

      {/* ═══ Heatmap table ═══ */}
      <div style={{ overflowX: "auto", padding: 0 }}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
            minWidth: 1200,
            fontSize: 13,
          }}
        >
          <thead>
            {/* Bias group header row */}
            <tr>
              {/* Meta columns: #, Topic, Pol, Geo */}
              <th
                style={{
                  ...stickyCol(0, 28),
                  background: "var(--surface)",
                  padding: "6px 0 2px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  borderBottom: "none",
                  textAlign: "center",
                  color: "transparent",
                }}
              >
                &nbsp;
              </th>
              <th
                style={{
                  ...stickyCol(28, 260),
                  background: "var(--surface)",
                  padding: "6px 0 2px",
                  fontSize: 10,
                  color: "transparent",
                  borderBottom: "none",
                }}
              >
                &nbsp;
              </th>
              <th
                style={{
                  ...stickyCol(288, 40),
                  background: "var(--surface)",
                  padding: "6px 0 2px",
                  fontSize: 10,
                  color: "transparent",
                  borderBottom: "none",
                }}
              >
                &nbsp;
              </th>
              <th
                style={{
                  ...stickyCol(328, 40, true),
                  background: "var(--surface)",
                  padding: "6px 0 2px",
                  fontSize: 10,
                  color: "transparent",
                  borderBottom: "none",
                }}
              >
                &nbsp;
              </th>
              {/* Bias group spans */}
              {groupSpans.map(({ group, count }) => (
                <th
                  key={group}
                  colSpan={count}
                  style={{
                    padding: "6px 0 2px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    borderBottom: "none",
                    textAlign: "center",
                    background: "var(--surface)",
                    color: BIAS_GROUP_COLORS[group],
                  }}
                >
                  {group.toUpperCase()}
                </th>
              ))}
            </tr>

            {/* Column header row */}
            <tr>
              {/* # */}
              <th
                style={{
                  ...stickyCol(0, 28),
                  background: "var(--surface)",
                  padding: "6px 4px",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  borderBottom: "none",
                  textAlign: "right",
                  paddingRight: 6,
                  zIndex: 10,
                }}
              >
                #
              </th>
              {/* Topic */}
              <th
                style={{
                  ...stickyCol(28, 260),
                  background: "var(--surface)",
                  padding: "6px 4px 6px 12px",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  borderBottom: "none",
                  textAlign: "left",
                  zIndex: 10,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleSort("clusterSize")}
              >
                Cluster{" "}
                <span
                  style={{
                    fontSize: 9,
                    marginLeft: 2,
                    opacity: sortField === "clusterSize" ? 1 : 0.4,
                    color: sortField === "clusterSize" ? "var(--brand)" : undefined,
                  }}
                >
                  {sortField === "clusterSize" ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : "\u25BC"}
                </span>
              </th>
              {/* Pol */}
              <th
                style={{
                  ...stickyCol(288, 40),
                  background: "var(--surface)",
                  padding: "6px 4px 6px 12px",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  borderBottom: "none",
                  textAlign: "left",
                  zIndex: 10,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleSort("polSkew")}
              >
                Pol{" "}
                <span
                  style={{
                    fontSize: 9,
                    marginLeft: 2,
                    opacity: sortField === "polSkew" ? 1 : 0.4,
                    color: sortField === "polSkew" ? "var(--brand)" : undefined,
                  }}
                >
                  {sortField === "polSkew" ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : "\u25BC"}
                </span>
              </th>
              {/* Geo */}
              <th
                style={{
                  ...stickyCol(328, 40, true),
                  background: "var(--surface)",
                  padding: "6px 4px 6px 12px",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  borderBottom: "none",
                  textAlign: "left",
                  zIndex: 10,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleSort("geoSkew")}
              >
                Geo{" "}
                <span
                  style={{
                    fontSize: 9,
                    marginLeft: 2,
                    opacity: sortField === "geoSkew" ? 1 : 0.4,
                    color: sortField === "geoSkew" ? "var(--brand)" : undefined,
                  }}
                >
                  {sortField === "geoSkew" ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : "\u25BC"}
                </span>
              </th>
              {/* Per-outlet columns */}
              {visibleOutlets.map(({ domain }) => (
                <th
                  key={domain}
                  style={{
                    padding: "6px 0",
                    fontWeight: 600,
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    borderBottom: "none",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    transform: "rotate(180deg)",
                    height: 72,
                    verticalAlign: "middle",
                    minWidth: 44,
                    maxWidth: 56,
                    background: "var(--surface)",
                  }}
                >
                  {shortName(domain)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={4 + visibleOutlets.length}
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 14,
                  }}
                >
                  No clusters found
                  {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}
                </td>
              </tr>
            )}
            {filteredRows.map((row, idx) => {
              const polVal = Number(row.polSkew) || 0;
              const geoVal = Number(row.geoSkew) || 0;

              return (
                <tr
                  key={row.topicId}
                  onClick={() => navigate(`/topic/${row.topicId}`)}
                  style={{
                    borderBottom: "1px solid var(--border-light)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--row-hover)";
                    // Also highlight sticky cols
                    const stickyCols = e.currentTarget.querySelectorAll<HTMLElement>("[data-sticky]");
                    stickyCols.forEach((el) => {
                      el.style.background = "var(--row-hover)";
                    });
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                    const stickyCols = e.currentTarget.querySelectorAll<HTMLElement>("[data-sticky]");
                    stickyCols.forEach((el) => {
                      el.style.background = "var(--surface-white)";
                    });
                  }}
                >
                  {/* Row number */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(0, 28),
                      background: "var(--surface-white)",
                      color: "var(--text-tertiary)",
                      fontSize: 11,
                      textAlign: "right",
                      paddingRight: 6,
                      padding: "6px 6px 6px 4px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {idx + 1}
                  </td>

                  {/* Topic */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(28, 260),
                      background: "var(--surface-white)",
                      textAlign: "left",
                      padding: "6px 4px 6px 12px",
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--text)",
                      fontWeight: 500,
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.topicLabel}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        marginTop: 1,
                      }}
                    >
                      <a
                        href={`/topic/${row.topicId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
                      >
                        see all {Number(row.totalArticles)} articles
                      </a>
                      {row.topCategory && (
                        <span style={{ color: "var(--text-tertiary)" }}>
                          &middot; {row.topCategory}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pol skew */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(288, 40),
                      background: "var(--surface-white)",
                      textAlign: "left",
                      paddingLeft: 12,
                      color:
                        polVal > 0
                          ? "var(--gap-right)"
                          : polVal < 0
                            ? "var(--gap-left)"
                            : "var(--text-tertiary)",
                      fontWeight: 500,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatSkew(polVal)}
                  </td>

                  {/* Geo skew */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(328, 40, true),
                      background: "var(--surface-white)",
                      textAlign: "left",
                      paddingLeft: 12,
                      color:
                        geoVal > 0
                          ? "var(--gap-right)"
                          : geoVal < 0
                            ? "var(--gap-left)"
                            : "var(--text-tertiary)",
                      fontWeight: 500,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatSkew(geoVal)}
                  </td>

                  {/* Heat cells */}
                  {visibleOutlets.map(({ domain }) => {
                    const cell = row.cells[domain];
                    const count = cell ? Number(cell.articleCount) || 0 : 0;
                    const piCount = cell ? Number(cell.piCount) || 0 : 0;
                    const heat = getHeatStyle(count, piCount, isDark);
                    return (
                      <td
                        key={domain}
                        style={{
                          background: heat.bg,
                          color: heat.fg,
                          textAlign: "center",
                          padding: "6px 4px",
                          fontSize: 12,
                          fontWeight: count >= 9 ? 700 : count > 0 ? 500 : 400,
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 44,
                          borderRadius: 2,
                          transition: "all 0.1s",
                          cursor: "pointer",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (count > 0) {
                            e.currentTarget.style.outline = "2px solid var(--heat-outline)";
                            e.currentTarget.style.outlineOffset = "-1px";
                            e.currentTarget.style.zIndex = "5";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.outline = "none";
                          e.currentTarget.style.zIndex = "";
                        }}
                      >
                        {count > 0 ? count : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "20px 32px",
          fontSize: 12,
          color: "var(--text-tertiary)",
          borderTop: "1px solid var(--border-light)",
          textAlign: "center",
        }}
      >
        media.games &middot; Coverage heatmap &middot; Outlets ordered by Ad Fontes Media bias
        score (left &rarr; right)
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function stickyCol(
  left: number,
  minWidth: number,
  hasShadow = false,
): React.CSSProperties {
  return {
    position: "sticky" as const,
    left,
    zIndex: 5,
    minWidth,
    ...(hasShadow ? { boxShadow: "2px 0 4px rgba(0,0,0,0.04)" } : {}),
  };
}
