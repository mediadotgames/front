import { useState, useEffect, useRef } from "react";

import { API_BASE_URL as API_BASE } from "../api/config.ts";
const DEBOUNCE_MS = 300;

export interface ClusterResult {
  topic_id: string;
  label: string;
  story_count: number;
  dominant_category: string | null;
  earliest_published_at: string | null;
  latest_published_at: string | null;
  trend_score: number | null;
  velocity_score: number | null;
  rank?: number;
}

export function useClusterSearch(query: string, limit = 20) {
  const [clusters, setClusters] = useState<ClusterResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setClusters([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/clusters/search?q=${encodeURIComponent(query)}&limit=${limit}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setClusters(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to search clusters"
        );
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, limit]);

  return { clusters, isLoading, error };
}
