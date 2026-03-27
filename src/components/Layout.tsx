import { Outlet, Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { UserMenu } from "./UserMenu.tsx";

export function Layout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <img
              src="/logo-transparent.png"
              alt="media.games logo"
              style={{ height: 29, width: 29 }}
            />
            <span>
              <span style={{ color: "var(--brand)" }}>media</span>
              <span style={{ color: "var(--text)" }}>.games</span>
            </span>
          </Link>
          <nav style={{ display: "flex", gap: 16 }}>
            <Link
              to="/"
              style={{
                fontSize: 14,
                fontWeight: isActive("/") ? 600 : 400,
                color: isActive("/")
                  ? "var(--text)"
                  : "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Heatmap
            </Link>
            <Link
              to="/piqa"
              style={{
                fontSize: 14,
                fontWeight: isActive("/piqa") ? 600 : 400,
                color: isActive("/piqa")
                  ? "var(--text)"
                  : "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              PI QA
            </Link>
            <Link
              to="/docs"
              style={{
                fontSize: 14,
                fontWeight: isActive("/docs") ? 600 : 400,
                color: isActive("/docs")
                  ? "var(--text)"
                  : "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Docs
            </Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
