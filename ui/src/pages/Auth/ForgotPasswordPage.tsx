import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPassword } from '../../lib/api/auth';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; resetUrl?: string } | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await forgotPassword(data.email);
      setSuccess(result);
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
          <h2 className="fw-bold display-6 mb-3">Forgot your<br />password?</h2>
          <p className="opacity-75">No worries — we'll help you get back into your account in no time.</p>
        </div>
        <p className="small opacity-50 mb-0">&copy; {new Date().getFullYear()} Kinetic Reports</p>
      </div>

      {/* Right form panel */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 bg-light">
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <div className="d-lg-none text-center mb-4">
            <img src="/logo-full.png" alt="Kinetic" height={40} style={{ maxWidth: 160, objectFit: 'contain' }} />
          </div>

          <div className="card border-0 shadow-sm p-4">
            {success ? (
              <>
                <div className="text-center mb-3">
                  <i className="fa-solid fa-envelope-circle-check text-success" style={{ fontSize: 48 }}></i>
                </div>
                <h4 className="fw-bold mb-2 text-center">Check your email</h4>
                <p className="text-muted small text-center mb-3">{success.message}</p>

                {success.resetUrl && (
                  <div className="alert alert-info mb-3">
                    <div className="small fw-medium mb-1">
                      <i className="fa-solid fa-code me-1"></i>Dev Mode — Reset Link:
                    </div>
                    <a href={success.resetUrl} className="small text-break">{success.resetUrl}</a>
                  </div>
                )}

                <Link to="/login" className="btn btn-outline-primary w-100">
                  <i className="fa-solid fa-arrow-left me-2"></i>Back to Sign in
                </Link>
              </>
            ) : (
              <>
                <h4 className="fw-bold mb-1">Reset password</h4>
                <p className="text-muted small mb-4">
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                    <i className="fa-solid fa-circle-xmark"></i>
                    <span>{error}</span>
                  </div>
                )}

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
                  <button
                    type="submit"
                    className="btn btn-primary w-100 fw-semibold mb-3"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Sending...</>
                    ) : (
                      <><i className="fa-solid fa-paper-plane me-2"></i>Send Reset Link</>
                    )}
                  </button>
                  <Link to="/login" className="btn btn-outline-secondary w-100">
                    <i className="fa-solid fa-arrow-left me-2"></i>Back to Sign in
                  </Link>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
