import { useState, useEffect, useCallback } from "react";
import { fetchPiqaStories, fetchPiqaFilters, savePiqaAnnotation } from "../api/client";
import type { PiqaStory, PiqaAnnotation, PiqaFilterOptions } from "../api/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PI_CRITERIA = [
  { key: "materialImpact", dbKey: "material_impact", label: "Material Impact" },
  { key: "institutionalAction", dbKey: "institutional_action", label: "Institutional Action" },
  { key: "scopeScale", dbKey: "scope_scale", label: "Scope / Scale" },
  { key: "newInformation", dbKey: "new_information", label: "New Information" },
] as const;

const GEO_FLAGS = [
  { key: "usRelevance", dbKey: "us_relevance", label: "US Relevance" },
  { key: "globalRelevance", dbKey: "global_relevance", label: "Global Relevance" },
  { key: "foreignRelevance", dbKey: "foreign_relevance", label: "Foreign Relevance" },
  { key: "stateLocalRelevance", dbKey: "state_local_relevance", label: "State / Local" },
] as const;

const SIZE_OPTIONS = [25, 50, 100, 200];

type FilterTab = "all" | "ungraded" | "graded" | "disagreements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function boolIcon(v: boolean | null) {
  if (v === true) return "\u2713";
  if (v === false) return "\u2717";
  return "\u2014";
}

function boolColor(v: boolean | null) {
  if (v === true) return "var(--success)";
  if (v === false) return "var(--danger)";
  return "var(--text-tertiary)";
}

/** Compute human PI label from criteria */
function computeLabel(ann: Partial<PiqaAnnotation>): string | null {
  const bools = [ann.material_impact, ann.institutional_action, ann.scope_scale, ann.new_information];
  const trueCount = bools.filter((b) => b === true).length;
  if (bools.some((b) => b === null || b === undefined)) return null;
  if (trueCount >= 4) return "High";
  if (trueCount >= 3) return "Moderate";
  if (trueCount >= 1) return "Low";
  return "None";
}

function isGraded(story: PiqaStory): boolean {
  return story.humanLabeledAt != null;
}

function hasDisagreement(story: PiqaStory): boolean {
  if (!isGraded(story)) return false;
  return (
    story.humanMaterialImpact !== story.llmMaterialImpact ||
    story.humanInstitutionalAction !== story.llmInstitutionalAction ||
    story.humanScopeScale !== story.llmScopeScale ||
    story.humanNewInformation !== story.llmNewInformation
  );
}

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const LS_KEY = "mdg-piqa-drafts";

type DraftMap = Record<string, Partial<PiqaAnnotation>>;

function loadDrafts(): DraftMap {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDraft(storyId: string, ann: Partial<PiqaAnnotation>) {
  const drafts = loadDrafts();
  drafts[storyId] = ann;
  localStorage.setItem(LS_KEY, JSON.stringify(drafts));
}

function clearDraft(storyId: string) {
  const drafts = loadDrafts();
  delete drafts[storyId];
  localStorage.setItem(LS_KEY, JSON.stringify(drafts));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PiqaPage() {
  const [stories, setStories] = useState<PiqaStory[]>([]);
  const [filters, setFilters] = useState<PiqaFilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [drafts, setDrafts] = useState<DraftMap>(loadDrafts);
  const [saving, setSaving] = useState<string | null>(null);

  // Query params
  const [sampleMode, setSampleMode] = useState<"random" | "">("");
  const [sampleSize, setSampleSize] = useState(200);
  const [catFilter, setCatFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [piLabelFilter, setPiLabelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Load filters on mount
  useEffect(() => {
    fetchPiqaFilters().then(setFilters).catch(console.error);
  }, []);

  // Fetch stories
  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPiqaStories({
        sample: activeSearch ? undefined : (sampleMode === "random" ? "random" : undefined),
        size: activeSearch ? undefined : sampleSize,
        category: catFilter || undefined,
        source: sourceFilter || undefined,
        piLabel: piLabelFilter || undefined,
        search: activeSearch || undefined,
      });
      setStories(res.data);
    } catch (err) {
      console.error("Failed to load stories:", err);
    } finally {
      setLoading(false);
    }
  }, [sampleMode, sampleSize, catFilter, sourceFilter, piLabelFilter, activeSearch]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Filter stories by tab
  const filtered = stories.filter((s) => {
    if (tab === "ungraded") return !isGraded(s) && !drafts[s.storyId];
    if (tab === "graded") return isGraded(s);
    if (tab === "disagreements") return hasDisagreement(s);
    return true;
  });

  const gradedCount = stories.filter((s) => isGraded(s)).length;

  // Build annotation from story defaults + draft
  function getAnnotation(story: PiqaStory): Partial<PiqaAnnotation> {
    const draft = drafts[story.storyId];
    if (draft) return draft;
    if (isGraded(story)) {
      return {
        story_id: story.storyId,
        is_public_interest: story.humanIsPublicInterest,
        label: story.humanLabel,
        material_impact: story.humanMaterialImpact,
        institutional_action: story.humanInstitutionalAction,
        scope_scale: story.humanScopeScale,
        new_information: story.humanNewInformation,
        us_relevance: story.humanUsRelevance,
        global_relevance: story.humanGlobalRelevance,
        foreign_relevance: story.humanForeignRelevance,
        state_local_relevance: story.humanStateLocalRelevance,
        notes: story.humanNotes,
      };
    }
    return { story_id: story.storyId };
  }

  function updateDraft(storyId: string, field: string, value: boolean | null | string) {
    const story = stories.find((s) => s.storyId === storyId);
    if (!story) return;
    const current = getAnnotation(story);
    const updated = { ...current, story_id: storyId, [field]: value };
    // Auto-compute label
    updated.label = computeLabel(updated);
    updated.is_public_interest = updated.label != null && updated.label !== "None" && updated.label !== "Low";
    saveDraft(storyId, updated);
    setDrafts((d) => ({ ...d, [storyId]: updated }));
  }

  async function handleSave(storyId: string) {
    const story = stories.find((s) => s.storyId === storyId);
    if (!story) return;
    const ann = getAnnotation(story);
    if (!ann.story_id) return;

    setSaving(storyId);
    try {
      await savePiqaAnnotation(ann as PiqaAnnotation);
      clearDraft(storyId);
      setDrafts((d) => {
        const next = { ...d };
        delete next[storyId];
        return next;
      });
      // Refresh the single story's human fields
      setStories((prev) =>
        prev.map((s) =>
          s.storyId === storyId
            ? {
                ...s,
                humanIsPublicInterest: ann.is_public_interest ?? null,
                humanLabel: ann.label ?? null,
                humanMaterialImpact: ann.material_impact ?? null,
                humanInstitutionalAction: ann.institutional_action ?? null,
                humanScopeScale: ann.scope_scale ?? null,
                humanNewInformation: ann.new_information ?? null,
                humanUsRelevance: ann.us_relevance ?? null,
                humanGlobalRelevance: ann.global_relevance ?? null,
                humanForeignRelevance: ann.foreign_relevance ?? null,
                humanStateLocalRelevance: ann.state_local_relevance ?? null,
                humanNotes: ann.notes ?? null,
                humanLabeledAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save annotation. Check console.");
    } finally {
      setSaving(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>PI Eval QA</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {gradedCount}/{stories.length} graded
          </span>
          {/* Progress bar */}
          <div
            style={{
              width: 120,
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${stories.length ? (gradedCount / stories.length) * 100 : 0}%`,
                height: "100%",
                background: "var(--brand)",
                borderRadius: 3,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      </div>

      {/* Sample controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
          padding: "10px 14px",
          background: "var(--surface)",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      >
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Sample:
          <select
            value={sampleMode}
            onChange={(e) => setSampleMode(e.target.value as "" | "random")}
            style={selectStyle}
          >
            <option value="">Latest</option>
            <option value="random">Random</option>
          </select>
        </label>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Size:
          <select value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} style={selectStyle}>
            {SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Category:
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            {filters?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Source:
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            {filters?.sources.map((s) => (
              <option key={s.uri} value={s.uri}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          PI Label:
          <select value={piLabelFilter} onChange={(e) => setPiLabelFilter(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            {filters?.piLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button onClick={loadStories} disabled={loading} style={{ marginLeft: "auto" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Search bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim()) {
              setActiveSearch(searchQuery.trim());
            }
          }}
          placeholder="Search by URL or headline..."
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface-white)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          onClick={() => {
            if (searchQuery.trim()) setActiveSearch(searchQuery.trim());
          }}
          disabled={!searchQuery.trim() || loading}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            background: "var(--brand-bg)",
            color: "var(--brand)",
            border: "1px solid var(--brand-border)",
            borderRadius: 6,
            cursor: searchQuery.trim() ? "pointer" : "default",
          }}
        >
          Search
        </button>
        {activeSearch && (
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveSearch("");
            }}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              background: "var(--surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["all", "ungraded", "graded", "disagreements"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? "var(--brand-bg)" : "var(--surface)",
              border: `1px solid ${tab === t ? "var(--brand)" : "var(--border)"}`,
              color: tab === t ? "var(--brand)" : "var(--text-secondary)",
              fontWeight: tab === t ? 600 : 400,
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 14,
              textTransform: "capitalize",
            }}
          >
            {t}
            {t === "graded" && ` (${gradedCount})`}
            {t === "disagreements" && ` (${stories.filter(hasDisagreement).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 120px 100px 70px 60px",
            padding: "8px 14px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <span>#</span>
          <span>Headline</span>
          <span>Source</span>
          <span>Category</span>
          <span>PI</span>
          <span>Done</span>
        </div>

        {/* Rows */}
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>Loading stories...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>No stories found.</div>
        )}

        {filtered.map((story, idx) => {
          const isExpanded = expandedId === story.storyId;
          const graded = isGraded(story);
          const hasDraft = !!drafts[story.storyId];

          return (
            <div key={story.storyId}>
              {/* Row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : story.storyId)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 120px 100px 70px 60px",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer",
                  background: isExpanded ? "var(--row-hover)" : "transparent",
                  transition: "background 0.1s",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = "var(--row-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{idx + 1}</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 12,
                  }}
                >
                  {story.headline || "(no headline)"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{story.sourceName}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{story.topCategory || "—"}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      story.llmLabel === "High"
                        ? "var(--success)"
                        : story.llmLabel === "None"
                          ? "var(--text-tertiary)"
                          : "var(--text)",
                  }}
                >
                  {story.llmLabel || "—"}
                </span>
                <span style={{ fontSize: 14 }}>
                  {graded ? (
                    <span style={{ color: "var(--success)" }}>{"\u25CF"}</span>
                  ) : hasDraft ? (
                    <span style={{ color: "var(--brand)" }}>{"\u25D2"}</span>
                  ) : (
                    <span style={{ color: "var(--text-tertiary)" }}>{"\u25CB"}</span>
                  )}
                </span>
              </div>

              {/* Expanded annotation panel */}
              {isExpanded && (
                <AnnotationPanel
                  story={story}
                  annotation={getAnnotation(story)}
                  onUpdate={(field, value) => updateDraft(story.storyId, field, value)}
                  onSave={() => handleSave(story.storyId)}
                  saving={saving === story.storyId}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
        Showing {filtered.length} of {stories.length} stories
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation Panel (expanded row)
// ---------------------------------------------------------------------------

function AnnotationPanel({
  story,
  annotation,
  onUpdate,
  onSave,
  saving,
}: {
  story: PiqaStory;
  annotation: Partial<PiqaAnnotation>;
  onUpdate: (field: string, value: boolean | null | string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 24px 20px",
        borderBottom: "2px solid var(--brand-border)",
        background: "var(--surface-white)",
      }}
    >
      {/* Story meta */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "baseline" }}>
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--brand)", fontWeight: 500 }}
        >
          Open article &rarr;
        </a>
        {story.topicLabel && (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Cluster: {story.topicLabel} ({story.clusterSize} stories)
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
          {story.storyId}
        </span>
      </div>

      {/* Body text */}
      {story.bodyText && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "var(--surface)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxHeight: 200,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            border: "1px solid var(--border-light)",
          }}
        >
          <strong style={{ color: "var(--text)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Body text (first 3000 chars):
          </strong>
          <br />
          {story.bodyText}
        </div>
      )}

      {/* Two-column layout: LLM eval | Human eval */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* LLM Evaluation (read-only) */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
            LLM Evaluation
            <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
              ({story.llmModel || "unknown"})
            </span>
          </h3>

          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>Label:</strong>{" "}
            <span style={{ fontWeight: 600, color: story.llmLabel === "High" ? "var(--success)" : "var(--text)" }}>
              {story.llmLabel}
            </span>
            <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
              ({story.llmMetCount}/4 criteria met)
            </span>
          </div>

          <div style={{ fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmMaterialImpact) }}>{boolIcon(story.llmMaterialImpact)}</span>
              Material Impact
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmInstitutionalAction) }}>
                {boolIcon(story.llmInstitutionalAction)}
              </span>
              Institutional Action
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmScopeScale) }}>{boolIcon(story.llmScopeScale)}</span>
              Scope / Scale
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmNewInformation) }}>{boolIcon(story.llmNewInformation)}</span>
              New Information
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px 16px",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border-light)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmUsRelevance) }}>{boolIcon(story.llmUsRelevance)}</span>
              US
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmGlobalRelevance) }}>{boolIcon(story.llmGlobalRelevance)}</span>
              Global
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmForeignRelevance) }}>{boolIcon(story.llmForeignRelevance)}</span>
              Foreign
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: boolColor(story.llmStateLocalRelevance) }}>
                {boolIcon(story.llmStateLocalRelevance)}
              </span>
              State/Local
            </div>
          </div>

          {story.llmReasoning && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--surface)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              <strong>Reasoning:</strong> {story.llmReasoning}
            </div>
          )}
        </div>

        {/* Human Evaluation (editable) */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
            Your Evaluation
          </h3>

          {/* PI Criteria */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              PI Criteria
            </div>
            {PI_CRITERIA.map(({ key, dbKey, label }) => (
              <RadioRow
                key={key}
                label={label}
                value={(annotation as Record<string, unknown>)[dbKey] as boolean | null | undefined}
                onChange={(v) => onUpdate(dbKey, v)}
              />
            ))}
          </div>

          {/* Geo Flags */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Geographic Relevance
            </div>
            {GEO_FLAGS.map(({ key, dbKey, label }) => (
              <RadioRow
                key={key}
                label={label}
                value={(annotation as Record<string, unknown>)[dbKey] as boolean | null | undefined}
                onChange={(v) => onUpdate(dbKey, v)}
              />
            ))}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <textarea
              placeholder="Notes (optional)..."
              value={annotation.notes || ""}
              onChange={(e) => onUpdate("notes", e.target.value)}
              rows={2}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 12,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--surface)",
                color: "var(--text)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Computed label + Save */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>
              <strong>Label:</strong>{" "}
              <span style={{ fontWeight: 600, color: annotation.label === "High" ? "var(--success)" : "var(--text)" }}>
                {annotation.label || "—"}
              </span>
            </span>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                padding: "6px 20px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radio Row — True / False / Skip
// ---------------------------------------------------------------------------

function RadioRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--text)" }}>{label}</span>
      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 12 }}>
          <input
            type="radio"
            name={`${label}-radio`}
            checked={value === true}
            onChange={() => onChange(true)}
            style={{ accentColor: "var(--success)" }}
          />
          T
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 12 }}>
          <input
            type="radio"
            name={`${label}-radio`}
            checked={value === false}
            onChange={() => onChange(false)}
            style={{ accentColor: "var(--danger)" }}
          />
          F
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 12 }}>
          <input
            type="radio"
            name={`${label}-radio`}
            checked={value === null}
            onChange={() => onChange(null)}
            style={{ accentColor: "var(--text-tertiary)" }}
          />
          Skip
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: "3px 6px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-white)",
  color: "var(--text)",
};
