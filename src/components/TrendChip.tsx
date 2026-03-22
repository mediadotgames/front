import type { TrendChip as TrendChipData } from "../hooks/useTrends";

interface TrendChipProps {
  trend: TrendChipData;
  isActive: boolean;
  onClick: (trend: TrendChipData) => void;
}

const directionArrow: Record<string, string> = {
  rising: "\u2191",
  falling: "\u2193",
  stable: "\u2022",
};

const sourceLabel = (count: number) => {
  if (count >= 3) return "G+R+X";
  if (count >= 2) return "2src";
  return "";
};

export function TrendChip({ trend, isActive, onClick }: TrendChipProps) {
  return (
    <button
      onClick={() => onClick(trend)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 14px",
        borderRadius: "20px",
        border: isActive ? "2px solid #2563eb" : "1px solid #d1d5db",
        background: isActive ? "#eff6ff" : "#f9fafb",
        color: "#1f2937",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s ease",
      }}
      title={`Score: ${trend.trend_score?.toFixed(1)} | ${trend.source_count} source(s)`}
    >
      <span>{trend.display_label}</span>
      <span
        style={{
          color:
            trend.direction === "rising"
              ? "#16a34a"
              : trend.direction === "falling"
              ? "#dc2626"
              : "#9ca3af",
          fontWeight: 600,
        }}
      >
        {directionArrow[trend.direction] || ""}
      </span>
      {trend.source_count > 1 && (
        <span
          style={{
            fontSize: "10px",
            color: "#6b7280",
            background: "#e5e7eb",
            padding: "1px 5px",
            borderRadius: "8px",
          }}
        >
          {sourceLabel(trend.source_count)}
        </span>
      )}
    </button>
  );
}
