import { CheckCircle2, X } from 'lucide-react';
import usePlayer from '../store.js';

export default function Toasts() {
  const toasts = usePlayer((s) => s.toasts);
  const dismiss = usePlayer((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <b>{t.title}</b>
            {t.sub && <small>{t.sub}</small>}
          </div>
          {t.action?.label && (
            <button
              className="toast-action"
              style={{ marginLeft: 'auto' }}
              onClick={() => { t.action.onClick?.(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn" style={{ marginLeft: t.action?.label ? 0 : 'auto', width: 28, height: 28 }} onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
