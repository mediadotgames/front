import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchTopic, fetchTopicArticles } from "../api/client";
import type { TopicDetail, Article, Outlet, OutletBreakdown } from "../api/types";

// ---------------------------------------------------------------------------
// Constants (mirrored from HeatmapPage — same grouping logic)
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

const REGION_GROUPS = ["NA", "EMEA", "APAC", "Global"] as const;
type RegionGroup = (typeof REGION_GROUPS)[number];

const REGION_GROUP_COLORS: Record<RegionGroup, string> = {
  NA: "#8B7355",
  EMEA: "#6B8E8E",
  APAC: "#8E6B8E",
  Global: "var(--text-tertiary)",
};

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

type TableView = "outlets-bias" | "outlets-region" | "bias" | "region";

interface FilterState {
  outlet: string | null;
  bias: string | null;
  region: string | null;
  piOnly: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClusterInspectorProps {
  topicId: string;
  outlets: Outlet[];
  onClose: () => void;
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

function cleanCategoryLabel(raw: string): string {
  const CATEGORY_MAP: Record<string, string> = {
    politics: "Politics", business: "Business", sports: "Sports",
    entertainment: "Entertainment", technology: "Technology", health: "Health",
    science: "Science", environment: "Environment", general: "General", world: "World",
  };
  const lower = raw.toLowerCase();
  for (const [key, label] of Object.entries(CATEGORY_MAP)) {
    if (lower === key || lower.includes(`/${key}`) || lower.startsWith(`${key}/`)) return label;
  }
  const last = raw.split("/").pop()?.replace(/_/g, " ") ?? raw;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function shortName(domain: string): string {
  return DISPLAY_NAMES[domain] || domain.replace(/\.(com|org|net|co\.uk|net\.au)$/, "");
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(earliest: string, latest: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(earliest)} – ${fmt(latest)}`;
}

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

const BIAS_COLORS: Record<string, string> = {
  Left: "var(--gap-left, #5B7FA6)",
  "Lean Left": "#7EA8C9",
  Center: "var(--text-tertiary, #9B958E)",
  "Lean Right": "#CC8A7E",
  Right: "var(--gap-right, #B86A5A)",
};

function biasColor(label: string | null): string {
  if (!label) return "var(--text-tertiary, #9B958E)";
  return BIAS_COLORS[label] ?? "var(--text-tertiary, #9B958E)";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BiasBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 500,
        color: "#fff",
        background: biasColor(label),
        padding: "1px 8px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function PIBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 600,
        color: "var(--accent, #7C8578)",
        background: "var(--accent-bg, rgba(124,133,120,0.10))",
        border: "1px solid var(--accent-border, rgba(124,133,120,0.3))",
        padding: "1px 6px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      PI
    </span>
  );
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

function polSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#C94A4A", "#4A4A4A", v + 1);
  return lerpColor("#4A4A4A", "#4A7EC9", v);
}

function geoSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#3A9A5C", "#4A4A4A", v + 1);
  return lerpColor("#4A4A4A", "#4A7EC9", v);
}

function SkewMeter({
  label,
  value,
  leftLabel,
  rightLabel,
  colorFn,
}: {
  label: string;
  value: number | string | null;
  leftLabel: string;
  rightLabel: string;
  colorFn: (v: number) => string;
}) {
  const v = Number(value) || 0;
  const clamped = Math.max(-1, Math.min(1, v));
  const pct = ((clamped + 1) / 2) * 100; // 0% = -1, 50% = 0, 100% = +1
  const dotColor = colorFn(v);

  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: dotColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {v >= 0 ? "+" : ""}{v.toFixed(2)}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 6,
          borderRadius: 3,
          background: "var(--surface, #F0EDE8)",
          overflow: "visible",
        }}
      >
        {/* Center tick */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -1,
            width: 1,
            height: 8,
            background: "var(--border, #DDD7CE)",
          }}
        />
        {/* Dot */}
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dotColor,
            border: "2px solid var(--surface-white, #fff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            transition: "left 0.3s",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClusterInspector({ topicId, outlets, onClose }: ClusterInspectorProps) {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tableView, setTableView] = useState<TableView>("outlets-bias");
  const [filter, setFilter] = useState<FilterState>({
    outlet: null,
    bias: null,
    region: null,
    piOnly: false,
  });

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  // --- Load topic metadata ---
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTopic(topicId)
      .then((data) => {
        if (!cancelled) setTopic(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [topicId]);

  // --- Load articles (re-fetches when filter changes) ---
  const loadArticles = useCallback(async () => {
    setArticlesLoading(true);
    try {
      const opts = {
        limit: 200,
        outlet: filter.outlet ?? undefined,
        bias: filter.bias ?? undefined,
        region: filter.region ?? undefined,
        piOnly: filter.piOnly || undefined,
      };
      let data;
      try {
        data = await fetchTopicArticles(topicId, { ...opts, sort: "similarity" });
      } catch {
        // Fallback if backend doesn't support similarity sort yet
        data = await fetchTopicArticles(topicId, { ...opts, sort: "newest" });
      }
      setArticles(data.data);
      setArticleTotal(data.meta.total);
    } catch {
      // silently fail for articles — topic header still shows
    } finally {
      setArticlesLoading(false);
    }
  }, [topicId, filter]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // --- Outlet grouping (reuse HeatmapPage logic) ---
  const outletsByBias = useMemo(() => {
    const groups: Record<BiasGroup, Outlet[]> = {
      Left: [], "Lean Left": [], Center: [], "Lean Right": [], Right: [],
    };
    for (const o of outlets) {
      const group = biasGroupForScore(Number(o.adfontesBiasScore));
      groups[group].push(o);
    }
    for (const g of BIAS_GROUPS) {
      groups[g].sort((a, b) => Number(a.adfontesBiasScore) - Number(b.adfontesBiasScore));
    }
    return groups;
  }, [outlets]);

  const outletsByRegion = useMemo(() => {
    const groups: Record<RegionGroup, Outlet[]> = { NA: [], EMEA: [], APAC: [], Global: [] };
    for (const o of outlets) {
      const region = (o.geoRegion as RegionGroup) || "Global";
      if (groups[region]) groups[region].push(o);
      else groups.Global.push(o);
    }
    return groups;
  }, [outlets]);

  const outletBiasMap = useMemo(() => {
    const m: Record<string, BiasGroup> = {};
    for (const g of BIAS_GROUPS) for (const o of outletsByBias[g]) m[o.outletDomain] = g;
    return m;
  }, [outletsByBias]);

  const outletRegionMap = useMemo(() => {
    const m: Record<string, RegionGroup> = {};
    for (const r of REGION_GROUPS) for (const o of outletsByRegion[r]) m[o.outletDomain] = r;
    return m;
  }, [outletsByRegion]);

  // --- Outlet domain -> geo_group lookup for filter-by-region on cell click ---
  const outletGeoMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of outlets) m[o.outletDomain] = o.geoGroup || o.geoRegion || "Global";
    return m;
  }, [outlets]);

  // --- Build ordered outlet list based on table view ---
  // For the ribbon, we only show outlets that have articles in this cluster
  const clusterOutletDomains = useMemo(() => {
    if (!topic) return new Set<string>();
    return new Set(topic.outletBreakdown.map((o) => o.outletDomain));
  }, [topic]);

  const visibleOutlets = useMemo(() => {
    if (tableView === "outlets-region") {
      const result: { domain: string; group: BiasGroup; region: RegionGroup }[] = [];
      for (const r of REGION_GROUPS) {
        for (const o of outletsByRegion[r]) {
          if (clusterOutletDomains.has(o.outletDomain))
            result.push({ domain: o.outletDomain, group: outletBiasMap[o.outletDomain] || "Center", region: r });
        }
      }
      return result;
    }
    const result: { domain: string; group: BiasGroup; region: RegionGroup }[] = [];
    for (const g of BIAS_GROUPS) {
      for (const o of outletsByBias[g]) {
        if (clusterOutletDomains.has(o.outletDomain))
          result.push({ domain: o.outletDomain, group: g, region: outletRegionMap[o.outletDomain] || "Global" });
      }
    }
    return result;
  }, [outletsByBias, outletsByRegion, outletBiasMap, outletRegionMap, clusterOutletDomains, tableView]);

  // --- Group spans for header labels ---
  const groupSpans = useMemo(() => {
    if (tableView === "outlets-region") {
      const spans: { label: string; count: number; color: string }[] = [];
      let current: RegionGroup | null = null;
      let count = 0;
      for (const o of visibleOutlets) {
        if (o.region !== current) {
          if (current !== null && count > 0)
            spans.push({ label: current, count, color: REGION_GROUP_COLORS[current] });
          current = o.region;
          count = 1;
        } else count++;
      }
      if (current !== null && count > 0)
        spans.push({ label: current, count, color: REGION_GROUP_COLORS[current] });
      return spans;
    }
    const spans: { label: string; count: number; color: string }[] = [];
    let current: BiasGroup | null = null;
    let count = 0;
    for (const o of visibleOutlets) {
      if (o.group !== current) {
        if (current !== null && count > 0)
          spans.push({ label: current.toUpperCase(), count, color: BIAS_GROUP_COLORS[current] });
        current = o.group;
        count = 1;
      } else count++;
    }
    if (current !== null && count > 0)
      spans.push({ label: current!.toUpperCase(), count, color: BIAS_GROUP_COLORS[current!] });
    return spans;
  }, [visibleOutlets, tableView]);

  // --- Grouped columns (for bias/region grouped views) ---
  type GroupedColumn = { key: string; label: string; color: string; domains: string[] };
  const groupedColumns = useMemo((): GroupedColumn[] | null => {
    if (tableView === "bias") {
      return BIAS_GROUPS.map((g) => ({
        key: g,
        label: g.toUpperCase(),
        color: BIAS_GROUP_COLORS[g],
        domains: outletsByBias[g]
          .filter((o) => clusterOutletDomains.has(o.outletDomain))
          .map((o) => o.outletDomain),
      })).filter((c) => c.domains.length > 0);
    }
    if (tableView === "region") {
      return REGION_GROUPS.map((r) => ({
        key: r,
        label: r,
        color: REGION_GROUP_COLORS[r],
        domains: outletsByRegion[r]
          .filter((o) => clusterOutletDomains.has(o.outletDomain))
          .map((o) => o.outletDomain),
      })).filter((c) => c.domains.length > 0);
    }
    return null;
  }, [tableView, outletsByBias, outletsByRegion, clusterOutletDomains]);

  // --- Build outlet breakdown lookup ---
  const outletBreakdownMap = useMemo(() => {
    if (!topic) return {} as Record<string, OutletBreakdown>;
    const m: Record<string, OutletBreakdown> = {};
    for (const o of topic.outletBreakdown) m[o.outletDomain] = o;
    return m;
  }, [topic]);

  // --- Cell click handler ---
  function handleCellClick(type: "outlet" | "bias" | "region", value: string) {
    setFilter((prev) => {
      // Toggle off if same filter is already active
      if (type === "outlet" && prev.outlet === value) return { ...prev, outlet: null };
      if (type === "bias" && prev.bias === value) return { ...prev, bias: null };
      if (type === "region" && prev.region === value) return { ...prev, region: null };
      // Set new filter, clearing the others (single dimension at a time)
      return { outlet: null, bias: null, region: null, piOnly: prev.piOnly, [type]: value };
    });
  }

  function clearFilter() {
    setFilter({ outlet: null, bias: null, region: null, piOnly: false });
  }

  const activeFilterLabel = filter.outlet
    ? shortName(filter.outlet)
    : filter.bias
      ? filter.bias
      : filter.region
        ? filter.region
        : null;

  // --- Keyboard: ESC to close ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // --- Compute PI counts per outlet from loaded articles ---
  const piByOutlet = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of articles) {
      const domain = a.outletDomain || "";
      if (a.isPublicInterest) m[domain] = (m[domain] || 0) + 1;
    }
    return m;
  }, [articles]);

  // --- Compute PI% ---
  const piPct = useMemo(() => {
    if (!topic || !topic.outletBreakdown.length) return null;
    // We don't have piCount on TopicDetail directly, but we can get it from articles
    // For now show from article data if loaded
    if (articles.length === 0) return null;
    const piCount = articles.filter((a) => a.isPublicInterest).length;
    return Math.round((piCount / articles.length) * 100);
  }, [topic, articles]);

  // --- Render ---

  if (loading) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14 }}>
          Loading...
        </div>
      </Overlay>
    );
  }

  if (error || !topic) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
          {error ?? "Topic not found."}
        </div>
      </Overlay>
    );
  }

  const outletCount = topic.outletBreakdown.length;

  return (
    <Overlay onClose={onClose}>
      {/* ═══ Cluster Inspector Header ═══ */}
      <div
        style={{
          background: "var(--surface-white)",
          borderBottom: "1px solid var(--border-light)",
          padding: "20px 24px 16px",
        }}
      >
        {/* Close + title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: 20,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              lineHeight: 1,
              flexShrink: 0,
              marginTop: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            title="Close (Esc)"
          >
            &#8592;
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text)",
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {topic.label}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 6,
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              {topic.category && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--brand)",
                    background: "var(--brand-bg)",
                    border: "1px solid var(--brand-border, rgba(156,106,96,0.3))",
                    padding: "1px 8px",
                    borderRadius: 10,
                    textTransform: "capitalize",
                  }}
                >
                  {cleanCategoryLabel(topic.category)}
                </span>
              )}
              <span>{topic.totalArticles} articles from {outletCount} sources</span>
              <span style={{ color: "var(--text-tertiary)" }}>
                {formatDateRange(topic.earliestPublished, topic.latestPublished)}
              </span>
            </div>
            {/* Stats row */}
            {piPct !== null && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
                  Public Interest:
                </span>{" "}
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                  {piPct}%
                </span>
              </div>
            )}
            {/* Skew meters */}
            <div
              style={{
                display: "flex",
                gap: 24,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <SkewMeter
                label="Political Skew"
                value={topic.polSkew}
                leftLabel="Left"
                rightLabel="Right"
                colorFn={polSkewColor}
              />
              <SkewMeter
                label="Geographic Skew"
                value={topic.geoSkew}
                leftLabel="Domestic"
                rightLabel="International"
                colorFn={geoSkewColor}
              />
            </div>
          </div>
        </div>

        {/* ═══ Heatmap Ribbon ═══ */}
        <div style={{ marginTop: 8 }}>
          {/* Table view selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginRight: 4 }}>
              Table view:
            </span>
            <select
              value={tableView}
              onChange={(e) => setTableView(e.target.value as TableView)}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <option value="outlets-bias">Outlets by Bias</option>
              <option value="outlets-region">Outlets by Region</option>
              <option value="bias">Grouped by Bias</option>
              <option value="region">Grouped by Region</option>
            </select>
          </div>

          {/* Single-row heatmap table */}
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-light)" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                tableLayout: "auto",
              }}
            >
              <thead>
                {/* Group header row */}
                <tr>
                  {groupedColumns
                    ? groupedColumns.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            padding: "4px 6px",
                            fontWeight: 700,
                            fontSize: 10,
                            color: col.color,
                            textAlign: "center",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            borderBottom: `2px solid ${col.color}`,
                            background: "var(--surface)",
                          }}
                        >
                          {col.label}
                        </th>
                      ))
                    : groupSpans.map((span) => (
                        <th
                          key={span.label}
                          colSpan={span.count}
                          style={{
                            padding: "4px 0",
                            fontWeight: 700,
                            fontSize: 10,
                            color: span.color,
                            textAlign: "center",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            borderBottom: `2px solid ${span.color}`,
                            background: "var(--surface)",
                          }}
                        >
                          {span.label}
                        </th>
                      ))}
                </tr>
                {/* Outlet names (only for per-outlet views) */}
                {!groupedColumns && (
                  <tr>
                    {visibleOutlets.map(({ domain }) => (
                      <th
                        key={domain}
                        style={{
                          padding: "3px 2px",
                          fontWeight: 500,
                          fontSize: 9,
                          color: "var(--text-tertiary)",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          background: "var(--surface)",
                          borderBottom: "1px solid var(--border-light)",
                        }}
                      >
                        {shortName(domain)}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                <tr>
                  {groupedColumns
                    ? groupedColumns.map((col) => {
                        let count = 0;
                        let piSum = 0;
                        for (const d of col.domains) {
                          const ob = outletBreakdownMap[d];
                          if (ob) {
                            count += Number(ob.articleCount) || 0;
                            piSum += piByOutlet[d] || 0;
                          }
                        }
                        const heat = getHeatStyle(count, piSum, isDark);
                        const isActive =
                          (tableView === "bias" && filter.bias === col.key) ||
                          (tableView === "region" && filter.region === col.key);
                        return (
                          <td
                            key={col.key}
                            onClick={() =>
                              handleCellClick(
                                tableView === "bias" ? "bias" : "region",
                                col.key,
                              )
                            }
                            style={{
                              background: heat.bg,
                              color: heat.fg,
                              textAlign: "center",
                              padding: "8px 6px",
                              fontSize: 13,
                              fontWeight: count >= 9 ? 700 : count > 0 ? 500 : 400,
                              fontVariantNumeric: "tabular-nums",
                              cursor: count > 0 ? "pointer" : "default",
                              outline: isActive ? "2px solid var(--brand)" : "none",
                              outlineOffset: "-1px",
                              borderRadius: 2,
                              transition: "all 0.1s",
                            }}
                          >
                            {count > 0 ? count : ""}
                          </td>
                        );
                      })
                    : visibleOutlets.map(({ domain }) => {
                        const ob = outletBreakdownMap[domain];
                        const count = ob ? Number(ob.articleCount) || 0 : 0;
                        const heat = getHeatStyle(count, piByOutlet[domain] || 0, isDark);
                        const isActive = filter.outlet === domain;
                        return (
                          <td
                            key={domain}
                            onClick={() => count > 0 && handleCellClick("outlet", domain)}
                            style={{
                              background: heat.bg,
                              color: heat.fg,
                              textAlign: "center",
                              padding: "8px 4px",
                              fontSize: 12,
                              fontWeight: count >= 9 ? 700 : count > 0 ? 500 : 400,
                              fontVariantNumeric: "tabular-nums",
                              cursor: count > 0 ? "pointer" : "default",
                              outline: isActive ? "2px solid var(--brand)" : "none",
                              outlineOffset: "-1px",
                              borderRadius: 2,
                              transition: "all 0.1s",
                              minWidth: 36,
                            }}
                          >
                            {count > 0 ? count : ""}
                          </td>
                        );
                      })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ Articles Section ═══ */}
      <div style={{ padding: "16px 24px 24px" }}>
        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Articles{articleTotal > 0 ? ` (${articleTotal})` : ""}
            </span>
            {activeFilterLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  background: "var(--brand-bg)",
                  color: "var(--brand)",
                  border: "1px solid var(--brand-border, rgba(156,106,96,0.3))",
                  padding: "2px 10px",
                  borderRadius: 12,
                  fontWeight: 500,
                }}
              >
                {activeFilterLabel}
                <button
                  onClick={clearFilter}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  &times;
                </button>
              </span>
            )}
          </div>
          {/* PI toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-secondary)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={filter.piOnly}
              onChange={(e) => setFilter((f) => ({ ...f, piOnly: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }}
            />
            Public Interest only
          </label>
        </div>

        {/* Article grid */}
        {articlesLoading && articles.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            Loading articles...
          </div>
        ) : articles.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            No articles match the current filter.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
              gap: 16,
            }}
          >
            {articles.map((article) => (
              <ArticleCard key={article.storyId} article={article} />
            ))}
          </div>
        )}

        {articleTotal > articles.length && (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            Showing {articles.length} of {articleTotal} articles
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Article card with optional image
// ---------------------------------------------------------------------------

function ArticleCard({ article }: { article: Article }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = article.image && !imgError;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-white)",
        border: "1px solid var(--border-light)",
        borderRadius: 8,
        overflow: "hidden",
        textDecoration: "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Image */}
      {hasImage && (
        <div
          style={{
            width: "100%",
            height: 160,
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <img
            src={article.image!}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}
      {/* Content */}
      <div style={{ padding: "10px 14px 12px" }}>
        {/* Source + badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {article.sourceName}
          </span>
          <BiasBadge label={article.compositeBiasLabel} />
          {article.isPublicInterest && <PIBadge />}
        </div>
        {/* Headline */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {article.headlineClean || article.title}
        </div>
        {/* Time */}
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          {relativeDate(article.publishedAt)}
        </div>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Overlay shell — full-viewport on all breakpoints
// ---------------------------------------------------------------------------

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Prevent body scroll when overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(45,43,40,0.4)",
          zIndex: 100,
        }}
      />
      {/* Content panel */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
          display: "flex",
          justifyContent: "center",
          overflowY: "auto",
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 960,
            background: "var(--surface)",
            boxShadow: "0 0 40px rgba(0,0,0,0.15)",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
