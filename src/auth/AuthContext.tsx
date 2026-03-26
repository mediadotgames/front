import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser } from "../api/types.ts";
import {
  apiSignup,
  apiLogin,
  apiGoogleAuth,
  apiRefresh,
  apiLogout,
  apiGetMe,
  apiUpdatePreferences,
} from "./authApi.ts";

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const ACCESS_KEY = "mdg_access_token";
const REFRESH_KEY = "mdg_refresh_token";

function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  loginWithGoogle: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (prefs: Record<string, unknown>) => Promise<void>;
  getAccessToken: () => string | null;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: validate existing token or attempt refresh
  useEffect(() => {
    (async () => {
      const accessToken = getStoredAccessToken();
      if (accessToken) {
        try {
          const me = await apiGetMe(accessToken);
          setUser(me);
          setIsLoading(false);
          return;
        } catch {
          // Access token expired — try refresh
        }
      }

      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        try {
          const tokens = await apiRefresh(refreshToken);
          storeTokens(tokens.accessToken, tokens.refreshToken);
          setUser(tokens.user);
        } catch {
          clearTokens();
        }
      }

      setIsLoading(false);
    })();
  }, []);

  const handleTokenResponse = useCallback(
    (tokens: { accessToken: string; refreshToken: string; user: AuthUser }) => {
      storeTokens(tokens.accessToken, tokens.refreshToken);
      setUser(tokens.user);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiLogin(email, password);
      handleTokenResponse(tokens);
    },
    [handleTokenResponse],
  );

  const signup = useCallback(
    async (email: string, password: string, displayName: string) => {
      const tokens = await apiSignup(email, password, displayName);
      handleTokenResponse(tokens);
    },
    [handleTokenResponse],
  );

  const loginWithGoogle = useCallback(
    async (code: string) => {
      const tokens = await apiGoogleAuth(code);
      handleTokenResponse(tokens);
    },
    [handleTokenResponse],
  );

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // Best-effort
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const updatePreferences = useCallback(
    async (prefs: Record<string, unknown>) => {
      const token = getStoredAccessToken();
      if (!token || !user) throw new Error("Not authenticated");
      const result = await apiUpdatePreferences(token, prefs);
      setUser((prev) =>
        prev ? { ...prev, preferences: result.preferences } : null,
      );
    },
    [user],
  );

  const getAccessToken = useCallback(() => getStoredAccessToken(), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithGoogle,
        logout,
        updatePreferences,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
