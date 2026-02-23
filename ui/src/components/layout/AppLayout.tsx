import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { SearchModal } from '../common/SearchModal';
import { ErrorBoundary } from '../common/ErrorBoundary';

const navItems = [
  { name: 'Dashboard', href: '/', icon: 'fa-house', exact: true },
  { name: 'Reports', href: '/catalog', icon: 'fa-chart-bar' },
  { name: 'Playground', href: '/playground', icon: 'fa-terminal' },
  { name: 'Connections', href: '/connections', icon: 'fa-server' },
  { name: 'Tables', href: '/tables', icon: 'fa-table' },
  { name: 'Data Upload', href: '/upload', icon: 'fa-upload' },
  { name: 'Stream Ingest', href: '/ingest', icon: 'fa-wave-square' },
];

const adminItems = [
  { name: 'Users', href: '/admin/users', icon: 'fa-users' },
  { name: 'Groups', href: '/admin/groups', icon: 'fa-user-group' },
  { name: 'Audit Log', href: '/admin/audit', icon: 'fa-clipboard-list' },
];

// Page title map for document.title
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/catalog': 'Report Catalog',
  '/playground': 'Query Playground',
  '/connections': 'Connections',
  '/tables': 'Tables',
  '/upload': 'Data Upload',
  '/ingest': 'Stream Ingest',
  '/admin/users': 'Users',
  '/admin/groups': 'Groups',
  '/admin/audit': 'Audit Log',
  '/profile': 'My Profile',
};

export function AppLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kinetic-theme') === 'dark');

  // Set document title
  useEffect(() => {
    const base = pageTitles[location.pathname];
    document.title = base ? `${base} — Kinetic` : 'Kinetic';
  }, [location.pathname]);

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('kinetic-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname === href || location.pathname.startsWith(href + '/');

  const isAdmin = user?.groups?.some(g => g.group?.permissions?.some((p: { permissionCode: string }) => p.permissionCode?.includes('admin')));

  return (
    <>
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="kinetic-sidebar">
        {/* Logo */}
        <div className="p-3 border-bottom d-flex align-items-center gap-2">
          <img src="/favicon.png" alt="" width={32} height={32} style={{ borderRadius: 6 }} />
          <img src="/logo-full.png" alt="Kinetic" height={28} style={{ maxWidth: 120, objectFit: 'contain' }} />
        </div>

        {/* Search shortcut */}
        <div className="px-3 pt-3 pb-1">
          <button
            className="btn btn-light w-100 d-flex align-items-center gap-2 text-muted border"
            style={{ fontSize: '0.825rem' }}
            onClick={() => setSearchOpen(true)}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
            <span className="flex-grow-1 text-start">Search…</span>
            <kbd className="small" style={{ fontSize: '0.7rem', background: '#e9ecef', padding: '1px 5px', borderRadius: 3 }}>⌘K</kbd>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-grow-1 p-2 overflow-auto">
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {navItems.map(item => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`kinetic-nav-link ${isActive(item.href, item.exact) ? 'active' : ''}`}
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          {/* Admin section — only for admins */}
          {isAdmin && (
            <div className="mt-3 pt-3 border-top">
              <div className="px-2 mb-1" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb5bd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Admin
              </div>
              <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {adminItems.map(item => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={`kinetic-nav-link ${isActive(item.href) ? 'active' : ''}`}
                    >
                      <i className={`fa-solid ${item.icon}`}></i>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-top">
          <div className="d-flex align-items-center gap-2 mb-2">
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}
            >
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-grow-1 overflow-hidden">
              <div className="fw-semibold small text-truncate">{user?.displayName}</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }} >{user?.email}</div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Link to="/profile" className="btn btn-light btn-sm flex-grow-1">
              <i className="fa-solid fa-gear me-1"></i>Profile
            </Link>
            <button
              className="btn btn-light btn-sm"
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button className="btn btn-light btn-sm" onClick={logout} title="Sign out">
              <i className="fa-solid fa-right-from-bracket text-danger"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile offcanvas sidebar ─── */}
      <div className="offcanvas offcanvas-start d-lg-none" tabIndex={-1} id="mobileSidebar" style={{ width: 260 }}>
        <div className="offcanvas-header border-bottom">
          <div className="d-flex align-items-center gap-2">
            <img src="/logo.svg" alt="Kinetic" width={28} height={28} />
            <span className="fw-bold fs-5 text-primary">Kinetic</span>
          </div>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" />
        </div>
        <div className="offcanvas-body p-2">
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {navItems.map(item => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`kinetic-nav-link ${isActive(item.href, item.exact) ? 'active' : ''}`}
                  data-bs-dismiss="offcanvas"
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <div className="mt-3 pt-3 border-top">
              <div className="px-2 mb-1" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb5bd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin</div>
              <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {adminItems.map(item => (
                  <li key={item.href}>
                    <Link to={item.href} className={`kinetic-nav-link ${isActive(item.href) ? 'active' : ''}`} data-bs-dismiss="offcanvas">
                      <i className={`fa-solid ${item.icon}`}></i>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main area ─── */}
      <div className="kinetic-main">
        {/* Top bar */}
        <header className="kinetic-topbar">
          <button
            className="btn btn-light d-lg-none me-2"
            data-bs-toggle="offcanvas"
            data-bs-target="#mobileSidebar"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="flex-grow-1" />
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-light btn-sm d-none d-sm-inline-flex align-items-center gap-1" onClick={() => setSearchOpen(true)}>
              <i className="fa-solid fa-magnifying-glass"></i>
              <span className="d-none d-md-inline text-muted small ms-1">Search</span>
            </button>
            <button className="btn btn-light btn-sm position-relative">
              <i className="fa-solid fa-bell"></i>
            </button>
            <Link to="/profile" className="btn btn-light btn-sm">
              <div className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center" style={{ width: 24, height: 24, fontSize: '0.7rem', fontWeight: 700 }}>
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 flex-grow-1">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global search modal */}
      <SearchModal show={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
