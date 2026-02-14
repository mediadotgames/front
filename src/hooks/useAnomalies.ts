/**
 * React hook to load anomalies from the API.
 * 
 * This hook provides a robust interface for fetching anomaly data from the backend API,
 * with advanced features for request management and performance optimization. It uses a
 * stable query key system to prevent unnecessary requests and implements proper request
 * cancellation to handle race conditions and component unmounting.
 * 
 * Key Features:
 * - Uses a stable "query key" to avoid unnecessary requests
 * - Aborts in-flight fetches on param change/unmount
 * - Exposes `refetch` for manual refresh
 * - Prevents race conditions with request ID tracking
 * - Handles loading states and errors gracefully
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const { data, loading, error, refetch } = useAnomalies();
 * 
 * // With filters
 * const { data, loading, error, refetch } = useAnomalies({
 *   tag: "security",
 *   outlet: "reuters",
 *   limit: 20,
 *   since: "2024-01-01T00:00:00Z"
 * });
 * 
 * // Manual refresh
 * const handleRefresh = () => refetch();
 * ```
 * 
 * @since 1.0.0
 * @author Data Collection Engine Team
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Represents an anomaly record from the database.
 * 
 * This interface defines the structure of anomaly data as returned by the API.
 * All fields are required except for optional nullable fields marked with `?`.
 * 
 * @interface Anomaly
 */
export interface Anomaly {
  /** Unique identifier for the anomaly */
  anomaly_id: string;
  
  /** Brief description of the anomaly */
  summary: string;
  
  /** ISO 8601 timestamp when the anomaly was reported */
  report_time: string;
  
  /** Category classification of the anomaly */
  category: string;
  
  /** Severity level of the anomaly */
  severity: "Low" | "Medium" | "High" | "Critical";
  
  /** Name or identifier of the person who reported the anomaly */
  reporter: string;
  
  /** Array of tags associated with the anomaly */
  tags: string[];
  
  /** Array of news outlets or sources where the anomaly was detected */
  outlets: string[];
  
  /** Current resolution status of the anomaly */
  resolution_status: "Pending" | "Validated" | "Invalidated";
  
  /** Optional investigator assigned to the anomaly */
  investigator?: string | null;
  
  /** Optional additional context or notes about the anomaly */
  added_context?: string | null;
}

/**
 * Parameters for filtering anomaly queries.
 * 
 * All parameters are optional and can be combined to create complex filters.
 * The hook uses these parameters to build a stable query key for caching.
 * 
 * @interface AnomalyQueryParams
 */
export interface AnomalyQueryParams {
  /** Filter by specific tag */
  tag?: string;
  
  /** Filter by specific outlet/source */
  outlet?: string;
  
  /** Filter anomalies reported after this date (ISO 8601 with offset recommended) */
  since?: string;
  
  /** Maximum number of results to return (server caps to 500) */
  limit?: number;
}

/**
 * Return type of the useAnomalies hook.
 * 
 * @interface UseAnomaliesReturn
 */
export interface UseAnomaliesReturn {
  /** Array of anomaly records, or null if not yet loaded */
  data: Anomaly[] | null;
  
  /** Whether the request is currently in progress */
  loading: boolean;
  
  /** Error message if the request failed, or null if successful */
  error: string | null;
  
  /** Function to manually trigger a refetch with current parameters */
  refetch: () => void;
}

/**
 * Custom React hook for fetching anomaly data from the API.
 * 
 * This hook manages the state of anomaly data fetching with advanced features including
 * request deduplication, race condition prevention, and automatic request cancellation.
 * It uses a stable query key system to prevent unnecessary API calls and implements
 * proper cleanup to handle component unmounting and parameter changes.
 * 
 * @param params - Optional query parameters for filtering anomalies
 * @returns Object containing data, loading state, error information, and refetch function
 * 
 * @throws {Error} When API request fails (handled internally and exposed via error state)
 * 
 * @example
 * ```tsx
 * // Basic usage without filters
 * const { data, loading, error, refetch } = useAnomalies();
 * 
 * // With specific filters
 * const { data, loading, error, refetch } = useAnomalies({
 *   tag: "security",
 *   outlet: "reuters",
 *   limit: 20,
 *   since: "2024-01-01T00:00:00Z"
 * });
 * 
 * // Conditional rendering based on state
 * if (loading) return <div>Loading anomalies...</div>;
 * if (error) return <div>Error: {error}</div>;
 * if (!data) return <div>No data available</div>;
 * 
 * return (
 *   <div>
 *     <button onClick={refetch}>Refresh</button>
 *     <ul>
 *       {data.map(anomaly => (
 *         <li key={anomaly.anomaly_id}>
 *           {anomaly.summary} - {anomaly.severity}
 *         </li>
 *       ))}
 *     </ul>
 *   </div>
 * );
 * ```
 */
export function useAnomalies(params: AnomalyQueryParams = {}): UseAnomaliesReturn {
  const [data, setData] = useState<Anomaly[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Builds a normalized query key (stable string) from params.
   * 
   * This creates a deterministic string representation of the query parameters
   * that can be used for caching and dependency tracking. Keys are sorted
   * to ensure stability regardless of parameter order.
   * 
   * @private
   */
  const queryKey = useMemo(() => {
    // Sort keys for stability so {a:1,b:2} === {b:2,a:1}
    const keys = Object.keys(params).sort() as (keyof AnomalyQueryParams)[];
    const norm: Record<string, string> = {};
    for (const k of keys) {
      const v = params[k];
      if (v !== undefined && v !== null) norm[k] = String(v);
    }
    return JSON.stringify(norm);
  }, [params]);

  /**
   * Tracks the latest request ID to prevent out-of-order updates.
   * 
   * This ref is incremented for each new request, allowing us to ignore
   * responses from older requests that may complete after newer ones.
   * 
   * @private
   */
  const reqIdRef = useRef(0);

  /**
   * Performs a single fetch operation with the given abort signal.
   * 
   * This function handles the actual API request, including URL construction,
   * request execution, response parsing, and state updates. It includes
   * race condition protection and proper error handling.
   * 
   * @private
   * @param signal - AbortSignal to cancel the request if needed
   */
  const fetchOnce = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    const base = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
    const url = new URL("/api/anomalies", base);

    // Rebuild params from queryKey (or reuse original params if preferred)
    const parsed: Record<string, string> = JSON.parse(queryKey);
    for (const [k, v] of Object.entries(parsed)) url.searchParams.set(k, v);

    const currentReq = ++reqIdRef.current;

    try {
      const res = await fetch(url.toString(), { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as Anomaly[];

      // Only apply if this is the latest request and not aborted
      if (!signal.aborted && currentReq === reqIdRef.current) {
        setData(json);
      }
    } catch (e: unknown) {
      if (signal.aborted) return; // ignore aborted fetches
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setData(null);
      // Optional: console.error("Failed to fetch anomalies:", msg);
    } finally {
      if (!signal.aborted && currentReq === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [queryKey]);

  /**
   * Exposes a manual refetch function that reuses the latest parameters.
   * 
   * This function allows components to manually trigger a data refresh
   * without changing the query parameters. It creates a new abort controller
   * for the manual request.
   * 
   * @public
   */
  const refetch = useCallback(() => {
    const controller = new AbortController();
    fetchOnce(controller.signal);
    // No automatic abort here; this is a manual trigger.
  }, [fetchOnce]);

  /**
   * Auto-fetch on mount and whenever parameters change.
   * 
   * This effect automatically triggers data fetching when the component mounts
   * or when the query parameters change. It properly cleans up by aborting
   * in-flight requests when the component unmounts or parameters change.
   * 
   * @private
   */
  useEffect(() => {
    const controller = new AbortController();
    fetchOnce(controller.signal);
    return () => controller.abort(); // abort on unmount/param change
  }, [fetchOnce]);

  return { data, loading, error, refetch };
}
