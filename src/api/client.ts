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

export async function fetchTopic(id: string): Promise<TopicDetail> {
  const raw = await apiFetch<Record<string, unknown>>(`/api/topics/${encodeURIComponent(id)}`);
  // Map backend field names to frontend type names
  const remap: Record<string, string> = {
    outlets: "outletBreakdown",
    topicLabel: "label",
    topCategory: "category",
    clusterSize: "storyCount",
  };
  for (const [from, to] of Object.entries(remap)) {
    if (from in raw && !(to in raw)) {
      raw[to] = raw[from];
      delete raw[from];
    }
  }
  return raw as unknown as TopicDetail;
}

interface TopicArticleOpts extends PaginationOpts {
  sort?: "newest" | "relevance" | "similarity";
  outlet?: string;
  bias?: string;
  region?: string;
  piOnly?: boolean;
}

export function fetchTopicArticles(
  id: string,
  opts?: TopicArticleOpts,
): Promise<PaginatedResponse<Article>> {
  const params: Record<string, string> = {};
  if (opts?.limit != null) params.limit = String(opts.limit);
  if (opts?.offset != null) params.offset = String(opts.offset);
  if (opts?.sort) params.sort = opts.sort;
  if (opts?.outlet) params.outlet = opts.outlet;
  if (opts?.bias) params.bias = opts.bias;
  if (opts?.region) params.region = opts.region;
  if (opts?.piOnly) params.pi_only = "true";
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
