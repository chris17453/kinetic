import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPassword } from '../../lib/api/auth';

const schema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
type FormValues = z.infer<typeof schema>;

const strengthCriteria = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special char', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_COLOR = ['danger', 'danger', 'warning', 'warning', 'success', 'success'] as const;
const STRENGTH_LABEL = ['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'] as const;
const STRENGTH_BAR_COLOR: Record<string, string> = {
  danger: '#dc3545',
  warning: '#fd7e14',
  success: '#198754',
};

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const password = watch('password', '');
  const metCount = strengthCriteria.filter(c => c.test(password)).length;
  const strengthColor = STRENGTH_COLOR[metCount] ?? 'danger';
  const strengthLabel = STRENGTH_LABEL[metCount] ?? 'Weak';

  // Missing params — invalid link
  if (!email || !token) {
    return (
      <div className="min-vh-100 d-flex">
        <div
          className="d-none d-lg-flex flex-column justify-content-between p-5 text-white"
          style={{ width: '45%', background: 'linear-gradient(135deg, #2563EB 0%, #1e40af 100%)' }}
        >
          <div className="d-flex align-items-center">
            <img src="/logo-full.png" alt="Kinetic" height={42} style={{ maxWidth: 180, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
          <div>
            <h2 className="fw-bold display-6 mb-3">Reset your<br />password</h2>
            <p className="opacity-75">Choose a new, strong password for your account.</p>
          </div>
          <p className="small opacity-50 mb-0">&copy; {new Date().getFullYear()} Kinetic Reports</p>
        </div>
        <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 bg-light">
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div className="card border-0 shadow-sm p-4 text-center">
              <div className="mb-3">
                <i className="fa-solid fa-circle-xmark text-danger" style={{ fontSize: 48 }}></i>
              </div>
              <h4 className="fw-bold mb-2">Invalid Reset Link</h4>
              <p className="text-muted small mb-3">
                This password reset link is invalid or incomplete. Please request a new one.
              </p>
              <Link to="/forgot-password" className="btn btn-primary fw-semibold">
                <i className="fa-solid fa-paper-plane me-2"></i>Request a New Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email, token, data.password);
      setSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || 'Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex">
      {/* Left brand panel */}
      <div
        className="d-none d-lg-flex flex-column justify-content-between p-5 text-white"
        style={{ width: '45%', background: 'linear-gradient(135deg, #2563EB 0%, #1e40af 100%)' }}
      >
        <div className="d-flex align-items-center">
          <img src="/logo-full.png" alt="Kinetic" height={42} style={{ maxWidth: 180, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div>
          <h2 className="fw-bold display-6 mb-3">Reset your<br />password</h2>
          <p className="opacity-75">Choose a new, strong password for your account.</p>
        </div>
        <p className="small opacity-50 mb-0">&copy; {new Date().getFullYear()} Kinetic Reports</p>
      </div>

      {/* Right form panel */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 bg-light">
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div className="d-lg-none text-center mb-4">
            <img src="/logo-full.png" alt="Kinetic" height={40} style={{ maxWidth: 160, objectFit: 'contain' }} />
          </div>

          <div className="card border-0 shadow-sm p-4">
            {success ? (
              <>
                <div className="text-center mb-3">
                  <i className="fa-solid fa-circle-check text-success" style={{ fontSize: 48 }}></i>
                </div>
                <h4 className="fw-bold mb-2 text-center">Password Reset!</h4>
                <p className="text-muted small text-center mb-3">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <Link to="/login" className="btn btn-primary w-100 fw-semibold">
                  <i className="fa-solid fa-right-to-bracket me-2"></i>Sign in
                </Link>
              </>
            ) : (
              <>
                <h4 className="fw-bold mb-1">Choose a new password</h4>
                <p className="text-muted small mb-4">
                  Enter a new password for <strong>{email}</strong>
                </p>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                    <i className="fa-solid fa-circle-xmark"></i>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="mb-2">
                    <label className="form-label fw-medium">New Password</label>
                    <div className="input-group has-validation">
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

                  {password && (
                    <div className="mb-3">
                      <div className="d-flex gap-1 mb-1">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            style={{
                              height: 4, borderRadius: 2, flexGrow: 1,
                              background: i < metCount ? STRENGTH_BAR_COLOR[strengthColor] : '#dee2e6',
                              transition: 'background 0.2s',
                            }}
                          />
                        ))}
                      </div>
                      <div className={`small text-${strengthColor} fw-medium mb-1`}>{strengthLabel}</div>
                      <div className="d-flex flex-wrap gap-2">
                        {strengthCriteria.map(c => (
                          <span key={c.label} className={`small ${c.test(password) ? 'text-success' : 'text-muted'}`}>
                            <i className={`fa-solid ${c.test(password) ? 'fa-check' : 'fa-xmark'} me-1`}></i>
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-medium">Confirm Password</label>
                    <div className="input-group has-validation">
                      <span className="input-group-text bg-white"><i className="fa-solid fa-lock text-muted"></i></span>
                      <input
                        type="password"
                        className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        placeholder="••••••••"
                        {...register('confirmPassword')}
                      />
                      {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword.message}</div>}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 fw-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Resetting...</>
                    ) : (
                      <><i className="fa-solid fa-check me-2"></i>Reset Password</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
