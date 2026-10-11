import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { Icon } from "./Icon";

export function ToastHost() {
  const { state, dismissToast } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {state.toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span className="toast__msg">{t.message}</span>
          {t.actionTo ? (
            <Link className="toast__action" to={t.actionTo} onClick={() => dismissToast(t.id)}>
              {t.actionLabel}
            </Link>
          ) : (
            t.actionLabel && (
              <button
                className="toast__action"
                onClick={() => {
                  t.onAction?.();
                  dismissToast(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            )
          )}
          <button className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
