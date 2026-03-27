import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchTopic, fetchTopicArticles } from "../api/client";
import type { TopicDetail, Article, OutletBreakdown } from "../api/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerpColor(c1: string, c2: string, t: number): string {
  const h = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = h(c1);
  const [r2, g2, b2] = h(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

function polSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#4A7EC9", "#4A4A4A", v + 1);  // Blue for left (negative)
  return lerpColor("#4A4A4A", "#C94A4A", v);                   // Red for right (positive)
}

function geoSkewColor(val: number): string {
  const v = Math.max(-1, Math.min(1, val));
  if (v < 0) return lerpColor("#3A9A5C", "#4A4A4A", v + 1);
  return lerpColor("#4A4A4A", "#4A7EC9", v);
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(earliest: string, latest: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(earliest)} - ${fmt(latest)}`;
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
        fontSize: "11px",
        fontWeight: 500,
        color: "#fff",
        background: biasColor(label),
        padding: "1px 8px",
        borderRadius: "10px",
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
        fontSize: "10px",
        fontWeight: 600,
        color: "var(--accent, #7C8578)",
        background: "var(--accent-bg, rgba(124,133,120,0.10))",
        border: "1px solid var(--accent-border, rgba(124,133,120,0.3))",
        padding: "1px 6px",
        borderRadius: "10px",
        whiteSpace: "nowrap",
      }}
    >
      Public Interest
    </span>
  );
}

function SkewBar({
  label,
  value,
  leftLabel,
  rightLabel,
  colorFn,
}: {
  label: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
  colorFn: (v: number) => string;
}) {
  const v = Number(value) || 0;
  const clamped = Math.max(-1, Math.min(1, v));
  const pct = ((clamped + 1) / 2) * 100;
  const dotColor = colorFn(v);

  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "var(--text-secondary, #6B6560)",
          marginBottom: "4px",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 500, color: dotColor }}>
          {v >= 0 ? "+" : ""}{v.toFixed(2)}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: "8px",
          borderRadius: "4px",
          background: "var(--surface, #F0EDE8)",
          overflow: "visible",
        }}
      >
        {/* Center tick */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "-2px",
            width: "1px",
            height: "12px",
            background: "var(--border, #DDD7CE)",
          }}
        />
        {/* Indicator dot */}
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: dotColor,
            border: "2px solid var(--surface-white, #fff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--text-tertiary, #9B958E)",
          marginTop: "2px",
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function OutletRow({ outlet }: { outlet: OutletBreakdown }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 0",
        borderBottom: "1px solid var(--border-light, #E8E3DB)",
      }}
    >
      <BiasBadge label={outlet.compositeBiasLabel} />
      <span
        style={{
          flex: 1,
          fontSize: "13px",
          color: "var(--text, #2D2B28)",
          fontWeight: 500,
        }}
      >
        {outlet.sourceName}
      </span>
      <span
        style={{
          fontSize: "12px",
          color: "var(--text-secondary, #6B6560)",
          minWidth: "60px",
          textAlign: "right",
        }}
      >
        {outlet.articleCount} article{outlet.articleCount === 1 ? "" : "s"}
      </span>
      {/* Small bar indicating relative count */}
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid var(--border-light, #E8E3DB)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text, #2D2B28)",
              textDecoration: "none",
              lineHeight: 1.4,
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.color = "var(--link-hover, #9C6A60)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.color = "var(--text, #2D2B28)")
            }
          >
            {article.headlineClean || article.title}
            <span
              style={{
                display: "inline-block",
                marginLeft: "4px",
                fontSize: "11px",
                opacity: 0.5,
              }}
            >
              &#x2197;
            </span>
          </a>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-secondary, #6B6560)",
              }}
            >
              {article.sourceName}
            </span>
            <BiasBadge label={article.compositeBiasLabel} />
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-tertiary, #9B958E)",
              }}
            >
              {relativeDate(article.publishedAt)}
            </span>
            {article.isPublicInterest && <PIBadge />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bias label sort order for outlet breakdown
// ---------------------------------------------------------------------------

const BIAS_ORDER: Record<string, number> = {
  Left: 0,
  "Lean Left": 1,
  Center: 2,
  "Lean Right": 3,
  Right: 4,
};

function biasSort(a: OutletBreakdown, b: OutletBreakdown): number {
  const aOrder = BIAS_ORDER[a.compositeBiasLabel] ?? 2;
  const bOrder = BIAS_ORDER[b.compositeBiasLabel] ?? 2;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return b.articleCount - a.articleCount;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [topicData, articlesData] = await Promise.all([
          fetchTopic(id!),
          fetchTopicArticles(id!, { limit: 50 }),
        ]);
        if (cancelled) return;
        setTopic(topicData);
        setArticles(articlesData.data);
        setArticleTotal(articlesData.meta.total);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("404")) {
          setError("Topic not found.");
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---- Loading state ----
  if (loading) {
    return (
      <PageShell>
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            color: "var(--text-tertiary, #9B958E)",
            fontSize: "14px",
          }}
        >
          Loading topic...
        </div>
      </PageShell>
    );
  }

  // ---- Error / 404 state ----
  if (error || !topic) {
    return (
      <PageShell>
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            color: "var(--text-secondary, #6B6560)",
            fontSize: "14px",
          }}
        >
          {error ?? "Topic not found."}
        </div>
      </PageShell>
    );
  }

  const sortedOutlets = [...topic.outletBreakdown].sort(biasSort);
  const outletCount = topic.outletBreakdown.length;

  return (
    <PageShell>
      {/* ---- Topic Header ---- */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text, #2D2B28)",
            lineHeight: 1.3,
            margin: "0 0 8px 0",
          }}
        >
          {topic.label}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {/* Category tag */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--brand, #9C6A60)",
              background: "var(--brand-bg, rgba(156,106,96,0.08))",
              border: "1px solid var(--brand-border, rgba(156,106,96,0.3))",
              padding: "2px 8px",
              borderRadius: "10px",
              textTransform: "capitalize",
            }}
          >
            {topic.category}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-secondary, #6B6560)",
            }}
          >
            {topic.totalArticles} article{topic.totalArticles === 1 ? "" : "s"}{" "}
            from {outletCount} source{outletCount === 1 ? "" : "s"}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary, #9B958E)",
            }}
          >
            {formatDateRange(topic.earliestPublished, topic.latestPublished)}
          </span>
        </div>

        {/* Spectrum summary: L / C / R counts */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "12px",
            fontSize: "12px",
          }}
        >
          <span style={{ color: polSkewColor(-1) }}>
            Left: {topic.leftCount}
          </span>
          <span style={{ color: "var(--text-tertiary, #9B958E)" }}>
            Center: {topic.centerCount}
          </span>
          <span style={{ color: polSkewColor(1) }}>
            Right: {topic.rightCount}
          </span>
        </div>
      </div>

      {/* ---- Asymmetry Indicators ---- */}
      <Section title="Asymmetry">
        <SkewBar
          label="Political Skew"
          value={topic.polSkew}
          leftLabel="Left"
          rightLabel="Right"
          colorFn={polSkewColor}
        />
        <SkewBar
          label="Geographic Skew"
          value={topic.geoSkew}
          leftLabel="International"
          rightLabel="Domestic"
          colorFn={geoSkewColor}
        />
      </Section>

      {/* ---- Outlet Breakdown ---- */}
      <Section title={`Outlet Breakdown (${outletCount})`}>
        {/* Mini stacked bar */}
        {topic.totalArticles > 0 && (
          <div
            style={{
              display: "flex",
              height: "6px",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            {sortedOutlets.map((o) => (
              <div
                key={o.outletDomain}
                title={`${o.sourceName}: ${o.articleCount}`}
                style={{
                  flex: o.articleCount,
                  background: biasColor(o.compositeBiasLabel),
                  minWidth: "2px",
                }}
              />
            ))}
          </div>
        )}
        <div>
          {sortedOutlets.map((o) => (
            <OutletRow key={o.outletDomain} outlet={o} />
          ))}
        </div>
      </Section>

      {/* ---- Article List ---- */}
      <Section
        title={`Articles${articleTotal > 0 ? ` (${articleTotal})` : ""}`}
      >
        {articles.length === 0 ? (
          <div
            style={{
              padding: "16px 0",
              fontSize: "13px",
              color: "var(--text-tertiary, #9B958E)",
            }}
          >
            No articles found for this topic.
          </div>
        ) : (
          <>
            {articles.map((a) => (
              <ArticleCard key={a.storyId} article={a} />
            ))}
            {articleTotal > articles.length && (
              <div
                style={{
                  padding: "12px 0",
                  fontSize: "12px",
                  color: "var(--text-tertiary, #9B958E)",
                  textAlign: "center",
                }}
              >
                Showing {articles.length} of {articleTotal} articles
              </div>
            )}
          </>
        )}
      </Section>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Layout wrappers
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "16px",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "13px",
          color: "var(--text-secondary, #6B6560)",
          textDecoration: "none",
          marginBottom: "16px",
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.color = "var(--link-hover, #9C6A60)")
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.color =
            "var(--text-secondary, #6B6560)")
        }
      >
        &#8592; Back to Coverage
      </Link>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-white, #fff)",
        border: "1px solid var(--border, #DDD7CE)",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <h2
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-secondary, #6B6560)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: "0 0 12px 0",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
