import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';
import { usePermissions } from '../../hooks/usePermissions';
import { SearchModal } from '../common/SearchModal';
import { ErrorBoundary } from '../common/ErrorBoundary';

const navItems = [
  { name: 'Home', href: '/', icon: 'fa-house', exact: true },
  { name: 'Workspaces', href: '/workspaces', icon: 'fa-briefcase' },
  { name: 'Datasets', href: '/datasets', icon: 'fa-cubes' },
  { name: 'Dashboards', href: '/dashboards', icon: 'fa-gauge-high' },
  { name: 'Reports', href: '/catalog', icon: 'fa-chart-bar' },
  { name: 'Playground', href: '/playground', icon: 'fa-terminal' },
  { name: 'Connections', href: '/connections', icon: 'fa-server' },
  { name: 'Tables', href: '/tables', icon: 'fa-table' },
  { name: 'Data Upload', href: '/upload', icon: 'fa-upload' },
  { name: 'Stream Ingest', href: '/ingest', icon: 'fa-wave-square' },
  { name: 'Refresh', href: '/refresh', icon: 'fa-rotate' },
];

const adminItems = [
  { name: 'Users', href: '/admin/users', icon: 'fa-users' },
  { name: 'Groups', href: '/admin/groups', icon: 'fa-user-group' },
  { name: 'Integrations', href: '/admin/integrations', icon: 'fa-plug-circle-bolt' },
  { name: 'Audit Log', href: '/admin/audit', icon: 'fa-clipboard-list' },
  { name: 'Organization', href: '/admin/organization', icon: 'fa-building' },
];

// Page title map for document.title
const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/workspaces': 'Workspaces',
  '/datasets': 'Datasets',
  '/dashboards': 'Dashboards',
  '/catalog': 'Report Catalog',
  '/playground': 'Query Playground',
  '/connections': 'Connections',
  '/tables': 'Tables',
  '/upload': 'Data Upload',
  '/ingest': 'Stream Ingest',
  '/refresh': 'Refresh Operations',
  '/enterprise': 'Enterprise Center',
  '/enterprise/signals': 'Signals',
  '/enterprise/ontology': 'Ontology Governance',
  '/admin/users': 'Users',
  '/admin/groups': 'Groups',
  '/admin/integrations': 'Integrations',
  '/admin/audit': 'Audit Log',
  '/admin/organization': 'Organization',
  '/profile': 'My Profile',
};

function NavSection({
  title,
  collapsed,
  items,
  isActive,
}: {
  title: string;
  collapsed: boolean;
  items: Array<{ name: string; href: string; icon: string; exact?: boolean }>;
  isActive: (href: string, exact?: boolean) => boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <div className={`px-2 mb-2 kinetic-sidebar-section-title ${collapsed ? 'd-none' : ''}`}>{title}</div>
      <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
        {items.map(item => (
          <li key={item.href}>
            <Link
              to={item.href}
              className={`kinetic-nav-link ${collapsed ? 'collapsed' : ''} ${isActive(item.href, item.exact) ? 'active' : ''}`}
              title={item.name}
              aria-label={item.name}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span className={`kinetic-sidebar-label ${collapsed ? 'd-none' : ''}`}>{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const {
    canManageUsers,
    canManageGroups,
    canViewAudit,
    canViewEnterpriseCenter,
    canCreateReports,
    canRunReports,
    canManageReports,
    canCreateConnections,
    canManageConnections,
    canUploadData,
  } = usePermissions();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const { branding, toggleDarkMode } = useBrandingStore();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kinetic-theme') !== 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kinetic-sidebar-collapsed') === 'true');
  const hasStoredToken = Boolean(localStorage.getItem('kinetic_token'));

  // Set document title
  useEffect(() => {
    const appName = branding?.orgName || 'Kinetic';
    const base = pageTitles[location.pathname];
    document.title = base ? `${base} — ${appName}` : appName;
  }, [location.pathname, branding?.orgName]);

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('kinetic-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('kinetic-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

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

  if (!isAuthenticated && hasStoredToken) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname === href || location.pathname.startsWith(href + '/');

  const isAdmin = canManageUsers || canManageGroups || canViewAudit;
  const isCreator =
    canCreateReports ||
    canManageReports ||
    canCreateConnections ||
    canManageConnections ||
    canUploadData;
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/catalog') return canCreateReports || canRunReports || canManageReports;
    if (item.href === '/connections') return canCreateConnections || canManageConnections;
    if (item.href === '/upload') return canUploadData;
    return true;
  });
  const browseNavItems = visibleNavItems.filter((item) =>
    ['/', '/workspaces', '/datasets', '/dashboards', '/catalog'].includes(item.href),
  );
  const creatorNavItems = visibleNavItems.filter((item) =>
    ['/playground', '/connections', '/tables', '/upload', '/ingest', '/refresh'].includes(item.href),
  );
  const browseNavTitle = isCreator ? 'Browse' : 'Consumer';
  const creatorNavTitle = 'Creator tools';
  const governanceNavItems = canViewEnterpriseCenter
    ? [
        { name: 'Enterprise Center', href: '/enterprise', icon: 'fa-compass-drafting' },
        { name: 'Signals', href: '/enterprise/signals', icon: 'fa-signal' },
        { name: 'Ontology', href: '/enterprise/ontology', icon: 'fa-diagram-project' },
      ]
    : [];
  const mainBackgroundStyle = branding?.dashboardBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(rgba(8, 15, 29, 0.96), rgba(8, 15, 29, 0.94)), url(${branding.dashboardBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <>
      {/* ─── Sidebar (desktop) ─── */}
      <aside className={`kinetic-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="p-3 border-bottom kinetic-sidebar-brand">
          <Link
            to="/"
            className={`d-flex text-decoration-none text-reset ${sidebarCollapsed ? 'justify-content-center' : 'align-items-center gap-3'}`}
            aria-label="Kinetic home"
          >
            <div className="kinetic-brand-mark flex-shrink-0">
              {branding?.faviconUrl ? (
                <img src={branding.faviconUrl} alt="" width={24} height={24} style={{ borderRadius: 6, objectFit: 'cover' }} />
              ) : (
                <i className="fa-solid fa-chart-column text-white"></i>
              )}
            </div>
            <div className={`min-width-0 ${sidebarCollapsed ? 'd-none' : ''}`}>
              <div className="text-uppercase fw-semibold text-muted kinetic-eyebrow">
                Enterprise BI
              </div>
              {branding?.useTextLogo ? (
                <div
                  style={{
                    fontFamily: branding.logoTextFont || 'Inter, system-ui, sans-serif',
                    fontSize: branding.logoTextSize || '1.25rem',
                    color: darkMode ? (branding.logoTextDarkColor || '#93c5fd') : (branding.logoTextColor || '#1f2937'),
                    fontWeight: 800,
                    lineHeight: 1.05,
                  }}
                >
                  {branding.logoText || branding.orgName || 'Kinetic'}
                </div>
              ) : branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.orgName || 'Kinetic'} height={28} style={{ maxWidth: 140, objectFit: 'contain' }} />
              ) : (
                <div className="fw-bold fs-5" style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}>Kinetic</div>
              )}
            </div>
          </Link>
          <button
            type="button"
            className="btn btn-sm kinetic-sidebar-toggle ms-auto"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className={`kinetic-shell-chip ${sidebarCollapsed ? 'justify-content-center' : ''}`}>
            <i className="fa-solid fa-layer-group"></i>
            <span className={sidebarCollapsed ? 'd-none' : ''}>{isCreator ? 'Creator workspace' : 'Consumer workspace'}</span>
          </div>
        </div>

        {/* Search shortcut */}
        <div className="px-3 pb-1">
          <button
            className="kinetic-search-button w-100 d-flex align-items-center gap-2"
            onClick={() => setSearchOpen(true)}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
            <span className={`flex-grow-1 text-start kinetic-sidebar-label ${sidebarCollapsed ? 'd-none' : ''}`}>Search reports, workspaces, data</span>
            <kbd className={`small kinetic-kbd ${sidebarCollapsed ? 'd-none' : ''}`}>⌘K</kbd>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-grow-1 p-2 overflow-auto kinetic-sidebar-nav">
          <NavSection
            title={browseNavTitle}
            collapsed={sidebarCollapsed}
            items={browseNavItems}
            isActive={isActive}
          />
          {isCreator && (
            <NavSection
              title={creatorNavTitle}
              collapsed={sidebarCollapsed}
              items={creatorNavItems}
              isActive={isActive}
            />
          )}
          {governanceNavItems.length > 0 && (
            <NavSection
              title="Governance"
              collapsed={sidebarCollapsed}
              items={governanceNavItems}
              isActive={isActive}
            />
          )}
          {isAdmin && (
            <NavSection
              title="Admin"
              collapsed={sidebarCollapsed}
              items={adminItems}
              isActive={isActive}
            />
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-top border-secondary-subtle kinetic-sidebar-footer">
          <div className={`d-flex ${sidebarCollapsed ? 'justify-content-center' : 'align-items-center gap-2'} mb-2`}>
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}
            >
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={`flex-grow-1 overflow-hidden kinetic-sidebar-label ${sidebarCollapsed ? 'd-none' : ''}`}>
              <div className="fw-semibold small text-truncate">{user?.displayName}</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>{user?.email}</div>
            </div>
          </div>
          <div className={`d-flex ${sidebarCollapsed ? 'justify-content-center' : 'gap-2'}`}>
            <Link to="/profile" className={`btn btn-sm kinetic-sidebar-action ${sidebarCollapsed ? '' : 'flex-grow-1'}`}>
              <i className="fa-solid fa-gear me-1"></i><span className={sidebarCollapsed ? 'd-none' : ''}>Profile</span>
            </Link>
            <button
              className="btn btn-sm kinetic-sidebar-action"
              onClick={() => { setDarkMode(d => !d); toggleDarkMode(); }}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button className="btn btn-sm kinetic-sidebar-action" onClick={logout} title="Sign out">
              <i className="fa-solid fa-right-from-bracket text-danger"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile offcanvas sidebar ─── */}
      <div className="offcanvas offcanvas-start d-lg-none" tabIndex={-1} id="mobileSidebar" style={{ width: 260 }}>
        <div className="offcanvas-header border-bottom">
          <Link to="/" className="d-flex align-items-center gap-3 text-decoration-none text-reset">
            <div className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0" style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #0f172a 0%, #2563eb 55%, #38bdf8 100%)', boxShadow: '0 12px 32px rgba(37, 99, 235, 0.28)' }}>
              <i className="fa-solid fa-chart-column text-white"></i>
            </div>
            <div className="min-width-0">
              <div className="text-uppercase fw-semibold text-muted" style={{ fontSize: '0.66rem', letterSpacing: '0.18em' }}>
                Enterprise BI
              </div>
              {branding?.useTextLogo ? (
                <div style={{
                  fontFamily: branding.logoTextFont || 'Inter, system-ui, sans-serif',
                  fontSize: branding.logoTextSize || '1.35rem',
                  color: branding.logoTextColor || '#1f2937',
                  fontWeight: 800,
                  lineHeight: 1.05,
                }}>
                  {branding.logoText || branding.orgName || 'Kinetic'}
                </div>
              ) : branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.orgName || 'Kinetic'} height={28} style={{ maxWidth: 140, objectFit: 'contain' }} />
              ) : (
                <div className="fw-bold fs-5" style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}>Kinetic</div>
              )}
            </div>
          </Link>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" />
        </div>
        <div className="offcanvas-body p-2">
          <div className="px-2 mb-1" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb5bd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{browseNavTitle}</div>
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {browseNavItems.map(item => (
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
          {creatorNavItems.length > 0 && (
            <div className="mt-3 pt-3 border-top">
              <div className="px-2 mb-1" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb5bd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{creatorNavTitle}</div>
              <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {creatorNavItems.map(item => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={`kinetic-nav-link ${isActive(item.href) ? 'active' : ''}`}
                      data-bs-dismiss="offcanvas"
                    >
                      <i className={`fa-solid ${item.icon}`}></i>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {governanceNavItems.length > 0 && (
            <div className="mt-3 pt-3 border-top">
              <div className="px-2 mb-1" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb5bd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Governance</div>
              <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {governanceNavItems.map(item => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={`kinetic-nav-link ${isActive(item.href) ? 'active' : ''}`}
                      data-bs-dismiss="offcanvas"
                    >
                      <i className={`fa-solid ${item.icon}`}></i>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            className="btn btn-light btn-sm me-2 d-none d-lg-inline-flex"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
          </button>
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
        <main className="p-4 flex-grow-1" style={mainBackgroundStyle}>
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
