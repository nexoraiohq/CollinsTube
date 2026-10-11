import { useEffect, useRef, useState } from "react";

/** Manages an open/closed popover: closes on outside click or Escape. */
export function useDismiss<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { ref, open, setOpen, close: () => setOpen(false) };
}

export function useHotkey(combo: (e: KeyboardEvent) => boolean, handler: () => void, active = true) {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (combo(e)) {
        e.preventDefault();
        cb.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, active]);
}

export function useFakeProgress(done: boolean, speed = 900): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => {
      setP((v) => (v >= 100 ? 100 : v + Math.max(1, Math.round((100 - v) / 12))));
    }, speed / 10);
    return () => window.clearInterval(t);
  }, [done, speed]);
  useEffect(() => {
    if (done) setP(100);
  }, [done]);
  return p;
}
