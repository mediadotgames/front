import { useState, useEffect, useCallback } from "react";

import { API_BASE_URL as API_BASE } from "../api/config.ts";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface TrendChip {
  trend_topic_id: string;
  display_label: string;
  normalized_query: string;
  trend_score: number;
  velocity_score: number;
  source_count: number;
  matched_cluster_count: number;
  direction: "rising" | "falling" | "stable";
}

export function useTrends(geo = "US", limit = 10) {
  const [trends, setTrends] = useState<TrendChip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/trends/top?geo=${geo}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrends(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trends");
    } finally {
      setIsLoading(false);
    }
  }, [geo, limit]);

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTrends]);

  return { trends, isLoading, error, refetch: fetchTrends };
}
