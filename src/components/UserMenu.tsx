import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";

export function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!isAuthenticated || !user) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <Link
          to="/login"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--brand)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {initials}
        </span>
        {user.displayName}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 180,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 4,
            zIndex: 200,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
            {user.email}
          </div>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
            Role: {user.role}
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <Link
            to="/preferences"
            onClick={() => setOpen(false)}
            style={menuItemStyle}
          >
            Preferences
          </Link>
          <button
            onClick={() => { setOpen(false); logout(); }}
            style={{ ...menuItemStyle, width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text)",
  textDecoration: "none",
  borderRadius: 4,
};
