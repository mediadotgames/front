import type {
  HeatmapRow,
  HeatmapSummary,
  Topic,
  TopicDetail,
  Article,
  Outlet,
  Freshness,
  PaginatedResponse,
} from "./types.ts";

const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// snake_case → camelCase helper
// ---------------------------------------------------------------------------

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function camelizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toCamelCase(k)] = camelizeKeys(v);
    }
    return out;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText} — ${path}`);
  }
  const json: unknown = await res.json();
  return camelizeKeys(json) as T;
}

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

interface PaginationOpts {
  limit?: number;
  offset?: number;
}

interface HeatmapOpts extends PaginationOpts {
  q?: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export function fetchHeatmap(opts?: HeatmapOpts): Promise<PaginatedResponse<HeatmapRow>> {
  const params: Record<string, string> = {};
  if (opts?.limit != null) params.limit = String(opts.limit);
  if (opts?.offset != null) params.offset = String(opts.offset);
  if (opts?.category) params.category = opts.category;
  if (opts?.q) params.q = opts.q;
  return apiFetch<PaginatedResponse<HeatmapRow>>("/api/heatmap", params);
}

export function fetchHeatmapSummary(): Promise<HeatmapSummary> {
  return apiFetch<HeatmapSummary>("/api/heatmap/summary");
}

export function fetchTopics(opts?: PaginationOpts): Promise<PaginatedResponse<Topic>> {
  const params: Record<string, string> = {};
  if (opts?.limit != null) params.limit = String(opts.limit);
  if (opts?.offset != null) params.offset = String(opts.offset);
  return apiFetch<PaginatedResponse<Topic>>("/api/topics", params);
}

export function fetchTopic(id: string): Promise<TopicDetail> {
  return apiFetch<TopicDetail>(`/api/topics/${encodeURIComponent(id)}`);
}

export function fetchTopicArticles(
  id: string,
  opts?: PaginationOpts,
): Promise<PaginatedResponse<Article>> {
  const params: Record<string, string> = {};
  if (opts?.limit != null) params.limit = String(opts.limit);
  if (opts?.offset != null) params.offset = String(opts.offset);
  return apiFetch<PaginatedResponse<Article>>(
    `/api/topics/${encodeURIComponent(id)}/articles`,
    params,
  );
}

export function fetchOutlets(): Promise<{ data: Outlet[] }> {
  return apiFetch<{ data: Outlet[] }>("/api/outlets");
}

export function fetchFreshness(): Promise<Freshness> {
  return apiFetch<Freshness>("/api/freshness");
}
