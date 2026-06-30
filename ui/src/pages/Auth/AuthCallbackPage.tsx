import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeExternalLogin } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken') ?? undefined;
    const authError = searchParams.get('error');
    const authErrorDescription = searchParams.get('errorDescription');

    if (authError) {
      setError(authErrorDescription || authError);
      return;
    }

    if (!token) {
      setError('The identity provider did not return a Kinetic session.');
      return;
    }

    completeExternalLogin(token, refreshToken)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'External login failed'));
  }, [completeExternalLogin, navigate, searchParams]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-4">
      <div className="card border-0 shadow-sm p-4" style={{ width: '100%', maxWidth: 420 }}>
        {error ? (
          <>
            <div className="d-flex align-items-center gap-2 text-danger mb-3">
              <i className="fa-solid fa-circle-xmark"></i>
              <h5 className="mb-0">Sign-in failed</h5>
            </div>
            <p className="text-muted small mb-4">{error}</p>
            <Link to="/login" className="btn btn-primary w-100">
              <i className="fa-solid fa-arrow-left me-2"></i>
              Back to sign in
            </Link>
          </>
        ) : (
          <div className="text-center py-3">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h5 className="fw-semibold mb-1">Completing sign in</h5>
            <p className="text-muted small mb-0">Finalizing your Kinetic session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
