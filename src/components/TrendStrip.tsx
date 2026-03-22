import { useTrends } from "../hooks/useTrends";
import type { TrendChip as TrendChipData } from "../hooks/useTrends";
import { TrendChip } from "./TrendChip";

interface TrendStripProps {
  activeTrend: string | null; // normalized_query of active trend
  onTrendClick: (trend: TrendChipData) => void;
}

export function TrendStrip({ activeTrend, onTrendClick }: TrendStripProps) {
  const { trends, isLoading, error } = useTrends();

  if (isLoading) {
    return (
      <div style={{ padding: "8px 0", color: "#9ca3af", fontSize: "13px" }}>
        Loading trends...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "8px 0", color: "#dc2626", fontSize: "13px" }}>
        Trends unavailable
      </div>
    );
  }

  if (trends.length === 0) {
    return null; // Don't render empty strip
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        padding: "8px 0",
        overflowX: "auto",
        scrollbarWidth: "thin",
      }}
    >
      {trends.map((trend) => (
        <TrendChip
          key={trend.trend_topic_id}
          trend={trend}
          isActive={activeTrend === trend.normalized_query}
          onClick={onTrendClick}
        />
      ))}
    </div>
  );
}
