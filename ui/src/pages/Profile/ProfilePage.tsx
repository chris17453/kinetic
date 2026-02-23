import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/common/Toast';
import api from '../../lib/api/client';
import { Breadcrumb } from '../../components/common';
import type { UserGroup } from '../../lib/api/types';

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

type TabId = 'profile' | 'security' | 'preferences' | 'groups';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'profile',     label: 'Profile',     icon: 'fa-user' },
  { id: 'security',    label: 'Security',    icon: 'fa-shield-halved' },
  { id: 'preferences', label: 'Preferences', icon: 'fa-sliders' },
  { id: 'groups',      label: 'Groups',      icon: 'fa-user-group' },
];

const ROLE_BADGE: Record<string, string> = {
  Owner:   'bg-danger',
  Manager: 'bg-warning text-dark',
  Member:  'bg-secondary',
};

export function ProfilePage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const [form, setForm] = useState({
    displayName: user?.displayName ?? '',
    email:       user?.email ?? '',
    department:  '',
    timezone:    'UTC',
    themeMode:   'system' as 'system' | 'light' | 'dark',
    notifyEmail:   true,
    notifyInApp:   true,
    notifyDigest:  false,
  });

  const [passwords, setPasswords] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  /* ------------------------------------------------------------------ */
  /* Queries & mutations                                                  */
  /* ------------------------------------------------------------------ */

  useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then(r => {
      setForm(f => ({
        ...f,
        displayName: r.data.displayName ?? f.displayName,
        email:       r.data.email       ?? f.email,
        department:  r.data.department?.name ?? '',
        timezone:    r.data.timezone    ?? 'UTC',
      }));
      return r.data;
    }),
  });

  const { data: groupsData } = useQuery({
    queryKey: ['me', 'groups'],
    queryFn: () => api.get('/users/me/groups').then(r => r.data as UserGroup[]),
    enabled: activeTab === 'groups',
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.put('/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated', 'Your changes have been saved.');
    },
    onError: (e: Error) => toast.error('Save failed', e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/users/me/password', data),
    onSuccess: () => {
      setPasswords({ current: '', newPwd: '', confirm: '' });
      setPwError('');
      toast.success('Password updated', 'Your password has been changed successfully.');
    },
    onError: (e: Error) => setPwError(e.message),
  });

  /* ------------------------------------------------------------------ */
  /* Handlers                                                             */
  /* ------------------------------------------------------------------ */

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPwd !== passwords.confirm) {
      setPwError("Passwords don't match");
      return;
    }
    if (passwords.newPwd.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    setPwError('');
    passwordMutation.mutate({ currentPassword: passwords.current, newPassword: passwords.newPwd });
  };

  const handleThemeMode = (mode: 'system' | 'light' | 'dark') => {
    setForm(f => ({ ...f, themeMode: mode }));
    if (mode !== 'system') {
      document.documentElement.setAttribute('data-bs-theme', mode);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-bs-theme', prefersDark ? 'dark' : 'light');
    }
  };

  /* ------------------------------------------------------------------ */
  /* Derived values                                                       */
  /* ------------------------------------------------------------------ */

  const initials = (user?.displayName ?? 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const groups: UserGroup[] = groupsData ?? user?.groups ?? [];

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'My Profile' }]} />

      {/* Page header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <div
          className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
          style={{ width: 64, height: 64, fontSize: '1.5rem' }}
          aria-label={`Avatar for ${user?.displayName}`}
        >
          {initials}
        </div>
        <div>
          <h4 className="fw-bold mb-0">{user?.displayName}</h4>
          <p className="text-muted small mb-0">{user?.email}</p>
        </div>
      </div>

      {/* Nav tabs */}
      <ul className="nav nav-tabs mb-4" role="tablist">
        {TABS.map(tab => (
          <li key={tab.id} className="nav-item" role="presentation">
            <button
              className={`nav-link${activeTab === tab.id ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fa-solid ${tab.icon} me-2`}></i>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* ---------------------------------------------------------------- */}
      {/* Profile tab                                                       */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'profile' && (
        <div className="card border-0 shadow-sm" style={{ maxWidth: 640 }}>
          <div className="card-header bg-white border-bottom">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-user me-2 text-primary"></i>
              Profile Information
            </h6>
          </div>
          <div className="card-body p-4">
            <form
              onSubmit={e => { e.preventDefault(); updateMutation.mutate(form); }}
            >
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-medium">Display Name</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-user text-muted"></i>
                    </span>
                    <input
                      className="form-control"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-medium">Email address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-envelope text-muted"></i>
                    </span>
                    <input
                      className="form-control"
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      disabled={user?.provider === 'Entra'}
                    />
                  </div>
                  {user?.provider === 'Entra' && (
                    <div className="form-text">
                      <i className="fa-solid fa-circle-info me-1"></i>
                      Managed by Microsoft Entra ID
                    </div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-medium">Department</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-building text-muted"></i>
                    </span>
                    <input
                      className="form-control"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="e.g. Engineering"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-medium">Timezone</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-clock text-muted"></i>
                    </span>
                    <select
                      className="form-select"
                      value={form.timezone}
                      onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                    >
                      {timezones.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk me-2"></i>
                      Save changes
                    </>
                  )}
                </button>
                {updateMutation.isSuccess && (
                  <span className="d-flex align-items-center text-success small">
                    <i className="fa-solid fa-circle-check me-1"></i>
                    Saved
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Security tab                                                      */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'security' && (
        <div className="card border-0 shadow-sm" style={{ maxWidth: 500 }}>
          <div className="card-header bg-white border-bottom">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-shield-halved me-2 text-primary"></i>
              Security
            </h6>
          </div>
          <div className="card-body p-4">
            {user?.provider === 'Entra' ? (
              <div className="alert alert-info d-flex align-items-start gap-2">
                <i className="fa-solid fa-circle-info mt-1"></i>
                <div>
                  <strong>Managed externally</strong>
                  <p className="mb-0 small">
                    Your password is managed by Microsoft Entra ID. Please visit the Microsoft
                    portal to change it.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <h6 className="fw-semibold mb-3">Change password</h6>

                {pwError && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                    <i className="fa-solid fa-circle-xmark"></i>
                    <span>{pwError}</span>
                  </div>
                )}

                {passwordMutation.isSuccess && (
                  <div className="alert alert-success d-flex align-items-center gap-2 py-2 mb-3">
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Password changed successfully.</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit}>
                  <div className="mb-3">
                    <label className="form-label fw-medium">Current password</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="fa-solid fa-lock text-muted"></i>
                      </span>
                      <input
                        type="password"
                        className="form-control"
                        value={passwords.current}
                        onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium">New password</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="fa-solid fa-lock text-muted"></i>
                      </span>
                      <input
                        type="password"
                        className="form-control"
                        value={passwords.newPwd}
                        onChange={e => setPasswords(p => ({ ...p, newPwd: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-medium">Confirm new password</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="fa-solid fa-lock text-muted"></i>
                      </span>
                      <input
                        type="password"
                        className="form-control"
                        value={passwords.confirm}
                        onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      passwordMutation.isPending ||
                      !passwords.current ||
                      !passwords.newPwd
                    }
                  >
                    {passwordMutation.isPending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Updating…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-key me-2"></i>
                        Update password
                      </>
                    )}
                  </button>
                </form>

                {/* 2FA placeholder */}
                <hr className="my-4" />
                <h6 className="fw-semibold mb-2">Two-factor authentication</h6>
                <p className="text-muted small mb-3">
                  Add an extra layer of security to your account by enabling two-factor
                  authentication.
                </p>
                <button className="btn btn-outline-secondary" disabled>
                  <i className="fa-solid fa-mobile-screen-button me-2"></i>
                  Set up 2FA
                  <span className="badge bg-secondary ms-2">Coming soon</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Preferences tab                                                   */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'preferences' && (
        <div className="card border-0 shadow-sm" style={{ maxWidth: 500 }}>
          <div className="card-header bg-white border-bottom">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-sliders me-2 text-primary"></i>
              Preferences
            </h6>
          </div>
          <div className="card-body p-4">
            {/* Theme */}
            <div className="mb-4">
              <label className="form-label fw-medium d-block mb-2">
                <i className="fa-solid fa-palette me-2 text-muted"></i>
                Appearance
              </label>
              <div className="btn-group" role="group" aria-label="Theme mode">
                {(['light', 'dark', 'system'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn-sm ${form.themeMode === mode ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handleThemeMode(mode)}
                  >
                    <i
                      className={`fa-solid ${
                        mode === 'light'
                          ? 'fa-sun'
                          : mode === 'dark'
                          ? 'fa-moon'
                          : 'fa-circle-half-stroke'
                      } me-1`}
                    ></i>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="mb-4">
              <label className="form-label fw-medium d-block mb-2">
                <i className="fa-solid fa-bell me-2 text-muted"></i>
                Notification preferences
              </label>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="notifyEmail"
                  checked={form.notifyEmail}
                  onChange={e => setForm(f => ({ ...f, notifyEmail: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="notifyEmail">
                  Email notifications
                  <span className="d-block text-muted small">
                    Receive important alerts and report results by email.
                  </span>
                </label>
              </div>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="notifyInApp"
                  checked={form.notifyInApp}
                  onChange={e => setForm(f => ({ ...f, notifyInApp: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="notifyInApp">
                  In-app notifications
                  <span className="d-block text-muted small">
                    Show notifications inside the Kinetic interface.
                  </span>
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="notifyDigest"
                  checked={form.notifyDigest}
                  onChange={e => setForm(f => ({ ...f, notifyDigest: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="notifyDigest">
                  Weekly digest
                  <span className="d-block text-muted small">
                    Receive a weekly summary of your reports and activity.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk me-2"></i>
                  Save preferences
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Groups tab                                                        */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div className="card border-0 shadow-sm" style={{ maxWidth: 700 }}>
          <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-user-group me-2 text-primary"></i>
              Group Memberships
            </h6>
            <span className="badge bg-secondary rounded-pill">
              {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="card-body text-center py-5">
              <i className="fa-solid fa-user-group fa-2x text-muted mb-3 d-block"></i>
              <p className="text-muted mb-0">You are not a member of any groups yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">Role</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(ug => {
                    const grp = ug.group;
                    return (
                      <tr key={ug.groupId}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 34, height: 34 }}
                            >
                              <i className="fa-solid fa-user-group text-primary small"></i>
                            </div>
                            <div>
                              <div className="fw-medium">{grp?.name ?? ug.groupId}</div>
                              {grp?.description && (
                                <div className="text-muted small">{grp.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[ug.role] ?? 'bg-secondary'}`}>
                            {ug.role}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {grp?.permissions?.length ?? 0} permissions
                          </span>
                        </td>
                        <td className="text-muted small">
                          {new Date(ug.joinedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
