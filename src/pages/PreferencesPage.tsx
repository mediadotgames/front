import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";

export function PreferencesPage() {
  const { user, isAuthenticated, isLoading, updatePreferences } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Preference fields — extend as needed
  const [defaultState, setDefaultState] = useState(
    (user?.preferences?.defaultState as string) ?? "",
  );
  const [pinnedTopics, setPinnedTopics] = useState(
    (user?.preferences?.pinnedTopics as string) ?? "",
  );

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updatePreferences({
        defaultState: defaultState || null,
        pinnedTopics: pinnedTopics
          ? pinnedTopics.split(",").map((t) => t.trim())
          : [],
      });
      setMessage("Preferences saved.");
    } catch {
      setMessage("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Preferences
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 24,
        }}
      >
        Customize how the dashboard renders for you.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Default state/region
          <input
            type="text"
            placeholder="e.g. CA, NY, TX"
            value={defaultState}
            onChange={(e) => setDefaultState(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Pinned topics (comma-separated)
          <input
            type="text"
            placeholder="e.g. politics, healthcare, education"
            value={pinnedTopics}
            onChange={(e) => setPinnedTopics(e.target.value)}
            style={inputStyle}
          />
        </label>

        {message && (
          <div
            style={{
              fontSize: 13,
              color: message.includes("Failed")
                ? "var(--danger, #c0392b)"
                : "var(--success, #3d8c40)",
            }}
          >
            {message}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--surface-white, var(--bg))",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "none",
  borderRadius: 6,
  background: "var(--brand)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "flex-start",
};
