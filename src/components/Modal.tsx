import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/format";
import { Icon } from "./Icon";

export function Modal({
  open,
  onClose,
  children,
  label,
  size = "md",
  bare,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  size?: "sm" | "md" | "lg" | "full";
  bare?: boolean;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="modal-backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div className={cx("modal", `modal--${size}`, bare && "modal--bare")}>
        {!bare && (
          <header className="modal__head">
            <h2 className="modal__title">{label}</h2>
            <button className="iconbtn" onClick={onClose} aria-label="Close dialog">
              <Icon name="close" />
            </button>
          </header>
        )}
        {bare && (
          <button className="iconbtn modal__close-float" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
