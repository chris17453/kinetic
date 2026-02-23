import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((t: string, m?: string) => showToast('success', t, m), [showToast]);
  const error = useCallback((t: string, m?: string) => showToast('danger', t, m), [showToast]);
  const warning = useCallback((t: string, m?: string) => showToast('warning', t, m), [showToast]);
  const info = useCallback((t: string, m?: string) => showToast('info', t, m), [showToast]);

  const iconMap = { success: 'fa-circle-check', danger: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div id="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast show align-items-center text-bg-${toast.type} border-0 mb-2`} role="alert">
            <div className="d-flex">
              <div className="toast-body d-flex align-items-start gap-2">
                <i className={`fa-solid ${iconMap[toast.type]} mt-1`}></i>
                <div>
                  <div className="fw-semibold">{toast.title}</div>
                  {toast.message && <div className="small opacity-75">{toast.message}</div>}
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
