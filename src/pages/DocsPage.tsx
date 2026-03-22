import React, { useState, useEffect, useRef, type CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Section definitions                                                */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  label: string;
  group: string;
}

const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", group: "How It Works" },
  { id: "collecting-news", label: "Aggregating the News", group: "How It Works" },
  { id: "public-interest", label: "Evaluating Public Interest", group: "How It Works" },
  { id: "anomaly-detection", label: "Detecting Anomalies", group: "How It Works" },
  { id: "concept-topics", label: "Stories & Clusters", group: "Key Concepts" },
  { id: "concept-pi", label: "Public Interest", group: "Key Concepts" },
  { id: "concept-coverage", label: "Coverage Asymmetry", group: "Key Concepts" },
  { id: "concept-anomalies", label: "Anomalies", group: "Key Concepts" },
  { id: "sources", label: "Sources", group: "Reference" },
  { id: "methodology", label: "Methodology", group: "Reference" },
];

const GROUPS = ["How It Works", "Key Concepts", "Reference"];

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = {
  wrapper: {
    display: "flex",
    minHeight: "calc(100vh - 56px)",
    background: "var(--bg)",
    color: "var(--text)",
  } satisfies CSSProperties,

  /* Sidebar */
  sidebar: {
    width: 240,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    padding: "24px 0",
    position: "sticky",
    top: 56,
    height: "calc(100vh - 56px)",
    overflowY: "auto",
  } satisfies CSSProperties,
  sidebarGroup: {
    padding: "0 16px",
    marginBottom: 20,
  } satisfies CSSProperties,
  sidebarHeading: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--text-tertiary)",
    marginBottom: 6,
  } satisfies CSSProperties,
  sidebarLink: (active: boolean): CSSProperties => ({
    display: "block",
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--brand)" : "var(--text-secondary)",
    background: active ? "var(--brand-bg)" : "transparent",
    textDecoration: "none",
    cursor: "pointer",
    lineHeight: 1.4,
  }),

  /* Mobile nav */
  mobileNav: {
    display: "none",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
  } satisfies CSSProperties,
  mobileSelect: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
  } satisfies CSSProperties,

  /* Main content */
  main: {
    flex: 1,
    maxWidth: 800,
    padding: "32px 40px 80px",
  } satisfies CSSProperties,

  h1: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--text)",
    letterSpacing: "-0.01em",
  } satisfies CSSProperties,
  subtitle: {
    fontSize: 15,
    color: "var(--text-secondary)",
    marginBottom: 28,
    lineHeight: 1.6,
  } satisfies CSSProperties,
  h2: {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 32,
    marginBottom: 12,
    color: "var(--text)",
  } satisfies CSSProperties,
  h3: {
    fontSize: 16,
    fontWeight: 600,
    marginTop: 20,
    marginBottom: 8,
    color: "var(--text)",
  } satisfies CSSProperties,
  p: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    marginBottom: 14,
  } satisfies CSSProperties,
  ol: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    marginBottom: 14,
    paddingLeft: 20,
  } satisfies CSSProperties,
  ul: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    marginBottom: 14,
    paddingLeft: 20,
  } satisfies CSSProperties,
  callout: {
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid var(--brand-border)",
    background: "var(--brand-bg)",
    marginBottom: 20,
    marginTop: 16,
  } satisfies CSSProperties,
  calloutLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--brand)",
    marginBottom: 4,
  } satisfies CSSProperties,
  calloutBody: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  code: {
    fontSize: 12,
    fontFamily: "monospace",
    background: "var(--surface)",
    padding: "2px 5px",
    borderRadius: 4,
    color: "var(--text)",
  } satisfies CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    marginBottom: 20,
  } satisfies CSSProperties,
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    borderBottom: "2px solid var(--border)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--text-tertiary)",
  } satisfies CSSProperties,
  td: {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text-secondary)",
    verticalAlign: "top" as const,
  } satisfies CSSProperties,
  tag: (color: string): CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    background: "var(--tag-bg)",
    border: "1px solid var(--tag-border)",
    color,
  }),
  criteriaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  } satisfies CSSProperties,
  criteriaCard: {
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
  } satisfies CSSProperties,
  criteriaNum: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "var(--brand)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    marginRight: 6,
  } satisfies CSSProperties,
  formula: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "var(--brand)",
    padding: "8px 12px",
    background: "var(--surface)",
    borderRadius: 6,
    border: "1px solid var(--border)",
    marginBottom: 10,
    display: "inline-block",
  } satisfies CSSProperties,
  gateRule: {
    fontFamily: "monospace",
    fontSize: 13,
    padding: "14px 16px",
    background: "var(--surface)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    marginBottom: 20,
    lineHeight: 1.8,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  detectorCard: {
    padding: "16px 18px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    marginBottom: 14,
  } satisfies CSSProperties,
  groupSection: {
    marginBottom: 16,
  } satisfies CSSProperties,
  groupHeader: (color: string): CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color,
    marginBottom: 6,
  }),
  groupOutlets: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  } satisfies CSSProperties,
  groupOutlet: {
    padding: "3px 10px",
    borderRadius: 4,
    fontSize: 12,
    background: "var(--tag-bg)",
    border: "1px solid var(--tag-border)",
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  groupingTabs: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  } satisfies CSSProperties,
  groupingTab: (active: boolean): CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? "var(--brand-bg)" : "var(--surface)",
    color: active ? "var(--brand)" : "var(--text-secondary)",
    border: active ? "1px solid var(--brand-border)" : "1px solid var(--border)",
    cursor: "pointer",
    fontFamily: "inherit",
  }),
  details: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    marginBottom: 12,
    overflow: "hidden",
  } satisfies CSSProperties,
  summary: {
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    background: "var(--surface)",
    color: "var(--text)",
  } satisfies CSSProperties,
  detailsContent: {
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  sectionDivider: {
    borderTop: "1px solid var(--border-light)",
    margin: "40px 0",
  } satisfies CSSProperties,
  footer: {
    fontSize: 12,
    color: "var(--text-tertiary)",
    paddingTop: 32,
    borderTop: "1px solid var(--border-light)",
    marginTop: 48,
  } satisfies CSSProperties,
  sourcesTableWrap: {
    overflowX: "auto" as const,
    marginBottom: 20,
  } satisfies CSSProperties,
  sourceNote: {
    fontSize: 12,
    color: "var(--text-tertiary)",
    marginTop: 6,
  } satisfies CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Callout helper                                                     */
/* ------------------------------------------------------------------ */

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.callout}>
      <div style={s.calloutLabel}>{label}</div>
      <div style={s.calloutBody}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section content components                                         */
/* ------------------------------------------------------------------ */

function OverviewSection() {
  return (
    <section id="overview">
      <h1 style={s.h1}>Overview</h1>
      <p style={s.subtitle}>
        media.games surfaces what the media isn't telling you and what it's distracting you with
        — by detecting omissions in coverage of stories that matter and saturation of stories that don't.
      </p>

      <h2 style={s.h2}>What is media.games?</h2>
      <p style={s.p}>
        media.games is a platform that monitors news coverage across dozens of major sources to surface{" "}
        <strong>what the media is and isn't covering</strong>. We don't fact-check. We don't rate bias.
        We observe coverage patterns in aggregate and detect anomalies — stories that are being
        ignored, amplified, or covered in surprising ways.
      </p>
      <p style={s.p}>The platform works in three stages:</p>
      <ol style={s.ol}>
        <li><strong>Collect</strong> — We ingest articles from 28 global news sources and group them into stories.</li>
        <li><strong>Evaluate</strong> — Each story is assessed against transparent, auditable public interest criteria using an LLM-based evaluator.</li>
        <li><strong>Detect</strong> — We compare coverage patterns across sources to identify anomalies — gaps, amplifications, and distortions.</li>
      </ol>

      <Callout label="Our principle">
        We focus on <em>systems, not individuals</em>. The platform prioritizes institutional behavior
        over individual incidents. This avoids distortion from cherry-picked crime stories,
        culture-war outrage content, and celebrity controversies.
      </Callout>
    </section>
  );
}

function CollectingNewsSection() {
  return (
    <section id="collecting-news">
      <h1 style={s.h1}>Aggregating the News</h1>
      <p style={s.subtitle}>
        From raw articles to organized stories — how data flows through the platform.
      </p>

      <h2 style={s.h2}>Sources</h2>
      <p style={s.p}>
        We collect articles from <strong>28 news sources</strong> spanning US domestic, international,
        left-leaning, right-leaning, and centrist perspectives. The full list is available on the Sources page.
      </p>
      <p style={s.p}>
        Articles are ingested continuously via NewsAPI.ai, which provides headline, snippet, body text,
        source, and publication time for each article.
      </p>

      <h2 style={s.h2}>Scope</h2>
      <p style={s.p}>
        Not every article enters the pipeline. We filter to <strong>in-scope</strong> content:
        articles covering politics, business, health, environment, science, technology, and general news.
        Sports, entertainment, and lifestyle content is classified as out-of-scope.
      </p>

      <h2 style={s.h2}>How Stories Are Grouped</h2>
      <p style={s.p}>
        A single news event is typically covered by many sources. Rather than treating each article
        independently, we group articles about the same event into a <strong>cluster</strong>.
      </p>
      <p style={s.p}>
        Clustering works by converting each article's text into a numerical representation
        (an embedding) and grouping articles whose representations are highly similar.
        This lets us see the same story across many sources simultaneously.
      </p>

      <Callout label="Why this matters">
        Clustering is what makes anomaly detection possible. Without it, we'd just have a list of articles.
        With it, we can ask: "Which sources covered this story? Which didn't? How much attention did
        each give it?"
      </Callout>
    </section>
  );
}

function PublicInterestEvalSection() {
  return (
    <section id="public-interest">
      <h1 style={s.h1}>Evaluating Public Interest</h1>
      <p style={s.subtitle}>
        How we determine whether a story matters to the public — transparently and reproducibly.
      </p>

      <h2 style={s.h2}>Why evaluate public interest?</h2>
      <p style={s.p}>
        To detect anomalies in coverage, we need a consistent way to distinguish stories that matter
        from noise. A celebrity breakup getting 200 articles isn't an anomaly — it's entertainment.
        A regulatory change affecting millions getting 3 articles might be.
      </p>
      <p style={s.p}>
        We use an LLM-based evaluator that assesses each story against four binary criteria.
        The evaluation is deterministic, reproducible, and auditable — the prompt is versioned,
        the model is recorded, and every result is stored.
      </p>

      <h2 style={s.h2}>The Four Criteria</h2>
      <div style={s.criteriaGrid}>
        <div style={s.criteriaCard}>
          <h4 style={s.h3}><span style={s.criteriaNum}>1</span> Real-Life Impact</h4>
          <p style={{ ...s.p, marginBottom: 0 }}>Does the story describe events that materially affect people's safety, health, economic conditions, civil rights, or security?</p>
        </div>
        <div style={s.criteriaCard}>
          <h4 style={s.h3}><span style={s.criteriaNum}>2</span> Institutional Involvement</h4>
          <p style={{ ...s.p, marginBottom: 0 }}>Does the story focus on actions or decisions by governments, courts, regulators, legislatures, large corporations, or security forces?</p>
        </div>
        <div style={s.criteriaCard}>
          <h4 style={s.h3}><span style={s.criteriaNum}>3</span> Widespread Impact</h4>
          <p style={{ ...s.p, marginBottom: 0 }}>Does the issue affect large populations or systems, rather than a small number of individuals?</p>
        </div>
        <div style={s.criteriaCard}>
          <h4 style={s.h3}><span style={s.criteriaNum}>4</span> New Information</h4>
          <p style={{ ...s.p, marginBottom: 0 }}>Does the story report a new development, decision, event, or verified fact not previously publicly reported?</p>
        </div>
      </div>

      <h2 style={s.h2}>The Gate Rule</h2>
      <p style={s.p}>
        A story qualifies as public interest when it meets <strong>at least 3 of the 4 criteria</strong>,
        and at least one of those must be an <em>anchor criterion</em> — either Real-Life Impact or
        Institutional Involvement.
      </p>
      <div style={s.gateRule}>
        <span style={{ color: "var(--text-tertiary)" }}>// A story qualifies as public interest when:</span><br />
        <span style={{ color: "var(--brand)" }}>criteria_met</span> {">="} <span style={{ color: "var(--accent)" }}>3</span><br />
        AND (<span style={{ color: "var(--brand)" }}>real_world_impact</span> = <span style={{ color: "var(--accent)" }}>true</span> OR{" "}
        <span style={{ color: "var(--brand)" }}>institutional_action</span> = <span style={{ color: "var(--accent)" }}>true</span>)
      </div>

      <h2 style={s.h2}>Public Interest Classifications</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Label</th>
            <th style={s.th}>Criteria Met</th>
            <th style={s.th}>Public Interest?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td}><span style={s.tag("var(--gap-left)")}>High</span></td>
            <td style={s.td}>4 of 4</td>
            <td style={s.td}>Yes</td>
          </tr>
          <tr>
            <td style={s.td}><span style={s.tag("var(--brand)")}>Moderate</span></td>
            <td style={s.td}>3 of 4 (with anchor)</td>
            <td style={s.td}>Yes</td>
          </tr>
          <tr>
            <td style={s.td}><span style={s.tag("var(--text-tertiary)")}>Low</span></td>
            <td style={s.td}>2 of 4</td>
            <td style={s.td}>No</td>
          </tr>
          <tr>
            <td style={s.td}><span style={s.tag("var(--gap-right)")}>Not Public Interest</span></td>
            <td style={s.td}>0-1 of 4</td>
            <td style={s.td}>No</td>
          </tr>
        </tbody>
      </table>

      <Callout label="Transparency">
        Every evaluation stores the full reasoning, the prompt version used, and the model version.
        This means any result can be audited or re-evaluated.
      </Callout>

      <h2 style={s.h2}>Geographic Relevance Classifications</h2>
      <p style={s.p}>
        In addition to public interest, each story is tagged with <strong>geographic relevance</strong> —
        a set of independent boolean flags evaluated by the same LLM alongside the four PI criteria.
        These flags are <strong>independent of the PI gate rule</strong> — a story can be nationally
        relevant without being public interest, and vice versa.
      </p>

      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Flag</th><th style={s.th}>Evaluates</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td}><code style={s.code}>global_relevance</code></td>
            <td style={s.td}>Does the story affect multiple countries, international systems, or have consequences beyond any single nation's borders?</td>
          </tr>
          <tr>
            <td style={s.td}><code style={s.code}>US_relevance</code></td>
            <td style={s.td}>Does the story directly affect U.S. governance, economy, security, or population, or involve U.S. institutions or citizens?</td>
          </tr>
          <tr>
            <td style={s.td}><code style={s.code}>state_local_relevance</code></td>
            <td style={s.td}>Does the story primarily affect a specific U.S. state, city, or locality rather than the nation as a whole?</td>
          </tr>
        </tbody>
      </table>

      <Callout label="Why geographic relevance?">
        The public interest evaluation has no geographic dimension. Without these flags,
        foreign-only stories (e.g. UK local politics) that score high on PI would distort
        anomaly detection — particularly detectors like Domestic Blindspot
        that specifically look for gaps in US coverage. Geographic relevance lets us
        distinguish globally-relevant PI from US-specific PI from locally-scoped stories.
      </Callout>
    </section>
  );
}

function AnomalyDetectionSection() {
  return (
    <section id="anomaly-detection">
      <h1 style={s.h1}>Detecting Anomalies</h1>
      <p style={s.subtitle}>
        Surfacing the stories the media is missing, amplifying, or covering in surprising patterns.
      </p>

      <h2 style={s.h2}>What is an anomaly?</h2>
      <p style={s.p}>
        An anomaly is a pattern in news coverage that deviates from what you'd expect.
        High public interest stories that barely get covered. Low-value stories that dominate the news cycle.
        Stories covered heavily by international sources but ignored domestically.
      </p>
      <p style={s.p}>
        media.games uses a growing library of <strong>anomaly detectors</strong> — each one looks for a
        specific type of coverage pattern. When a detector fires, it surfaces the story along with the
        evidence: which sources covered it, how many articles, and what the public interest score was.
      </p>
      <p style={s.p}>
        For the full list of detectors and their definitions, see the Anomalies section under Key Concepts.
      </p>

      <Callout label="Growing over time">
        The anomaly detection system is designed to be extensible. New detectors will be added as we
        identify additional coverage patterns worth surfacing.
      </Callout>
    </section>
  );
}

function ConceptTopicsSection() {
  return (
    <section id="concept-topics">
      <h1 style={s.h1}>Stories &amp; Clusters</h1>
      <p style={s.subtitle}>
        On media.games, a "story" isn't a single article — it's a cluster of articles about the same event.
      </p>

      <h2 style={s.h2}>How it works</h2>
      <p style={s.p}>
        When multiple sources report on the same event, their articles are grouped into a{" "}
        <strong>cluster</strong>. Each cluster represents one real-world story and contains
        every article covering it, regardless of source.
      </p>

      <h2 style={s.h2}>Why it matters</h2>
      <p style={s.p}>
        Clustering is what makes it possible to compare coverage across sources. It lets us answer
        questions like: "Did Fox News cover this story? How about the BBC? How many articles did
        each publish?"
      </p>

      <h2 style={s.h2}>Cluster size</h2>
      <p style={s.p}>
        The <strong>cluster size</strong> is the total number of articles grouped into a topic.
        A cluster with 150 articles is a major story getting broad coverage.
        A cluster with 3 articles is a niche story — or a potential omission.
      </p>
    </section>
  );
}

function ConceptPISection() {
  return (
    <section id="concept-pi">
      <h1 style={s.h1}>Public Interest</h1>
      <p style={s.subtitle}>
        A story is "public interest" if it helps the public understand how power is exercised,
        how institutions affect people's lives, or what new facts about those systems have emerged.
      </p>

      <h2 style={s.h2}>What qualifies</h2>
      <ul style={s.ul}>
        <li>War, economic shocks, public health crises, environmental disasters</li>
        <li>Court rulings, legislation, regulatory enforcement, institutional failures</li>
        <li>Major policy changes affecting large populations</li>
        <li>New evidence, documents, or investigative revelations</li>
      </ul>

      <h2 style={s.h2}>What doesn't qualify</h2>
      <ul style={s.ul}>
        <li>Celebrity activity, lifestyle, consumer products</li>
        <li>Random crime, interpersonal disputes</li>
        <li>Commentary that doesn't analyze real institutional actions</li>
        <li>Historical retrospectives (unless revealing new evidence)</li>
        <li>Reaction pieces or follow-ups repeating known facts</li>
      </ul>

      <p style={s.p}>
        For the full evaluation process, see the Evaluating Public Interest section.
      </p>
    </section>
  );
}

function ConceptCoverageSection() {
  return (
    <section id="concept-coverage">
      <h1 style={s.h1}>Coverage Asymmetry</h1>
      <p style={s.subtitle}>
        How we measure the attention a story receives — and where that attention is uneven.
      </p>

      <Callout label="Important">
        These metrics are <em>observations</em>, not judgments. Asymmetry doesn't mean anyone is right or
        wrong — it means coverage is uneven, which is worth noticing.
      </Callout>

      <h2 style={s.h2}>Metrics</h2>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Metric</th><th style={s.th}>Definition</th></tr>
        </thead>
        <tbody>
          <tr><td style={s.td}><code style={s.code}>article_count</code></td><td style={s.td}>Total articles about a story across all sources</td></tr>
          <tr><td style={s.td}><code style={s.code}>news_to_noise_ratio</code></td><td style={s.td}>Ratio of public interest articles to total articles (0.0 to 1.0). A high ratio means substantive coverage; a low ratio means filler.</td></tr>
          <tr><td style={s.td}><code style={s.code}>pol_skew</code></td><td style={s.td}>Political lean skew: <code style={s.code}>(left_count - right_count) / (left_count + right_count)</code>. Ranges from -1.0 (only right sources) to +1.0 (only left sources). Center sources are excluded.</td></tr>
          <tr><td style={s.td}><code style={s.code}>geo_skew</code></td><td style={s.td}>Geographic skew: <code style={s.code}>(us_count - nonus_count) / (us_count + nonus_count)</code>. Ranges from -1.0 (only non-US sources) to +1.0 (only US sources).</td></tr>
        </tbody>
      </table>

      <h2 style={s.h2}>Political Lean Skew</h2>
      <p style={s.p}>
        <code style={s.code}>pol_skew</code> measures whether a story is being covered asymmetrically along political lines.
        It compares article counts from left-leaning sources against right-leaning sources, excluding
        center sources from the calculation.
      </p>
      <p style={s.p}>
        A <code style={s.code}>pol_skew</code> near <strong>0</strong> means balanced coverage across the political spectrum.
        A value near <strong>+1.0</strong> means the story is being covered almost exclusively by left-leaning sources.
        A value near <strong>-1.0</strong> means almost exclusively by right-leaning sources.
        Large skew in either direction is interesting — it may indicate that the story is being
        emphasized or de-emphasized along political lines.
      </p>

      <h2 style={s.h2}>Geographic Skew</h2>
      <p style={s.p}>
        <code style={s.code}>geo_skew</code> measures whether a story is being covered asymmetrically between US and
        international sources.
      </p>
      <p style={s.p}>
        A value near <strong>+1.0</strong> means the story is covered almost exclusively by US sources.
        A value near <strong>-1.0</strong> means almost exclusively by non-US sources.
        Stories with extreme negative geo skew — high international coverage but low US coverage —
        may represent domestic blindspots.
      </p>

      <h2 style={s.h2}>News-to-Noise Ratio</h2>
      <p style={s.p}>
        The news-to-noise ratio indicates how much of a source's coverage of a story is substantive
        versus filler. A ratio of <strong>1.0</strong> means every article is public interest.
        A ratio of <strong>0.0</strong> means none are.
      </p>
    </section>
  );
}

function ConceptAnomaliesSection() {
  return (
    <section id="concept-anomalies">
      <h1 style={s.h1}>Anomalies</h1>
      <p style={s.subtitle}>
        Patterns in coverage that deviate from what you'd expect — and what each detector looks for.
      </p>

      <h2 style={s.h2}>What is an anomaly?</h2>
      <p style={s.p}>
        An anomaly is a pattern in news coverage that deviates from what you'd expect.
        High public interest stories that barely get covered. Low-value stories that dominate the news cycle.
        Stories covered heavily by international sources but ignored domestically.
      </p>
      <p style={s.p}>
        media.games uses a growing library of anomaly detectors — each one looks for a
        specific type of coverage pattern. When a detector fires, it surfaces the story along with the
        evidence: which sources covered it, how many articles, and what the public interest score was.
      </p>

      <h2 style={s.h2}>Detectors</h2>

      <div style={s.detectorCard}>
        <h3 style={s.h3}>Domestic Blindspot</h3>
        <div style={s.formula}>US story + public interest + zero US sources</div>
        <p style={{ ...s.p, marginBottom: 0 }}>
          A story that is relevant to the US public interest but is not being covered by any US-based
          source. Only international sources are reporting on it. This is the most extreme form of
          coverage gap — the audience most affected by the story has no domestic media covering it.
        </p>
      </div>

      <div style={s.detectorCard}>
        <h3 style={s.h3}>Omission</h3>
        <div style={s.formula}>high public interest + low coverage</div>
        <p style={{ ...s.p, marginBottom: 0 }}>
          A story that scores high on public interest criteria but has very few articles covering it
          across all sources. These are important stories that the media ecosystem is largely ignoring.
        </p>
      </div>

      <div style={s.detectorCard}>
        <h3 style={s.h3}>Distraction</h3>
        <div style={s.formula}>low public interest + high coverage</div>
        <p style={{ ...s.p, marginBottom: 0 }}>
          A story that does not meet public interest criteria but is receiving heavy coverage anyway.
          This pattern suggests media resources and audience attention are being consumed by stories
          with limited civic value.
        </p>
      </div>

      <div style={s.detectorCard}>
        <h3 style={s.h3}>Clusterbomb</h3>
        <div style={s.formula}>low PI story + high coverage + inside a high PI cluster</div>
        <p style={{ ...s.p, marginBottom: 0 }}>
          A low public interest story that surges in coverage within a cluster that otherwise
          contains high public interest content. This can dilute attention from the substantive
          stories in the same topic area — like a celebrity trial drowning out coverage of
          judicial reform in the same "courts" cluster.
        </p>
      </div>

      <Callout label="Extensible">
        This is the initial set of detectors. New detectors will be added over time as we
        identify additional coverage patterns worth monitoring. Each will be documented here
        with its definition and detection logic.
      </Callout>
    </section>
  );
}

/* Sources data */
const SOURCES_DATA = [
  { name: "AP NEWS", geo: "US", bias: "Lean Left", adFontes: "-0.3", allSides: "-3.02", mbfc: "-2.1" },
  { name: "ABC News", geo: "US", bias: "Center", adFontes: "-5", allSides: "-1.5", mbfc: "-3" },
  { name: "Al Jazeera", geo: "Non-US", bias: "Lean Left", adFontes: "-8", allSides: "-2.3", mbfc: "-3.2" },
  { name: "Axios", geo: "US", bias: "Center", adFontes: "-4", allSides: "-1.2", mbfc: "-2.8" },
  { name: "BBC", geo: "Non-US", bias: "Center", adFontes: "-1", allSides: "-0.8", mbfc: "-3" },
  { name: "Bloomberg", geo: "US", bias: "Center", adFontes: "-3", allSides: "-1", mbfc: "-3" },
  { name: "CBS News", geo: "US", bias: "Center", adFontes: "-6", allSides: "-1.6", mbfc: "-3.2" },
  { name: "CNN", geo: "US", bias: "Lean Left", adFontes: "-9", allSides: "-1.8", mbfc: "-3.5" },
  { name: "Daily Wire", geo: "US", bias: "Right", adFontes: "28", allSides: "5.2", mbfc: "7.2" },
  { name: "Fox News", geo: "US", bias: "Right", adFontes: "17.4", allSides: "3.27", mbfc: "8" },
  { name: "Los Angeles Times", geo: "US", bias: "Lean Left", adFontes: "-7", allSides: "-2.1", mbfc: "-3.4" },
  { name: "MS NOW", geo: "US", bias: "Left", adFontes: "-19", allSides: "-5.08", mbfc: "-6.4" },
  { name: "NBC News", geo: "US", bias: "Lean Left", adFontes: "-7", allSides: "-1.7", mbfc: "-3.3" },
  { name: "NY Post", geo: "US", bias: "Lean Right", adFontes: "12", allSides: "2.8", mbfc: "4.9" },
  { name: "NYT", geo: "US", bias: "Lean Left", adFontes: "-7.4", allSides: "-2.2", mbfc: "-4.1" },
  { name: "National Review", geo: "US", bias: "Lean Right", adFontes: "22", allSides: "4.5", mbfc: "6.6" },
  { name: "Newsweek", geo: "US", bias: "Center", adFontes: "-1", allSides: "-0.2", mbfc: "-2.5" },
  { name: "POLITICO", geo: "US", bias: "Lean Left", adFontes: "-5", allSides: "-1.2", mbfc: "-2.8" },
  { name: "RT", geo: "Non-US", bias: "Lean Right", adFontes: "24", allSides: "3.8", mbfc: "7.5" },
  { name: "Reuters", geo: "Non-US", bias: "Center", adFontes: "0", allSides: "-0.85", mbfc: "-0.5" },
  { name: "South China Morning Post", geo: "Non-US", bias: "Center", adFontes: "0", allSides: "0", mbfc: "-2.9" },
  { name: "The Guardian", geo: "Non-US", bias: "Lean Left", adFontes: "-11", allSides: "-2.4", mbfc: "-5" },
  { name: "The Hill", geo: "US", bias: "Center", adFontes: "0", allSides: "0.2", mbfc: "0" },
  { name: "The Jerusalem Post", geo: "Non-US", bias: "Lean Right", adFontes: "6", allSides: "1.8", mbfc: "3.8" },
  { name: "USA Today", geo: "US", bias: "Center", adFontes: "0", allSides: "0", mbfc: "0" },
  { name: "WSJ", geo: "US", bias: "Lean Right", adFontes: "2.3", allSides: "0.33", mbfc: "4.2" },
  { name: "Washington Post", geo: "US", bias: "Lean Left", adFontes: "-7.1", allSides: "-1.63", mbfc: "-3.6" },
  { name: "Yahoo News", geo: "US", bias: "Center", adFontes: "-3", allSides: "-1", mbfc: "-2.7" },
];

const BIAS_COLOR: Record<string, string> = {
  Left: "var(--gap-left)",
  "Lean Left": "var(--gap-left)",
  Center: "var(--text-tertiary)",
  "Lean Right": "var(--gap-right)",
  Right: "var(--gap-right)",
};

function SourcesSection() {
  const [groupingTab, setGroupingTab] = useState<"political" | "geo">("political");

  return (
    <section id="sources">
      <h1 style={s.h1}>Sources</h1>
      <p style={s.subtitle}>
        The 28 news sources currently monitored by media.games.
      </p>

      <p style={s.p}>
        We selected sources to represent a range of editorial perspectives and geographies.
        Bias data comes from three independent external providers — <strong>AllSides</strong>,{" "}
        <strong>Ad Fontes Media</strong>, and <strong>Media Bias Fact Check</strong> — and is
        used as metadata for coverage analysis, not as a judgment by our platform.
      </p>

      <div style={s.sourcesTableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Source</th>
              <th style={s.th}>Geo</th>
              <th style={s.th}>Composite Bias</th>
              <th style={s.th}>Ad Fontes<br /><span style={{ fontSize: 9, fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "var(--text-tertiary)" }}>-42 to +42</span></th>
              <th style={s.th}>AllSides<br /><span style={{ fontSize: 9, fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "var(--text-tertiary)" }}>-6 to +6</span></th>
              <th style={s.th}>MBFC<br /><span style={{ fontSize: 9, fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "var(--text-tertiary)" }}>-10 to +10</span></th>
            </tr>
          </thead>
          <tbody>
            {SOURCES_DATA.map((src) => (
              <tr key={src.name}>
                <td style={{ ...s.td, fontWeight: 500 }}>{src.name}</td>
                <td style={s.td}><span style={s.tag(src.geo === "US" ? "var(--brand)" : "var(--accent)")}>{src.geo}</span></td>
                <td style={s.td}><span style={s.tag(BIAS_COLOR[src.bias] ?? "var(--text-tertiary)")}>{src.bias}</span></td>
                <td style={s.td}>{src.adFontes}</td>
                <td style={s.td}>{src.allSides}</td>
                <td style={s.td}>{src.mbfc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={s.sourceNote}>
        Bias data sourced from AllSides, Ad Fontes Media, and Media Bias Fact Check. Last verified: March 2026.
      </p>

      <h2 style={s.h2}>Bias Score</h2>
      <p style={s.p}>
        The <strong>bias score</strong> is a composite rating calculated by normalizing and averaging
        the bias assessments from three independent media monitoring organizations. Each organization
        uses its own methodology, scale, and editorial process to rate outlets — we normalize their
        scores to a common range, average them, and convert back to produce a single label.
      </p>
      <p style={s.p}>
        We don't produce our own bias ratings. The composite exists solely to provide a consistent
        grouping for coverage analysis — it determines which political group each source belongs to
        for calculating metrics like <code style={s.code}>pol_skew</code>.
      </p>

      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Organization</th><th style={s.th}>Methodology</th><th style={s.th}>Scale</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td}><strong>AllSides</strong></td>
            <td style={s.td}>Multi-method approach combining blind surveys, editorial review, third-party research, and community feedback to rate outlet bias.</td>
            <td style={s.td}><strong>-6 to +6</strong><br /><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Left &le; -3 / Lean Left -3 to -1 / Center -1 to 1 / Lean Right 1 to 3 / Right &ge; 3</span></td>
          </tr>
          <tr>
            <td style={s.td}><strong>Ad Fontes Media</strong></td>
            <td style={s.td}>Analyst teams of left, center, and right-leaning reviewers rate individual articles and shows on both reliability and bias, then aggregate to an outlet-level score.</td>
            <td style={s.td}><strong>-42 to +42</strong><br /><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Most Extreme Left to Most Extreme Right, with Middle at 0</span></td>
          </tr>
          <tr>
            <td style={s.td}><strong>Media Bias Fact Check</strong></td>
            <td style={s.td}>Editorial team evaluates outlets on biased wording, story selection, political affiliation, and sourcing practices. Also rates factual reporting separately.</td>
            <td style={s.td}><strong>-10 to +10</strong><br /><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Left / Left-Center / Least Biased / Right-Center / Right</span></td>
          </tr>
        </tbody>
      </table>

      <Callout label="Composite calculation">
        Each score is normalized to a [-1, 1] range by dividing by the scale maximum (6, 42, and 10 respectively).
        The three normalized scores are averaged, then converted back to the AllSides scale (x 6).
        The resulting composite uses AllSides label thresholds: Left (&le; -3), Lean Left (-3 to -1),
        Center (-1 to 1), Lean Right (1 to 3), Right (&ge; 3).
      </Callout>

      <h2 style={s.h2}>Source Groupings</h2>
      <p style={s.p}>
        For coverage gap analysis, sources are organized into groups. These groupings determine
        how we calculate coverage gaps and detect asymmetries in reporting.
      </p>

      <div style={s.groupingTabs}>
        <button style={s.groupingTab(groupingTab === "political")} onClick={() => setGroupingTab("political")}>By Political Lean</button>
        <button style={s.groupingTab(groupingTab === "geo")} onClick={() => setGroupingTab("geo")}>By Geography</button>
      </div>

      {groupingTab === "political" && (
        <div>
          <div style={s.groupSection}>
            <div style={s.groupHeader("var(--gap-left)")}>Left</div>
            <div style={s.groupOutlets}>
              {["MS NOW", "AP NEWS", "Al Jazeera", "NYT", "Washington Post", "POLITICO", "CNN", "Los Angeles Times", "NBC News", "The Guardian"].map((o) => (
                <span key={o} style={s.groupOutlet}>{o}</span>
              ))}
            </div>
          </div>
          <div style={s.groupSection}>
            <div style={s.groupHeader("var(--text-tertiary)")}>Center</div>
            <div style={s.groupOutlets}>
              {["Reuters", "BBC", "South China Morning Post", "ABC News", "Axios", "Bloomberg", "CBS News", "Newsweek", "The Hill", "USA Today", "Yahoo News"].map((o) => (
                <span key={o} style={s.groupOutlet}>{o}</span>
              ))}
            </div>
          </div>
          <div style={s.groupSection}>
            <div style={s.groupHeader("var(--gap-right)")}>Right</div>
            <div style={s.groupOutlets}>
              {["Fox News", "WSJ", "NY Post", "National Review", "Daily Wire", "RT", "The Jerusalem Post"].map((o) => (
                <span key={o} style={s.groupOutlet}>{o}</span>
              ))}
            </div>
          </div>
          <Callout label="How this is used">
            Political groupings power the <strong>pol gap</strong> metric:{" "}
            <code style={s.code}>pol_skew = (left_count - right_count) / (left_count + right_count)</code>.
            Center sources are excluded from this calculation.
          </Callout>
        </div>
      )}

      {groupingTab === "geo" && (
        <div>
          <div style={s.groupSection}>
            <div style={s.groupHeader("var(--brand)")}>US</div>
            <div style={s.groupOutlets}>
              {["AP NEWS", "ABC News", "Axios", "Bloomberg", "CBS News", "CNN", "Daily Wire", "Fox News", "Los Angeles Times", "MS NOW", "NBC News", "NY Post", "NYT", "National Review", "Newsweek", "POLITICO", "The Hill", "USA Today", "WSJ", "Washington Post", "Yahoo News"].map((o) => (
                <span key={o} style={s.groupOutlet}>{o}</span>
              ))}
            </div>
          </div>
          <div style={s.groupSection}>
            <div style={s.groupHeader("var(--accent)")}>Non-US</div>
            <div style={s.groupOutlets}>
              {["Al Jazeera", "BBC", "Reuters", "RT", "South China Morning Post", "The Guardian", "The Jerusalem Post"].map((o) => (
                <span key={o} style={s.groupOutlet}>{o}</span>
              ))}
            </div>
          </div>
          <Callout label="How this is used">
            Geographic groupings power the <strong>geo gap</strong> metric:{" "}
            <code style={s.code}>geo_skew = (us_count - nonus_count) / (us_count + nonus_count)</code>.
            Stories with extreme geo skew may indicate domestic blindspots.
          </Callout>
        </div>
      )}
    </section>
  );
}

function MethodologySection() {
  return (
    <section id="methodology">
      <h1 style={s.h1}>Methodology</h1>
      <p style={s.subtitle}>
        Deep dives into how each system works, for those who want full transparency.
      </p>

      <details style={s.details}>
        <summary style={s.summary}>Public Interest Evaluation — Full Specification</summary>
        <div style={s.detailsContent}>
          <p style={s.p}>
            Each story is evaluated by an LLM (currently GPT-4o-mini) against four binary criteria.
            The prompt is versioned, temperature is set to 0 for determinism, and every evaluation
            stores the full reasoning, model version, and prompt version.
          </p>
          <p style={s.p}><strong>Criteria:</strong></p>
          <ol style={s.ol}>
            <li><strong>material_impact</strong> — Does the story materially affect safety, health, economics, rights, or security?</li>
            <li><strong>institutional_action</strong> — Does it focus on actions by governments, courts, regulators, large corporations?</li>
            <li><strong>scope_scale</strong> — Does it affect large populations or systems?</li>
            <li><strong>new_information</strong> — Does it report something new, not previously public?</li>
          </ol>
          <p style={s.p}><strong>Gate rule:</strong> <code style={s.code}>met_count {">="} 3 AND (material_impact OR institutional_action)</code></p>
          <p style={s.p}>
            Commentary and opinion only qualify if they analyze real institutional actions.
            Historical stories fail unless revealing new evidence.
          </p>
        </div>
      </details>

      <details style={s.details}>
        <summary style={s.summary}>Bias Data Sources</summary>
        <div style={s.detailsContent}>
          <p style={s.p}>
            We don't rate bias ourselves. We use three independent external sources as metadata
            on sources, which enables coverage gap analysis across political groups.
          </p>
          <p style={s.p}><strong>Sources and scales:</strong></p>
          <ul style={s.ul}>
            <li><strong>AllSides</strong> — Bias meter, scale of -6 to +6</li>
            <li><strong>Ad Fontes Media</strong> — Bias scale of -42 to +42, plus a reliability score</li>
            <li><strong>Media Bias Fact Check</strong> — Bias scale of -10 to +10, plus a factual rating</li>
          </ul>
          <p style={s.p}><strong>Composite calculation:</strong> Each score is normalized to [-1, 1], the three are averaged, then converted back to the AllSides scale. Labels follow AllSides thresholds: Left (&le; -3), Lean Left (-3 to -1), Center (-1 to 1), Lean Right (1 to 3), Right (&ge; 3).</p>
        </div>
      </details>

      <details style={s.details}>
        <summary style={s.summary}>Clustering Approach</summary>
        <div style={s.detailsContent}>
          <p style={s.p}>
            Articles are converted to vector embeddings and grouped by semantic similarity.
            Articles whose embeddings fall within a similarity threshold are assigned to the same
            cluster. Each cluster represents a single real-world story or event.
          </p>
          <p style={s.p}>
            Cluster quality is validated using a heatmap that shows the topic-by-source matrix,
            allowing manual inspection of whether grouped articles genuinely belong together.
          </p>
        </div>
      </details>

      <details style={s.details}>
        <summary style={s.summary}>Coverage Gap Analysis</summary>
        <div style={s.detailsContent}>
          <p style={s.p}>Sources are grouped for gap analysis:</p>
          <p style={s.p}><strong>Political groups:</strong></p>
          <ul style={s.ul}>
            <li>Left: MSNBC, AP, Al Jazeera, NYT, WaPo, Politico, CNN, LA Times, NBC News, The Guardian</li>
            <li>Center: Reuters, BBC, SCMP, ABC News, Axios, Bloomberg, CBS News, Newsweek, The Hill, USA Today, Yahoo News</li>
            <li>Right: Fox News, WSJ, NY Post, National Review, Daily Wire, RT, Jerusalem Post</li>
          </ul>
          <p style={s.p}><strong>Geographic groups:</strong></p>
          <ul style={s.ul}>
            <li>US: AP, MSNBC, Fox News, NYT, WaPo, Politico, WSJ, NY Post, National Review, Daily Wire, and others</li>
            <li>Non-US: Reuters, BBC, Al Jazeera, SCMP, The Guardian, RT, Jerusalem Post</li>
          </ul>
          <p style={s.p}>
            <code style={s.code}>pol_gap = left_count - right_count</code><br />
            <code style={s.code}>geo_gap = us_count - nonus_count</code><br />
            Magnitude reflects the size of the discrepancy. Direction indicates which group has more coverage.
          </p>
        </div>
      </details>

      <details style={s.details}>
        <summary style={s.summary}>Limitations &amp; Known Gaps</summary>
        <div style={s.detailsContent}>
          <p style={s.p}>We believe in being transparent about what the system doesn't do well:</p>
          <ul style={s.ul}>
            <li>Coverage is limited to 28 English-language text sources — many perspectives are not represented</li>
            <li><strong>Video news is not currently represented.</strong> Sources like cable news broadcasts, YouTube news channels, and video-first platforms are not included in the pipeline. Coverage analysis is based exclusively on published text articles.</li>
            <li>LLM-based public interest evaluation, while reproducible, reflects the biases of the model</li>
            <li>Clustering can occasionally merge distinct-but-related stories or split a single story across clusters</li>
            <li>Article volume is a proxy for editorial attention, but doesn't capture placement, length, or tone</li>
            <li>Bias ratings from external sources may lag behind editorial shifts at sources</li>
          </ul>
        </div>
      </details>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section renderer map                                               */
/* ------------------------------------------------------------------ */

const SECTION_COMPONENTS: Record<string, () => React.ReactNode> = {
  overview: OverviewSection,
  "collecting-news": CollectingNewsSection,
  "public-interest": PublicInterestEvalSection,
  "anomaly-detection": AnomalyDetectionSection,
  "concept-topics": ConceptTopicsSection,
  "concept-pi": ConceptPISection,
  "concept-coverage": ConceptCoverageSection,
  "concept-anomalies": ConceptAnomaliesSection,
  sources: SourcesSection,
  methodology: MethodologySection,
};

/* ------------------------------------------------------------------ */
/*  Responsive CSS (injected once)                                     */
/* ------------------------------------------------------------------ */

const RESPONSIVE_CSS = `
@media (max-width: 768px) {
  .docs-wrapper { flex-direction: column !important; }
  .docs-sidebar { display: none !important; }
  .docs-mobile-nav { display: block !important; }
  .docs-main { padding: 20px 16px 60px !important; max-width: 100% !important; }
  .docs-criteria-grid { grid-template-columns: 1fr !important; }
}
`;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function DocsPage() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);

  // Inject responsive styles once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = RESPONSIVE_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Scroll to section when param changes
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section]);

  const activeSection = section ?? "overview";

  const handleNav = (id: string) => {
    navigate(id === "overview" ? "/docs" : `/docs/${id}`);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Group sections for sidebar
  const grouped = GROUPS.map((group) => ({
    group,
    items: SECTIONS.filter((sec) => sec.group === group),
  }));

  return (
    <div className="docs-wrapper" style={s.wrapper}>
      {/* Desktop sidebar */}
      <aside className="docs-sidebar" style={s.sidebar}>
        {grouped.map(({ group, items }) => (
          <div key={group} style={s.sidebarGroup}>
            <div style={s.sidebarHeading}>{group}</div>
            {items.map((sec) => (
              <div
                key={sec.id}
                style={s.sidebarLink(activeSection === sec.id)}
                onClick={() => handleNav(sec.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") handleNav(sec.id); }}
              >
                {sec.label}
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* Mobile nav */}
      <div className="docs-mobile-nav" style={s.mobileNav}>
        <select
          style={s.mobileSelect}
          value={activeSection}
          onChange={(e) => handleNav(e.target.value)}
        >
          {SECTIONS.map((sec) => (
            <option key={sec.id} value={sec.id}>{sec.group} / {sec.label}</option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <main className="docs-main" style={s.main} ref={mainRef}>
        {section
          ? /* Single section view */
            (() => {
              const Component = SECTION_COMPONENTS[section];
              return Component ? <Component /> : <OverviewSection />;
            })()
          : /* All sections view */
            SECTIONS.map((sec, i) => {
              const Component = SECTION_COMPONENTS[sec.id];
              return Component ? (
                <div key={sec.id}>
                  {i > 0 && <div style={s.sectionDivider} />}
                  <div className={sec.id === "public-interest" ? "docs-criteria-grid" : ""}>
                    <Component />
                  </div>
                </div>
              ) : null;
            })
        }

        <div style={s.footer}>
          media.games documentation. We observe coverage trends. We don't fact-check, and we don't rate bias.
        </div>
      </main>
    </div>
  );
}
