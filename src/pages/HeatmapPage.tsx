import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchHeatmap, fetchHeatmapSummary, fetchOutlets } from "../api/client";
import type { HeatmapRow, HeatmapSummary, Outlet } from "../api/types";
import { ClusterInspector } from "../components/ClusterInspector";

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

// Display names come from the outlets metadata table (outlets.display_name).
// No hardcoded map needed — built dynamically from API response.

const CATEGORIES = [
  "Politics",
  "Business",
  "Technology",
  "Health",
  "Science",
  "Environment",
  "Entertainment",
  "Sports",
  "General",
];

const GEO_OPTIONS = ["US", "Global", "Foreign", "State & Local"];

const REGION_GROUPS = ["US", "CA", "EMEA", "APAC", "Global"] as const;
type RegionGroup = (typeof REGION_GROUPS)[number];

const REGION_GROUP_COLORS: Record<RegionGroup, string> = {
  US: "#8B7355",
  CA: "#7B6B45",
  EMEA: "#6B8E8E",
  APAC: "#8E6B8E",
  Global: "var(--text-tertiary)",
};

const REGION_LONG_LABELS: Record<RegionGroup, string> = {
  US: "US (United States)",
  CA: "CA (Canada)",
  EMEA: "EMEA (Europe, Middle East & Africa)",
  APAC: "APAC (Asia Pacific)",
  Global: "Global",
};

const TIME_RANGES = ["Last 24h", "Last 48h", "Last 7 days", "Last 30 days"];

type SortField = "clusterSize" | "polSkew" | "geoSkew";
type SortDir = "asc" | "desc";

interface QuickFilters {
  forPolitics: boolean;
  usFocusOnly: boolean;
  exclSportsEnt: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalize a clean category value (e.g. "politics" → "Politics") */
function cleanCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

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
  if (val === 0) return "0.00";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}`;
}

/** Interpolate between two hex colors. t=0 → c1, t=1 → c2 */
function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/** Political skew color: -1 = blue, 0 = charcoal, +1 = red */
function polSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#4A7EC9", "#4A4A4A", v + 1); // -1→blue, 0→charcoal
  return lerpColor("#4A4A4A", "#C94A4A", v);                  // 0→charcoal, +1→red
}

/** Geographic skew color: -1 = green, 0 = charcoal, +1 = blue */
function geoSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#3A9A5C", "#4A4A4A", v + 1); // -1→green, 0→gray
  return lerpColor("#4A4A4A", "#4A7EC9", v);                  // 0→gray, +1→blue
}

/** Diverging bar: center = 0, positive grows right, negative grows left */
function SkewBar({ value, colorPos, colorNeg }: { value: number; colorPos: string; colorNeg: string }) {
  const v = Math.max(-1, Math.min(1, value));
  const pct = Math.abs(v) * 50; // 0-50% of container width
  return (
    <div style={{ position: "relative", width: "100%", height: 12, borderRadius: 2, background: "#f0efed" }}>
      {/* center line */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#ccc" }} />
      {/* bar */}
      {v !== 0 && (
        <div
          style={{
            position: "absolute",
            top: 1,
            bottom: 1,
            borderRadius: 1,
            background: v > 0 ? colorPos : colorNeg,
            ...(v > 0
              ? { left: "50%", width: `${pct}%` }
              : { right: "50%", width: `${pct}%` }),
          }}
        />
      )}
    </div>
  );
}

function fallbackName(domain: string): string {
  return domain.replace(/\.(com|org|net|co\.uk|net\.au)$/, "");
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeClusterId = searchParams.get("cluster");
  const [inspectorFilter, setInspectorFilter] = useState<{ outlet?: string; bias?: string; region?: string } | undefined>(undefined);

  // --- Data state ---
  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [_summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // --- Pagination ---
  const PAGE_SIZE = 200;
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  // --- Quick filters ---
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({
    forPolitics: false,
    usFocusOnly: false,
    exclSportsEnt: false,
  });

  // --- Outlets picker ---
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set());
  const [outletsDrawerOpen, setOutletsDrawerOpen] = useState(false);
  const [outletPickerView, setOutletPickerView] = useState<"bias" | "region">("bias");

  // --- Advanced filters ---
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<string>("Last 30 days");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(CATEGORIES),
  );
  const [selectedGeo, setSelectedGeo] = useState<Set<string>>(new Set(GEO_OPTIONS)); // TODO: wire to API when supported
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [minPiPct, setMinPiPct] = useState(0);

  // --- Table view ---
  const [tableView, setTableView] = useState<"outlets-bias" | "outlets-region" | "bias" | "region">("bias");

  // --- Sort ---
  const [sortField, setSortField] = useState<SortField>("clusterSize");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // --- Theme detection for heat cell text color ---
  const isDark = typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  // --- Derived: group outlets by bias ---
  // --- Display name lookup from outlets metadata ---
  const shortName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of outlets) {
      map[o.outletDomain] = o.displayName || fallbackName(o.outletDomain);
    }
    return (domain: string) => map[domain] || fallbackName(domain);
  }, [outlets]);

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
    for (const g of BIAS_GROUPS) {
      groups[g].sort(
        (a, b) => Number(a.adfontesBiasScore) - Number(b.adfontesBiasScore),
      );
    }
    return groups;
  }, [outlets]);

  // --- Derived: group outlets by region ---
  const outletsByRegion = useMemo(() => {
    const groups: Record<RegionGroup, Outlet[]> = { US: [], CA: [], EMEA: [], APAC: [], Global: [] };
    for (const o of outlets) {
      const region = (o.geoRegion as RegionGroup) || "Global";
      if (groups[region]) groups[region].push(o);
      else groups.Global.push(o);
    }
    for (const r of REGION_GROUPS) {
      groups[r].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    }
    return groups;
  }, [outlets]);

  // --- Derived: build a bias-group lookup for each outlet domain ---
  const outletBiasMap = useMemo(() => {
    const m: Record<string, BiasGroup> = {};
    for (const g of BIAS_GROUPS) {
      for (const o of outletsByBias[g]) m[o.outletDomain] = g;
    }
    return m;
  }, [outletsByBias]);

  // --- Derived: build a region-group lookup for each outlet domain ---
  const outletRegionMap = useMemo(() => {
    const m: Record<string, RegionGroup> = {};
    for (const r of REGION_GROUPS) {
      for (const o of outletsByRegion[r]) m[o.outletDomain] = r;
    }
    return m;
  }, [outletsByRegion]);

  // --- Derived: ordered list of selected outlet domains for table columns ---
  const visibleOutlets = useMemo(() => {
    if (tableView === "outlets-region") {
      const result: { domain: string; group: BiasGroup; region: RegionGroup }[] = [];
      for (const r of REGION_GROUPS) {
        for (const o of outletsByRegion[r]) {
          if (selectedOutlets.has(o.outletDomain)) {
            result.push({ domain: o.outletDomain, group: outletBiasMap[o.outletDomain] || "Center", region: r });
          }
        }
      }
      return result;
    }
    const result: { domain: string; group: BiasGroup; region: RegionGroup }[] = [];
    for (const g of BIAS_GROUPS) {
      for (const o of outletsByBias[g]) {
        if (selectedOutlets.has(o.outletDomain)) {
          result.push({ domain: o.outletDomain, group: g, region: outletRegionMap[o.outletDomain] || "Global" });
        }
      }
    }
    return result;
  }, [outletsByBias, outletsByRegion, outletBiasMap, outletRegionMap, selectedOutlets, tableView]);

  // --- Derived: group spans for table header (bias or region grouping) ---
  const groupSpans = useMemo(() => {
    if (tableView === "outlets-region") {
      const spans: { label: string; count: number; color: string }[] = [];
      let current: RegionGroup | null = null;
      let count = 0;
      for (const o of visibleOutlets) {
        if (o.region !== current) {
          if (current !== null && count > 0) {
            spans.push({ label: current, count, color: REGION_GROUP_COLORS[current] });
          }
          current = o.region;
          count = 1;
        } else {
          count++;
        }
      }
      if (current !== null && count > 0) {
        spans.push({ label: current, count, color: REGION_GROUP_COLORS[current] });
      }
      return spans;
    }
    // outlets-bias (default) or grouped views
    const spans: { label: string; count: number; color: string }[] = [];
    let current: BiasGroup | null = null;
    let count = 0;
    for (const o of visibleOutlets) {
      if (o.group !== current) {
        if (current !== null && count > 0) {
          spans.push({ label: current.toUpperCase(), count, color: BIAS_GROUP_COLORS[current] });
        }
        current = o.group;
        count = 1;
      } else {
        count++;
      }
    }
    if (current !== null && count > 0) {
      spans.push({ label: current.toUpperCase(), count, color: BIAS_GROUP_COLORS[current] });
    }
    return spans;
  }, [visibleOutlets, tableView]);

  // --- Derived: columns for "Grouped by Bias" and "Grouped by Region" views ---
  type GroupedColumn = { key: string; label: string; color: string; domains: string[] };
  const groupedColumns = useMemo((): GroupedColumn[] | null => {
    if (tableView === "bias") {
      return BIAS_GROUPS.map((g) => ({
        key: g,
        label: g.toUpperCase(),
        color: BIAS_GROUP_COLORS[g],
        domains: outletsByBias[g]
          .filter((o) => selectedOutlets.has(o.outletDomain))
          .map((o) => o.outletDomain),
      })).filter((c) => c.domains.length > 0);
    }
    if (tableView === "region") {
      return REGION_GROUPS.map((r) => ({
        key: r,
        label: r,
        color: REGION_GROUP_COLORS[r],
        domains: outletsByRegion[r]
          .filter((o) => selectedOutlets.has(o.outletDomain))
          .map((o) => o.outletDomain),
      })).filter((c) => c.domains.length > 0);
    }
    return null;
  }, [tableView, outletsByBias, outletsByRegion, selectedOutlets]);

  // --- Compute the active API category ---
  const activeApiCategory = useMemo((): string | undefined => {
    if (quickFilters.forPolitics) return "politics";
    // If exactly one category is selected in advanced filters, use it
    if (selectedCategories.size === 1) {
      return [...selectedCategories][0].toLowerCase();
    }
    return undefined;
  }, [quickFilters.forPolitics, selectedCategories]);

  // --- Debounce search query ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(0); // reset to first page on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [activeApiCategory, minClusterSize]);

  // --- Load data ---
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts: Parameters<typeof fetchHeatmap>[0] = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (activeApiCategory) opts.category = activeApiCategory;
      if (debouncedQuery.trim()) opts.q = debouncedQuery.trim();

      const [heatmap, sum, outletsResp] = await Promise.all([
        fetchHeatmap(opts),
        fetchHeatmapSummary(),
        fetchOutlets(),
      ]);
      setRows(heatmap.data);
      setTotalRows(heatmap.meta.total);
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
  }, [activeApiCategory, debouncedQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Client-side filtering & sorting ---
  const filteredRows = useMemo(() => {
    let result = rows;

    // Search is now server-side via API `q` param

    // Min cluster size filter
    if (minClusterSize > 1) {
      result = result.filter((r) => Number(r.clusterSize) >= minClusterSize);
    }

    // Min PI percentage filter
    if (minPiPct > 0) {
      result = result.filter((r) => {
        let total = 0, piTotal = 0;
        for (const cell of Object.values(r.cells)) {
          total += Number(cell.articleCount) || 0;
          piTotal += Number(cell.piCount) || 0;
        }
        return total > 0 && (piTotal / total) * 100 >= minPiPct;
      });
    }

    // Quick filter: exclude sports & entertainment
    if (quickFilters.exclSportsEnt) {
      result = result.filter(
        (r) => {
          const cat = r.dominantCategory?.toLowerCase();
          return cat !== "sports" && cat !== "entertainment";
        },
      );
    }

    // Quick filter: US focus only
    if (quickFilters.usFocusOnly) {
      result = result.filter((r) => r.isUsRelevant);
    }

    // Categories filter (client-side — exclude rows whose dominantCategory is unchecked)
    if (selectedCategories.size < CATEGORIES.length) {
      result = result.filter((r) => {
        const cat = r.dominantCategory?.toLowerCase();
        if (!cat) return true; // keep rows with no category
        return [...selectedCategories].some((c) => c.toLowerCase() === cat);
      });
    }

    // Time range filter (client-side on latestPublished)
    if (timeRange !== "Last 30 days") {
      const hoursMap: Record<string, number> = {
        "Last 24h": 24,
        "Last 48h": 48,
        "Last 7 days": 168,
      };
      const maxHours = hoursMap[timeRange];
      if (maxHours) {
        const cutoff = Date.now() - maxHours * 3_600_000;
        result = result.filter((r) => {
          const latest = new Date(r.latestPublished).getTime();
          return latest >= cutoff;
        });
      }
    }

    // Geo relevance filter — show clusters matching ANY selected geo scope
    if (selectedGeo.size < GEO_OPTIONS.length) {
      result = result.filter((r) => {
        if (selectedGeo.has("US") && r.isUsRelevant) return true;
        if (selectedGeo.has("Global") && r.isGloballyRelevant) return true;
        if (selectedGeo.has("Foreign") && r.isForeignRelevant) return true;
        if (selectedGeo.has("State & Local") && r.isStateLocal) return true;
        return false;
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = Number(a[sortField]) || 0;
      const bVal = Number(b[sortField]) || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [rows, minClusterSize, minPiPct, quickFilters, selectedCategories, timeRange, selectedGeo, sortField, sortDir]);

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
    setQuickFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Sync advanced filter checkboxes when "No sports & entertainment" is toggled
      if (key === "exclSportsEnt") {
        setSelectedCategories((cats) => {
          const updated = new Set(cats);
          if (next.exclSportsEnt) {
            updated.delete("Sports");
            updated.delete("Entertainment");
          } else {
            updated.add("Sports");
            updated.add("Entertainment");
          }
          return updated;
        });
      }
      return next;
    });
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

  const totalCount = totalRows;
  const filteredCount = filteredRows.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
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
                  onClick={() => setOutletPickerView("bias")}
                  style={{
                    fontSize: 11,
                    fontWeight: outletPickerView === "bias" ? 600 : 500,
                    padding: "3px 10px",
                    border: `1px solid ${outletPickerView === "bias" ? "var(--brand-border)" : "var(--border)"}`,
                    borderRight: "none",
                    background: outletPickerView === "bias" ? "var(--brand-bg)" : "var(--tag-bg)",
                    color: outletPickerView === "bias" ? "var(--brand)" : "var(--text-secondary)",
                    cursor: "pointer",
                    borderRadius: "4px 0 0 4px",
                    lineHeight: 1.3,
                  }}
                >
                  Bias
                </button>
                <button
                  onClick={() => setOutletPickerView("region")}
                  style={{
                    fontSize: 11,
                    fontWeight: outletPickerView === "region" ? 600 : 500,
                    padding: "3px 10px",
                    border: `1px solid ${outletPickerView === "region" ? "var(--brand-border)" : "var(--border)"}`,
                    background: outletPickerView === "region" ? "var(--brand-bg)" : "var(--tag-bg)",
                    color: outletPickerView === "region" ? "var(--brand)" : "var(--text-secondary)",
                    cursor: "pointer",
                    borderRadius: "0 4px 4px 0",
                    lineHeight: 1.3,
                  }}
                >
                  Region
                </button>
              </div>
            </div>

            {/* Outlet groups */}
            {(outletPickerView === "bias" ? BIAS_GROUPS : REGION_GROUPS).map((group) => {
              const groupOutlets = outletPickerView === "bias"
                ? outletsByBias[group as BiasGroup]
                : outletsByRegion[group as RegionGroup];
              if (!groupOutlets || groupOutlets.length === 0) return null;
              const groupColor = outletPickerView === "bias"
                ? BIAS_GROUP_COLORS[group as BiasGroup]
                : REGION_GROUP_COLORS[group as RegionGroup];
              const allSelected = groupOutlets.every((o) =>
                selectedOutlets.has(o.outletDomain),
              );
              const someSelected =
                !allSelected &&
                groupOutlets.some((o) => selectedOutlets.has(o.outletDomain));
              const toggleGroup = () => {
                const groupDomains = groupOutlets.map((o) => o.outletDomain);
                setSelectedOutlets((prev) => {
                  const next = new Set(prev);
                  for (const d of groupDomains) {
                    if (allSelected) next.delete(d);
                    else next.add(d);
                  }
                  return next;
                });
              };

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
                      onChange={toggleGroup}
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
                      onClick={toggleGroup}
                    >
                      {outletPickerView === "region" ? REGION_LONG_LABELS[group as RegionGroup] : group}
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
                        background: groupColor,
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

            {/* ─── PUBLIC INTEREST ─── */}
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
                Minimum Public Interest Score
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: 6,
                      borderRadius: 3,
                      background: "linear-gradient(to right, rgb(180,60,50), rgb(190,160,50), rgb(50,150,70))",
                    }}
                  />
                  <input
                    type="range"
                    className="pi-slider"
                    min={0}
                    max={100}
                    value={minPiPct}
                    onChange={(e) => setMinPiPct(Number(e.target.value))}
                    style={{
                      width: "100%",
                      position: "relative",
                      cursor: "pointer",
                      WebkitAppearance: "none",
                      appearance: "none",
                      background: "transparent",
                      margin: 0,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--accent)",
                    minWidth: 32,
                    textAlign: "center",
                  }}
                >
                  {minPiPct}%
                </span>
              </div>
            </div>

            {/* ─── MINIMUM CLUSTER SIZE ─── */}
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
                Minimum Topic Article Count
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={minClusterSize}
                  onChange={(e) => setMinClusterSize(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: "var(--accent)",
                    cursor: "pointer",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--accent)",
                    minWidth: 32,
                    textAlign: "center",
                  }}
                >
                  {minClusterSize}+
                </span>
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
              { key: "forPolitics" as const, label: "Politics only" },
              { key: "usFocusOnly" as const, label: "US focus only" },
              { key: "exclSportsEnt" as const, label: "No sports & entertainment" },
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
            <option value="bias">Grouped by Bias</option>
            <option value="region">Grouped by Region</option>
            <option value="outlets-bias">Outlets by Bias</option>
            <option value="outlets-region">Outlets by Region</option>
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
            fontFamily: "'Source Serif 4', Georgia, serif",
            ...(groupedColumns ? { tableLayout: "fixed" as const } : {}),
          }}
        >
          {/* Column widths for fixed-layout grouped views */}
          {groupedColumns && (
            <colgroup>
              <col style={{ width: 28 }} />   {/* # */}
              <col />                          {/* Topic — gets remaining space */}
              <col style={{ width: 50 }} />   {/* Bias Skew */}
              <col style={{ width: 50 }} />   {/* Geo Skew */}
              {groupedColumns.map((col) => (
                <col key={col.key} style={{ width: 80 }} />
              ))}
            </colgroup>
          )}
          <thead style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            {/* Group header row — only shown for per-outlet views */}
            {!groupedColumns && (<tr>
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
                  ...stickyCol(288, 60),
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
                  ...stickyCol(348, 60, true),
                  background: "var(--surface)",
                  padding: "6px 0 2px",
                  fontSize: 10,
                  color: "transparent",
                  borderBottom: "none",
                }}
              >
                &nbsp;
              </th>
              {/* Group spans */}
              {groupSpans.map(({ label, count, color }) => (
                <th
                  key={label}
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
                    color,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>)}

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
                Topic{" "}
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
                  ...stickyCol(288, 60),
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
                Bias Skew{" "}
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
                  ...stickyCol(348, 60, true),
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
                Geo Skew{" "}
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
              {/* Data columns — per-outlet or grouped */}
              {groupedColumns
                ? groupedColumns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: "6px 8px",
                        fontWeight: 700,
                        fontSize: 11,
                        color: col.color,
                        borderBottom: "none",
                        textAlign: "center",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        minWidth: 64,
                        width: `${(100 - 30) / groupedColumns.length}%`,
                        background: "var(--surface)",
                      }}
                    >
                      {col.label}
                    </th>
                  ))
                : visibleOutlets.map(({ domain }) => (
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
                  colSpan={5 + (groupedColumns ? groupedColumns.length : visibleOutlets.length)}
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
                  onClick={() => { setInspectorFilter(undefined); setSearchParams({ cluster: row.topicId }); }}
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
                      color: "var(--text)",
                      fontWeight: 500,
                      whiteSpace: "normal",
                      wordWrap: "break-word",
                    }}
                  >
                    <span>
                      {row.topicLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontWeight: 400,
                        marginLeft: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectorFilter(undefined);
                          setSearchParams({ cluster: row.topicId });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "var(--brand)",
                          textDecoration: "none",
                          fontWeight: 500,
                          fontSize: "inherit",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
                      >
                        see all {Number(row.totalArticles)} articles
                      </button>
                      {row.dominantCategory && (
                        <span style={{ color: "var(--text-tertiary)" }}>
                          &middot; {cleanCategory(row.dominantCategory)}
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Pol skew */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(288, 60),
                      background: "var(--surface-white)",
                      padding: "4px 6px",
                      verticalAlign: "middle",
                    }}
                  >
                    <SkewBar value={polVal} colorPos="#C94A4A" colorNeg="#4A7EC9" />
                  </td>

                  {/* Geo skew */}
                  <td
                    data-sticky
                    style={{
                      ...stickyCol(348, 60, true),
                      background: "var(--surface-white)",
                      padding: "4px 6px",
                      verticalAlign: "middle",
                    }}
                  >
                    <SkewBar value={geoVal} colorPos="#4A7EC9" colorNeg="#3A9A5C" />
                  </td>

                  {/* Heat cells — grouped or per-outlet */}
                  {groupedColumns
                    ? groupedColumns.map((col) => {
                        let count = 0;
                        let piSum = 0;
                        for (const d of col.domains) {
                          const cell = row.cells[d];
                          if (cell) {
                            count += Number(cell.articleCount) || 0;
                            piSum += Number(cell.piCount) || 0;
                          }
                        }
                        const heat = getHeatStyle(count, piSum, isDark);
                        return (
                          <td
                            key={col.key}
                            style={{
                              background: heat.bg,
                              color: heat.fg,
                              textAlign: "center",
                              padding: "6px 8px",
                              fontSize: 13,
                              fontWeight: count >= 9 ? 700 : count > 0 ? 500 : 400,
                              fontVariantNumeric: "tabular-nums",
                              minWidth: 64,
                              width: `${(100 - 30) / groupedColumns.length}%`,
                              borderRadius: 2,
                              transition: "all 0.1s",
                              cursor: "pointer",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (count > 0) {
                                const filterKey = tableView === "bias" ? "bias" : "region";
                                setInspectorFilter({ [filterKey]: col.key });
                                setSearchParams({ cluster: row.topicId });
                              }
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
                      })
                    : visibleOutlets.map(({ domain }) => {
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
                            onClick={(e) => {
                              e.stopPropagation();
                              if (count > 0) {
                                setInspectorFilter({ outlet: domain });
                                setSearchParams({ cluster: row.topicId });
                              }
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

      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
            padding: "16px 32px",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          {page > 0 && (
            <button
              onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--brand)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                padding: "6px 10px",
              }}
            >
              &lsaquo; Prev
            </button>
          )}
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => { setPage(i); window.scrollTo(0, 0); }}
              style={{
                background: i === page ? "var(--brand)" : "none",
                color: i === page ? "#fff" : "var(--brand)",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: i === page ? 700 : 400,
                cursor: "pointer",
                padding: "6px 10px",
                minWidth: 32,
              }}
            >
              {i + 1}
            </button>
          ))}
          {page < totalPages - 1 && (
            <button
              onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--brand)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                padding: "6px 10px",
              }}
            >
              Next &rsaquo;
            </button>
          )}
        </div>
      )}

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

      {/* ═══ Cluster Inspector overlay ═══ */}
      {activeClusterId && (
        <ClusterInspector
          topicId={activeClusterId}
          outlets={outlets}
          onClose={() => { setSearchParams({}); setInspectorFilter(undefined); }}
          initialFilter={inspectorFilter}
        />
      )}
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
