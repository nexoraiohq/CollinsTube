import { NavLink } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { cx } from "../lib/format";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export function MobileNav({ onCreate }: { onCreate: () => void }) {
  const { state } = useApp();
  const items = [
    { to: "/", label: "Home", icon: "home" as const, end: true },
    { to: "/shorts", label: "Shorts", icon: "shorts" as const },
  ];
  return (
    <nav className="mobilenav" aria-label="Mobile">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) => cx("mobilenav__item", isActive && "is-active")}
        >
          <Icon name={it.icon} filled />
          <span>{it.label}</span>
        </NavLink>
      ))}
      <button className="mobilenav__item" onClick={onCreate} aria-label="Create">
        <span className="mobilenav__create">
          <Icon name="plus" size={22} />
        </span>
      </button>
      <NavLink
        to="/feed/subscriptions"
        className={({ isActive }) => cx("mobilenav__item", isActive && "is-active")}
      >
        <Icon name="subs" />
        <span>Subscriptions</span>
      </NavLink>
      <NavLink
        to="/feed/library"
        className={({ isActive }) => cx("mobilenav__item", isActive && "is-active")}
      >
        {state.user ? (
          <Avatar name={state.user.name} size={22} />
        ) : (
          <Icon name="user" />
        )}
        <span>You</span>
      </NavLink>
    </nav>
  );
}
