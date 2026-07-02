import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';

const registerSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const strengthCriteria = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
];

const STRENGTH_COLOR = ['danger', 'warning', 'warning', 'success'] as const;
const STRENGTH_LABEL = ['Weak', 'Fair', 'Good', 'Strong'] as const;
const STRENGTH_BAR_COLOR: Record<string, string> = {
  danger: '#dc3545',
  warning: '#fd7e14',
  success: '#198754',
};

export function RegisterPage() {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register: registerUser, isLoading } = useAuthStore() as any;
  const { branding } = useBrandingStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const password = watch('password', '');

  const metCount = strengthCriteria.filter(c => c.test(password)).length;
  const strengthColor = STRENGTH_COLOR[metCount] ?? 'danger';
  const strengthLabel = STRENGTH_LABEL[metCount] ?? 'Weak';
  const primaryColor = branding?.primaryColor || '#2563EB';
  const orgName = branding?.orgName || 'Enterprise';

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      await registerUser(data.email, data.password, data.displayName);
      navigate('/');
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  return (
    <div className="min-vh-100 d-flex">
      {/* Left brand panel — hidden on mobile */}
      <div
        className="d-none d-lg-flex flex-column align-items-center justify-content-center text-white p-5"
        style={{
          width: '42%',
          background: `linear-gradient(135deg, ${primaryColor} 0%, #6610f2 100%)`,
          flexShrink: 0,
        }}
      >
        {branding?.useTextLogo ? (
          <span
            className="mb-4"
            style={{
              fontFamily: branding.logoTextFont || 'Inter, system-ui, sans-serif',
              fontSize: branding.logoTextSize || '1.5rem',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {branding.logoText || orgName}
          </span>
        ) : branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={orgName} width={72} height={72} className="mb-4" />
        ) : (
          <img src="/logo.svg" alt={orgName} width={72} height={72} className="mb-4" />
        )}
        <h2 className="fw-bold mb-3">{orgName}</h2>
        <p className="text-white-50 text-center mb-5" style={{ maxWidth: 320 }}>
          Build enterprise dashboards, govern shared metrics, and make faster decisions with trusted analytics.
        </p>
        <ul className="list-unstyled text-white-50 small">
          <li className="mb-2">
            <i className="fa-solid fa-circle-check text-white me-2"></i>
            Connect to any database
          </li>
          <li className="mb-2">
            <i className="fa-solid fa-circle-check text-white me-2"></i>
            Rich visualisations &amp; charts
          </li>
          <li className="mb-2">
            <i className="fa-solid fa-circle-check text-white me-2"></i>
            Role-based access control
          </li>
          <li>
            <i className="fa-solid fa-circle-check text-white me-2"></i>
            Microsoft Entra ID support
          </li>
        </ul>
        <p className="small opacity-50 mb-0">&copy; {new Date().getFullYear()} {orgName}</p>
      </div>

      {/* Right form panel */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center bg-light p-4">
        <div style={{ width: '100%', maxWidth: 460 }}>
          {/* Mobile logo (shown only when left panel is hidden) */}
          <div className="d-lg-none text-center mb-4">
            {branding?.useTextLogo ? (
              <span
                style={{
                  fontFamily: branding.logoTextFont || 'Inter, system-ui, sans-serif',
                  fontSize: branding.logoTextSize || '1.5rem',
                  color: branding.logoTextColor || primaryColor,
                  fontWeight: 700,
                }}
              >
                {branding.logoText || orgName}
              </span>
            ) : branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={orgName} width={48} height={48} />
            ) : (
              <img src="/logo.svg" alt={orgName} width={48} height={48} />
            )}
          </div>

          <div className="mb-4">
            <h3 className="fw-bold mb-1">Create your account</h3>
            <p className="text-muted mb-0">Get started with your enterprise workspace</p>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              {serverError && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                  <i className="fa-solid fa-circle-xmark"></i>
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Display Name */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Display name
                  </label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-user text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className={`form-control${errors.displayName ? ' is-invalid' : ''}`}
                      placeholder="Jane Smith"
                      {...register('displayName')}
                    />
                    {errors.displayName && (
                      <div className="invalid-feedback">
                        {errors.displayName.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Email address
                  </label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-envelope text-muted"></i>
                    </span>
                    <input
                      type="email"
                      className={`form-control${errors.email ? ' is-invalid' : ''}`}
                      placeholder="you@example.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <div className="invalid-feedback">
                        {errors.email.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password */}
                <div className="mb-2">
                  <label className="form-label fw-medium">
                    Password
                  </label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-lock text-muted"></i>
                    </span>
                    <input
                      type="password"
                      className={`form-control${errors.password ? ' is-invalid' : ''}`}
                      placeholder="••••••••"
                      {...register('password')}
                    />
                    {errors.password && (
                      <div className="invalid-feedback">
                        {errors.password.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password strength indicator */}
                {password && (
                  <div className="mb-3">
                    {/* Segmented bar */}
                    <div className="d-flex gap-1 mb-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          style={{
                            height: 4,
                            borderRadius: 2,
                            flexGrow: 1,
                            background:
                              i < metCount
                                ? STRENGTH_BAR_COLOR[strengthColor]
                                : '#dee2e6',
                            transition: 'background 0.2s',
                          }}
                        />
                      ))}
                    </div>
                    <div className={`small text-${strengthColor} fw-medium mb-1`}>
                      {strengthLabel}
                    </div>
                    {/* Criteria checklist */}
                    <div className="d-flex flex-wrap gap-2">
                      {strengthCriteria.map(c => (
                        <span
                          key={c.label}
                          className={`small ${c.test(password) ? 'text-success' : 'text-muted'}`}
                        >
                          <i
                            className={`fa-solid ${c.test(password) ? 'fa-check' : 'fa-xmark'} me-1`}
                          ></i>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="form-label fw-medium">
                    Confirm password
                  </label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <i className="fa-solid fa-lock text-muted"></i>
                    </span>
                    <input
                      type="password"
                      className={`form-control${errors.confirmPassword ? ' is-invalid' : ''}`}
                      placeholder="••••••••"
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <div className="invalid-feedback">
                        {errors.confirmPassword.message}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Creating account…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus me-2"></i>
                      Create account
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-muted small mt-3 mb-0">
                Already have an account?{' '}
                <Link to="/login" className="fw-medium text-decoration-none text-primary">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
