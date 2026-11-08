import { CheckCircle2, X } from 'lucide-react';
import usePlayer from '../store.js';
import { t } from '../lib/i18n.js';

export default function Toasts() {
  const toasts = usePlayer((s) => s.toasts);
  const dismiss = usePlayer((s) => s.dismissToast);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <b>{toast.title}</b>
            {toast.sub && <small>{toast.sub}</small>}
          </div>
          {toast.action?.label && (
            <button
              className="toast-action"
              style={{ marginLeft: 'auto' }}
              onClick={() => { toast.action.onClick?.(); dismiss(toast.id); }}
            >
              {toast.action.label === 'Undo' ? t(lang, 'common.undo') : toast.action.label}
            </button>
          )}
          <button className="icon-btn" style={{ marginLeft: toast.action?.label ? 0 : 'auto', width: 28, height: 28 }} onClick={() => dismiss(toast.id)} aria-label={t(lang, 'btn.close')}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
