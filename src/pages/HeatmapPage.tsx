import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHeatmap, fetchHeatmapSummary } from "../api/client";
import type { HeatmapRow, HeatmapSummary, HeatmapCell } from "../api/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BIAS_GROUPS = ["Left", "Lean Left", "Center", "Lean Right", "Right"] as const;
type BiasGroup = (typeof BIAS_GROUPS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countByBias(cells: Record<string, HeatmapCell>): Record<BiasGroup, number> {
  const counts: Record<BiasGroup, number> = {
    Left: 0,
    "Lean Left": 0,
    Center: 0,
    "Lean Right": 0,
    Right: 0,
  };
  for (const cell of Object.values(cells)) {
    const label = cell.compositeBiasLabel as BiasGroup;
    if (label in counts) {
      counts[label] += cell.articleCount;
    }
  }
  return counts;
}

function heatLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count <= 5) return 4;
  if (count <= 8) return 5;
  if (count <= 12) return 6;
  return 7;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "unknown";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeatCell({ count }: { count: number }) {
  const level = heatLevel(count);
  return (
    <td
      style={{
        background: `var(--heat-${level}-bg)`,
        color: `var(--heat-${level}-fg)`,
        textAlign: "center",
        padding: "6px 8px",
        fontSize: "13px",
        fontWeight: count > 0 ? 600 : 400,
        fontVariantNumeric: "tabular-nums",
        minWidth: 48,
      }}
    >
      {count > 0 ? count : ""}
    </td>
  );
}

function SkewBadge({ skew }: { skew: number }) {
  if (skew === 0) return null;
  const isLeft = skew < 0;
  const arrow = isLeft ? "\u2190" : "\u2192";
  const color = isLeft ? "var(--gap-left)" : "var(--gap-right)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: "11px",
        fontWeight: 600,
        color,
        background: isLeft
          ? "rgba(91,127,166,0.10)"
          : "rgba(184,106,90,0.10)",
        padding: "1px 7px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      {arrow} {Math.abs(skew).toFixed(2)}
    </span>
  );
}

function FilterChips({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string | null;
  onSelect: (cat: string | null) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8,
      }}
    >
      <button
        onClick={() => onSelect(null)}
        style={{
          padding: "4px 12px",
          fontSize: "12px",
          fontWeight: 500,
          border: `1px solid ${active === null ? "var(--brand-border)" : "var(--border)"}`,
          borderRadius: 16,
          background: active === null ? "var(--brand-bg)" : "var(--surface)",
          color: active === null ? "var(--brand)" : "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(active === cat ? null : cat)}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 500,
            border: `1px solid ${active === cat ? "var(--brand-border)" : "var(--border)"}`,
            borderRadius: 16,
            background: active === cat ? "var(--brand-bg)" : "var(--surface)",
            color: active === cat ? "var(--brand)" : "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function HeatmapPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (category: string | null, q: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const opts: Parameters<typeof fetchHeatmap>[0] = {};
      if (category) opts.category = category;
      if (q) opts.q = q;
      const [heatmap, sum] = await Promise.all([
        fetchHeatmap(Object.keys(opts).length > 0 ? opts : undefined),
        fetchHeatmapSummary(),
      ]);
      setRows(heatmap.data);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeCategory, activeSearch);
  }, [activeCategory, activeSearch, load]);

  const handleCategorySelect = (cat: string | null) => {
    setActiveCategory(cat);
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    setActiveSearch(q || null);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearch(null);
  };

  // --- Loading state ---
  if (loading && rows.length === 0) {
    return (
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: 16,
        }}
      >
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 14,
          }}
        >
          Loading heatmap...
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && rows.length === 0) {
    return (
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: 16,
        }}
      >
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--gap-right)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics..."
          style={{
            flex: 1,
            maxWidth: 360,
            padding: "7px 12px",
            fontSize: 14,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface-white)",
            color: "var(--text)",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--brand-border)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--focus-ring)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="submit"
          style={{
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--brand-border)",
            borderRadius: 6,
            background: "var(--brand-bg)",
            color: "var(--brand)",
            cursor: "pointer",
          }}
        >
          Search
        </button>
        {activeSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            style={{
              padding: "7px 12px",
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Summary bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {summary?.totalTopics ?? 0} topics
          </span>{" "}
          across{" "}
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {summary?.totalArticles ?? 0} articles
          </span>
          {summary?.lastRefreshed && (
            <>
              {" "}
              &middot; Last updated{" "}
              <span style={{ color: "var(--text-tertiary)" }}>
                {timeAgo(summary.lastRefreshed)}
              </span>
            </>
          )}
          {activeSearch && (
            <>
              {" "}
              &middot; Showing{" "}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {rows.length} topics
              </span>{" "}
              matching{" "}
              <span style={{ fontWeight: 600, color: "var(--brand)" }}>
                &ldquo;{activeSearch}&rdquo;
              </span>
            </>
          )}
          {loading && (
            <span style={{ marginLeft: 8, color: "var(--text-tertiary)" }}>
              Refreshing...
            </span>
          )}
        </div>

        {summary && summary.categories.length > 0 && (
          <FilterChips
            categories={summary.categories}
            active={activeCategory}
            onSelect={handleCategorySelect}
          />
        )}
      </div>

      {/* Heatmap table */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--surface-white)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Topic
                </th>
                {BIAS_GROUPS.map((bg) => (
                  <th
                    key={bg}
                    style={{
                      textAlign: "center",
                      padding: "8px 8px",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      minWidth: 48,
                    }}
                  >
                    {bg}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: "center",
                    padding: "8px 8px",
                    fontWeight: 600,
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    minWidth: 48,
                  }}
                >
                  Skew
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={BIAS_GROUPS.length + 2}
                    style={{
                      padding: 32,
                      textAlign: "center",
                      color: "var(--text-tertiary)",
                      fontSize: 14,
                    }}
                  >
                    No topics found
                    {activeSearch ? ` matching "${activeSearch}"` : ""}
                    {activeCategory ? ` in "${activeCategory}"` : ""}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const biasCounts = countByBias(row.cells);
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
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--row-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        maxWidth: 360,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 500,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                          marginTop: 1,
                        }}
                      >
                        {row.totalArticles} articles
                        {row.category && (
                          <>
                            {" "}
                            &middot;{" "}
                            <span style={{ color: "var(--text-secondary)" }}>
                              {row.category}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    {BIAS_GROUPS.map((bg) => (
                      <HeatCell key={bg} count={biasCounts[bg]} />
                    ))}
                    <td style={{ textAlign: "center", padding: "8px 8px" }}>
                      <SkewBadge skew={row.polSkew} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
