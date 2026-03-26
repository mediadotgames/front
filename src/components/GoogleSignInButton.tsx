import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { code: string }) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

export function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();

  const handleClick = useCallback(() => {
    if (!window.google) {
      console.error("Google Identity Services not loaded");
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID not set");
      return;
    }

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "email profile openid",
      callback: async (response) => {
        try {
          await loginWithGoogle(response.code);
        } catch (err) {
          console.error("Google auth failed:", err);
        }
      },
    });

    client.requestCode();
  }, [loginWithGoogle]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 16px",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface-white, var(--bg))",
        color: "var(--text)",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        width: "100%",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Continue with Google
    </button>
  );
}
