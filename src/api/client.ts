import type {
  HeatmapRow,
  HeatmapSummary,
  Topic,
  TopicDetail,
  Article,
  Outlet,
  Freshness,
  PaginatedResponse,
  PiqaStory,
  PiqaAnnotation,
  PiqaFilterOptions,
} from "./types.ts";

import { API_BASE_URL as BASE_URL } from "./config.ts";

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
// Auth token helpers
// ---------------------------------------------------------------------------

function getAccessToken(): string | null {
  return localStorage.getItem("mdg_access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("mdg_refresh_token");
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem("mdg_access_token", access);
  localStorage.setItem("mdg_refresh_token", refresh);
}

function clearTokens() {
  localStorage.removeItem("mdg_access_token");
  localStorage.removeItem("mdg_refresh_token");
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = await res.json();
    storeTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Generic fetcher (with auth header injection + 401 refresh retry)
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url.toString(), { headers });

  // On 401, attempt token refresh and retry once
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(url.toString(), { headers });
    }
  }

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
  timeRange?: string;
  geo?: string[];
  exclSportsEnt?: boolean;
  sort?: string;
  sortDir?: string;
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
  if (opts?.timeRange) params.timeRange = opts.timeRange;
  if (opts?.exclSportsEnt) params.exclSportsEnt = "true";
  if (opts?.geo && opts.geo.length > 0) {
    params.geo = opts.geo.join(",");
  }
  if (opts?.sort) params.sort = opts.sort;
  if (opts?.sortDir) params.sortDir = opts.sortDir;
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
    dominantCategory: "category",
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

// ---------------------------------------------------------------------------
// PI QA
// ---------------------------------------------------------------------------

interface PiqaStoriesOpts {
  storyIds?: string[];
  sample?: "random";
  size?: number;
  category?: string;
  source?: string;
  piLabel?: string;
  model?: string;
  search?: string;
}

export function fetchPiqaStories(
  opts?: PiqaStoriesOpts,
): Promise<{ data: PiqaStory[]; total: number }> {
  const params: Record<string, string> = {};
  if (opts?.storyIds?.length) params.storyIds = opts.storyIds.join(",");
  if (opts?.sample) params.sample = opts.sample;
  if (opts?.size != null) params.size = String(opts.size);
  if (opts?.category) params.category = opts.category;
  if (opts?.source) params.source = opts.source;
  if (opts?.piLabel) params.piLabel = opts.piLabel;
  if (opts?.model) params.model = opts.model;
  if (opts?.search) params.search = opts.search;
  return apiFetch<{ data: PiqaStory[]; total: number }>("/api/piqa/stories", params);
}

export function fetchPiqaFilters(): Promise<PiqaFilterOptions> {
  return apiFetch<PiqaFilterOptions>("/api/piqa/filters");
}

export async function savePiqaAnnotation(annotation: PiqaAnnotation): Promise<{ ok: boolean }> {
  const url = new URL("/api/piqa/annotations", BASE_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
