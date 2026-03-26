import type { AuthTokens, AuthUser } from "../api/types.ts";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function authFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new AuthApiError(res.status, err.error, err.message);
  }

  return res.json() as Promise<T>;
}

export class AuthApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, msg?: string) {
    super(msg ?? code);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiSignup(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthTokens> {
  return authFetch<AuthTokens>("/api/auth/signup", {
    body: { email, password, displayName },
  });
}

export function apiLogin(
  email: string,
  password: string,
): Promise<AuthTokens> {
  return authFetch<AuthTokens>("/api/auth/login", {
    body: { email, password },
  });
}

export function apiGoogleAuth(code: string): Promise<AuthTokens> {
  return authFetch<AuthTokens>("/api/auth/google", { body: { code } });
}

export function apiRefresh(refreshToken: string): Promise<AuthTokens> {
  return authFetch<AuthTokens>("/api/auth/refresh", {
    body: { refreshToken },
  });
}

export function apiLogout(refreshToken: string): Promise<{ ok: boolean }> {
  return authFetch<{ ok: boolean }>("/api/auth/logout", {
    body: { refreshToken },
  });
}

export function apiGetMe(token: string): Promise<AuthUser> {
  return authFetch<AuthUser>("/api/auth/me", { method: "GET", token });
}

export function apiUpdatePreferences(
  token: string,
  preferences: Record<string, unknown>,
): Promise<{ preferences: Record<string, unknown> }> {
  return authFetch<{ preferences: Record<string, unknown> }>(
    "/api/users/preferences",
    { method: "PUT", body: { preferences }, token },
  );
}
