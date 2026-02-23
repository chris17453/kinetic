import { useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const navigate = useNavigate();
  const { login, loginWithEntra, isLoading, error, clearError } = useAuthStore();
  const { branding, fetchBranding } = useBrandingStore();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => { if (orgSlug) fetchBranding(orgSlug); }, [orgSlug, fetchBranding]);

  const onSubmit = async (data: LoginFormValues) => {
    try { await login(data.email, data.password); navigate('/'); } catch {}
  };

  const primaryColor = branding?.primaryColor || '#2563EB';
  const orgName = branding?.orgName || 'Kinetic';
  const allowLocal = branding?.allowLocalUsers ?? true;
  const allowEntra = branding?.allowEntraId ?? true;

  return (
    <div className="min-vh-100 d-flex">
      {/* Left brand panel - hidden on mobile */}
      <div
        className="d-none d-lg-flex flex-column justify-content-between p-5 text-white"
        style={{ width: '45%', background: `linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%)` }}
      >
        <div className="d-flex align-items-center">
          <img src="/logo-full.png" alt={orgName} height={42} style={{ maxWidth: 180, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div>
          <h2 className="fw-bold display-6 mb-3">Powerful reporting,<br />built for your team.</h2>
          <p className="opacity-75">Connect any database, build reports in minutes, and share insights with your entire organization.</p>
          <div className="mt-4 d-flex flex-column gap-2">
            {['Multi-database support', 'Real-time query execution', 'Beautiful visualizations', 'Role-based access control'].map(f => (
              <div key={f} className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-circle-check opacity-75"></i>
                <span className="small opacity-90">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="small opacity-50 mb-0">© {new Date().getFullYear()} Kinetic Reports</p>
      </div>

      {/* Right form panel */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 bg-light">
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <div className="d-lg-none text-center mb-4">
            <img src="/logo-full.png" alt={orgName} height={40} style={{ maxWidth: 160, objectFit: 'contain' }} />
          </div>

          <div className="card border-0 shadow-sm p-4">
            <h4 className="fw-bold mb-1">Sign in</h4>
            <p className="text-muted small mb-4">Enter your credentials to access your account</p>

            {error && (
              <div className="alert alert-danger alert-dismissible d-flex align-items-center gap-2 py-2 mb-3">
                <i className="fa-solid fa-circle-xmark"></i>
                <span>{error}</span>
                <button type="button" className="btn-close" onClick={clearError}></button>
              </div>
            )}

            {allowLocal && (
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="mb-3">
                  <label className="form-label fw-medium">Email address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="fa-solid fa-envelope text-muted"></i></span>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      placeholder="you@example.com"
                      {...register('email')}
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label fw-medium mb-0">Password</label>
                    <Link to="/forgot-password" className="small text-decoration-none" style={{ color: primaryColor }}>Forgot password?</Link>
                  </div>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="fa-solid fa-lock text-muted"></i></span>
                    <input
                      type="password"
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      placeholder="••••••••"
                      {...register('password')}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                  </div>
                </div>
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="remember" />
                  <label className="form-check-label small" htmlFor="remember">Remember me</label>
                </div>
                <button
                  type="submit"
                  className="btn w-100 text-white fw-semibold"
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  disabled={isLoading}
                >
                  {isLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in…</> : <><i className="fa-solid fa-right-to-bracket me-2"></i>Sign in</>}
                </button>
              </form>
            )}

            {allowLocal && allowEntra && (
              <div className="d-flex align-items-center gap-2 my-3">
                <hr className="flex-grow-1 m-0" />
                <span className="text-muted small">or</span>
                <hr className="flex-grow-1 m-0" />
              </div>
            )}

            {allowEntra && (
              <button
                onClick={() => loginWithEntra()}
                className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 21 21">
                  <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                </svg>
                Sign in with Microsoft
              </button>
            )}

            {allowLocal && (
              <p className="text-center text-muted small mt-3 mb-0">
                Don't have an account?{' '}
                <Link to="/register" className="fw-medium text-decoration-none" style={{ color: primaryColor }}>Create account</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
