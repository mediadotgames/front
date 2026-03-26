import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { SignupForm } from "../components/SignupForm.tsx";
import { GoogleSignInButton } from "../components/GoogleSignInButton.tsx";

export function SignupPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div style={{ maxWidth: 400, margin: "60px auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Create account</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
        Join media.games to save your dashboard preferences and contribute to quality assurance.
      </p>

      <SignupForm />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "20px 0",
          color: "var(--text-tertiary)",
          fontSize: 12,
        }}
      >
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
        or
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
      </div>

      <GoogleSignInButton />

      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 20, textAlign: "center" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--brand)", textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
