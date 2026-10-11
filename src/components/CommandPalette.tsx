import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { searchVideos } from "../lib/search";
import { CHANNELS } from "../data/channels";
import { useApp, useLibrary } from "../store/AppContext";
import { cx } from "../lib/format";
import { Icon, type IconName } from "./Icon";

type Action = { id: string; label: string; hint: string; icon: IconName; run: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { state, setTheme, toast } = useApp();
  const { videos: library } = useLibrary();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const actions = useMemo<Action[]>(
    () => [
      { id: "home", label: "Go to Home", hint: "Navigation", icon: "home", run: () => nav("/") },
      { id: "trend", label: "Open Trending", hint: "Navigation", icon: "trending", run: () => nav("/feed/trending") },
      { id: "hist", label: "Watch history", hint: "Navigation", icon: "history", run: () => nav("/feed/history") },
      { id: "wl", label: "Watch later", hint: "Playlist", icon: "clock", run: () => nav("/playlist?list=WL") },
      { id: "sub", label: "Subscriptions", hint: "Navigation", icon: "subs", run: () => nav("/feed/subscriptions") },
      { id: "theme", label: `Switch to ${state.theme === "dark" ? "light" : "dark"} mode`, hint: "Appearance", icon: state.theme === "dark" ? "sun" : "moon", run: () => setTheme(state.theme === "dark" ? "light" : "dark") },
      { id: "shorts", label: "Open Shorts", hint: "Navigation", icon: "shorts", run: () => nav("/shorts") },
      { id: "lib", label: "Your library", hint: "Navigation", icon: "library", run: () => nav("/feed/library") },
    ],
    [nav, setTheme, state.theme],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const vids = (term ? searchVideos(library, term) : library)
      .slice(0, 5)
      .map((v) => ({
        id: `v-${v.id}`,
        label: v.title,
        hint: v.channel,
        icon: "play" as IconName,
        run: () => nav(`/watch?v=${v.id}`),
      }));
    const chans = Object.values(CHANNELS)
      .filter((c) => term && `${c.name} ${c.handle}`.toLowerCase().includes(term))
      .slice(0, 3)
      .map((c) => ({
        id: `c-${c.handle}`,
        label: c.name,
        hint: `${c.handle} · channel`,
        icon: "user" as IconName,
        run: () => nav(`/${c.handle}`),
      }));
    const acts = actions.filter((a) => !term || a.label.toLowerCase().includes(term));
    return [...acts, ...chans, ...vids];
  }, [q, actions, nav, library]);

  const clampCursor = (n: number) => Math.max(0, Math.min(results.length - 1, n));

  if (!open) return null;

  const exec = (i: number) => {
    results[i]?.run();
    onClose();
  };

  return createPortal(
    <div className="palette" role="dialog" aria-label="Quick search">
      <div className="palette__backdrop" onClick={onClose} />
      <div className="palette__panel">
        <div className="palette__input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => clampCursor(c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => clampCursor(c - 1));
              } else if (e.key === "Enter") {
                exec(cursor);
              }
            }}
            placeholder="Search videos, channels or jump to a page…"
            aria-label="Quick search"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette__list" ref={listRef}>
          {results.length === 0 && <p className="palette__empty">No matches for “{q}”</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              className={cx("palette__item", i === cursor && "is-active")}
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(i)}
            >
              <span className="palette__icon">
                <Icon name={r.icon} size={18} />
              </span>
              <span className="palette__label">{r.label}</span>
              <span className="palette__hint">{r.hint}</span>
            </button>
          ))}
        </div>
        <footer className="palette__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>K</kbd> toggle
          </span>
          <button className="linkbtn" onClick={() => toast("Tip: press / to focus the main search bar")}>
            Tips
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { setUser, toast } = useApp();
  const [name, setName] = useState("Collins Maiko");
  const [email, setEmail] = useState("collinsmaiko91@gmail.com");
  const [pw, setPw] = useState("••••••••");

  if (!open) return null;

  return createPortal(
    <>
      <div className="modal-root is-open" role="dialog" aria-modal="true" aria-label="Sign in">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal modal--sm is-open">
          <header className="modal__head">
            <h2 className="modal__title">Sign in</h2>
            <button className="iconbtn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          <div className="modal__body signin">
            <p className="muted">to continue to CollinsTube</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || !email.trim()) return;
                setUser({
                  name: name.trim(),
                  email: email.trim(),
                  handle: `@${name.trim().toLowerCase().replace(/\s+/g, "")}`,
                });
                toast(`Welcome back, ${name.trim().split(" ")[0]}!`);
                onClose();
              }}
            >
              <label className="field">
                <span>First name</span>
                <input value={name.split(" ")[0] ?? ""} onChange={(e) => setName(`${e.target.value} ${name.split(" ").slice(1).join(" ")}`.trim())} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={name.split(" ").slice(1).join(" ")} onChange={(e) => setName(`${name.split(" ")[0] ?? ""} ${e.target.value}`.trim())} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </label>
              <div className="signin__actions">
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Sign in
                </button>
              </div>
            </form>
            <p className="muted signin__note">
              Not your computer? Use Guest mode to sign in privately.{" "}
              <span className="linkbtn">Learn more about using Guest mode</span>
            </p>
            <p className="muted signin__note">
              Demo only — credentials stay in your browser and nothing is sent anywhere.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
