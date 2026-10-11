import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { CHANNELS } from "../data/channels";
import { FOOTER_LINKS } from "../data/misc";
import { cx } from "../lib/format";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";

type Item = { to: string; label: string; icon: IconName; end?: boolean };

const GROUP_1: Item[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/shorts", label: "Shorts", icon: "shorts" },
  { to: "/feed/subscriptions", label: "Subscriptions", icon: "subs" },
];

const GROUP_YOU: Item[] = [
  { to: "/feed/history", label: "History", icon: "history" },
  { to: "/playlist?list=WL", label: "Watch later", icon: "clock" },
  { to: "/playlist?list=LL", label: "Liked videos", icon: "thumbUp" },
  { to: "/feed/your-videos", label: "Your videos", icon: "playlist" },
  { to: "/feed/library", label: "Library", icon: "library" },
];

const EXPLORE: Item[] = [
  { to: "/feed/trending", label: "Trending", icon: "trending" },
  { to: "/results?search_query=music", label: "Music", icon: "music" },
  { to: "/results?search_query=coding", label: "Coding", icon: "code" },
  { to: "/results?search_query=live", label: "Live", icon: "live" },
  { to: "/results?search_query=viral", label: "Viral", icon: "fire" },
  { to: "/results?search_query=kids", label: "Kids", icon: "kids" },
];

export function Sidebar({
  mode,
  open,
  onClose,
  onOpenSignIn,
}: {
  mode: "rail" | "drawer" | "expanded";
  open?: boolean;
  onClose?: () => void;
  onOpenSignIn: () => void;
}) {
  const { state, toggleSub, toast } = useApp();
  const loc = useLocation();
  const [showAllSubs, setShowAllSubs] = useState(false);

  const subs = useMemo(
    () => state.subscriptions.map((h) => CHANNELS[h]).filter(Boolean),
    [state.subscriptions],
  );
  const visibleSubs = showAllSubs ? subs : subs.slice(0, 4);
  const collapsed = mode === "rail";

  return (
    <>
      {mode === "drawer" && (
        <div className={cx("drawer-backdrop", open && "is-open")} onClick={onClose} />
      )}
      <aside
        className={cx(
          "sidebar",
          collapsed && "sidebar--rail",
          mode === "drawer" && "sidebar--drawer",
          mode === "drawer" && open && "is-open",
        )}
        aria-label="Primary"
      >
        <nav className="sidebar__scroll">
          <ul className="sidebar__group">
            {GROUP_1.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) => cx("side-item", isActive && "is-active")}
                  onClick={onClose}
                >
                  <Icon name={it.icon} filled />
                  <span>{it.label}</span>
                </NavLink>
              </li>
            ))}
            {collapsed && (
              <li>
                <NavLink
                  to="/feed/library"
                  className={({ isActive }) => cx("side-item", isActive && "is-active")}
                  onClick={onClose}
                  title="You"
                >
                  <Icon name="user" />
                  <span>You</span>
                </NavLink>
              </li>
            )}
          </ul>

          {!collapsed && <hr className="sidebar__rule" />}

          {!collapsed && (
            <section className="sidebar__section">
              <NavLink to="/feed/library" className="sidebar__heading" onClick={onClose}>
                You <Icon name="chevronRight" size={16} />
              </NavLink>
              <ul>
                {GROUP_YOU.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      className={({ isActive }) => cx("side-item", isActive && "is-active")}
                      onClick={onClose}
                      title={it.label}
                    >
                      <Icon name={it.icon} />
                      <span>{it.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!collapsed && <hr className="sidebar__rule" />}

          {!collapsed && (
            <section className="sidebar__section">
              <h3 className="sidebar__heading">Explore</h3>
              <ul>
                {EXPLORE.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      className={({ isActive }) =>
                        cx("side-item", isActive && loc.search.includes(it.label.toLowerCase()) && "is-active")
                      }
                      onClick={onClose}
                      title={it.label}
                    >
                      <Icon name={it.icon} />
                      <span>{it.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!collapsed && <hr className="sidebar__rule" />}

          {!collapsed && (
            <section className="sidebar__section">
              <h3 className="sidebar__heading">Subscriptions</h3>
              <ul>
                {visibleSubs.map((c) => (
                  <li key={c.handle}>
                    <NavLink
                      to={`/${c.handle}`}
                      className={({ isActive }) => cx("side-item side-item--sub", isActive && "is-active")}
                      onClick={onClose}
                      title={c.name}
                    >
                      <Avatar name={c.name} size={24} src={c.avatar} />
                      <span>{c.name}</span>
                    </NavLink>
                  </li>
                ))}
                {subs.length > 4 && (
                  <li>
                    <button className="side-item side-item--btn" onClick={() => setShowAllSubs((s) => !s)}>
                      <Icon name={showAllSubs ? "chevronUp" : "chevronDown"} size={22} />
                      <span>{showAllSubs ? "Show fewer" : "Show more"}</span>
                    </button>
                  </li>
                )}
                {subs.length === 0 && (
                  <li className="side-empty">
                    <button
                      className="side-item side-item--btn"
                      onClick={() => {
                        toggleSub("@lofigirl");
                        toast("Subscribed to Lofi Girl", { actionLabel: "View", actionTo: "/@lofigirl" });
                      }}
                    >
                      <Icon name="plus" size={20} />
                      <span>Try @lofigirl</span>
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {!collapsed && <hr className="sidebar__rule" />}

          {!collapsed && (
            <section className="sidebar__section">
              <ul>
                <li>
                  <button className="side-item side-item--btn" onClick={onOpenSignIn}>
                    <Icon name="user" />
                    <span>{state.user ? "Switch account" : "Sign in"}</span>
                  </button>
                </li>
              </ul>
              <div className="sidebar__footer">
                <p className="footer-links">
                  {FOOTER_LINKS.map((l, i) => (
                    <span key={l}>
                      <button className="footer-link" onClick={() => toast(`${l} — demo link`)}>
                        {l}
                      </button>
                      {i < FOOTER_LINKS.length - 1 && <span className="footer-dot"> · </span>}
                    </span>
                  ))}
                </p>
                <p className="sidebar__copy">© 2026 Clone Studio</p>
              </div>
            </section>
          )}
        </nav>
      </aside>
    </>
  );
}
