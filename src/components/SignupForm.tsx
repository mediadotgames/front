import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { AuthApiError } from "../auth/authApi.ts";

export function SignupForm() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, displayName);
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === "email_taken") {
          setError("An account with this email already exists. Try signing in.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Sign up failed. Please try again.");
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
        type="text"
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        maxLength={100}
        style={inputStyle}
      />
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
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        maxLength={128}
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Creating account..." : "Create account"}
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
