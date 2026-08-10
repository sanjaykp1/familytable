import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../app/AppProvider';

export function ToastViewport() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon =
          toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            <Icon aria-hidden="true" size={19} />
            <span>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss message"
              title="Dismiss message"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
