import type { ClusterResult } from "../hooks/useClusterSearch";

interface ClusterListProps {
  clusters: ClusterResult[];
  isLoading: boolean;
  searchQuery: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ClusterList({ clusters, isLoading, searchQuery }: ClusterListProps) {
  if (!searchQuery) {
    return (
      <div style={{ padding: "24px", color: "#9ca3af", textAlign: "center", fontSize: "14px" }}>
        Click a trend or search to see matching clusters
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: "24px", color: "#9ca3af", textAlign: "center", fontSize: "14px" }}>
        Searching clusters...
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div style={{ padding: "24px", color: "#6b7280", textAlign: "center", fontSize: "14px" }}>
        No clusters found for "{searchQuery}"
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      {clusters.map((cluster) => (
        <div
          key={cluster.topic_id}
          style={{
            padding: "12px 16px",
            background: "#fff",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: "14px", color: "#1f2937" }}>
              {cluster.label}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              {cluster.story_count} stories
              {cluster.dominant_category && ` · ${cluster.dominant_category}`}
              {cluster.earliest_published_at &&
                ` · ${formatDate(cluster.earliest_published_at)}`}
            </div>
          </div>
          {cluster.trend_score != null && cluster.trend_score > 0 && (
            <div
              style={{
                fontSize: "11px",
                color: "#2563eb",
                background: "#eff6ff",
                padding: "2px 8px",
                borderRadius: "10px",
                whiteSpace: "nowrap",
              }}
            >
              trend {cluster.trend_score.toFixed(1)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
