import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../services/apiClient";
import { ActivityBanner } from "./ActivityBanner";

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

export function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <div>
      <header className="app-header">
        <img
          src="/brand/rv-pigeon-logo-horizontal-dark-on-charcoal.png"
          alt="RV Pigeon"
          className="app-header__logo"
        />
        <nav className="app-header__nav">
          <NavLink to="/" className={navLinkClassName} end>
            Home
          </NavLink>
          <NavLink to="/templates" className={navLinkClassName}>
            Templates
          </NavLink>
          <NavLink to="/trips" className={navLinkClassName}>
            Trips
          </NavLink>
          <NavLink to="/listings" className={navLinkClassName}>
            Listings
          </NavLink>
        </nav>
        <button className="btn-secondary app-header__signout" onClick={handleLogout}>
          Sign out
        </button>
      </header>
      <ActivityBanner />
      <main className="page app-main">
        <Outlet />
      </main>
    </div>
  );
}
