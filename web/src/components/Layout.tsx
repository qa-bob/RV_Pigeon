import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../services/apiClient";

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  marginRight: "1rem",
  fontWeight: isActive ? "bold" : "normal",
});

export function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
          borderBottom: "1px solid #ddd",
        }}
      >
        <nav>
          <NavLink to="/" style={navLinkStyle} end>
            Home
          </NavLink>
          <NavLink to="/templates" style={navLinkStyle}>
            Templates
          </NavLink>
          <NavLink to="/trips" style={navLinkStyle}>
            Trips
          </NavLink>
          <NavLink to="/listings" style={navLinkStyle}>
            Listings
          </NavLink>
        </nav>
        <button onClick={handleLogout}>Sign out</button>
      </header>
      <main style={{ padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
