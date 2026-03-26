import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { AuthApiError } from "../auth/authApi.ts";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === "use_google_login") {
          setError("This account uses Google sign-in. Please use the Google button below.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{
          padding: "8px 12px",
          background: "rgba(192,57,43,0.1)",
          border: "1px solid var(--danger, #c0392b)",
          borderRadius: 6,
          color: "var(--danger, #c0392b)",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--surface-white, var(--bg))",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "none",
  borderRadius: 6,
  background: "var(--brand)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
