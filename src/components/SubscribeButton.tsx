import { useState } from "react";
import { useApp } from "../store/AppContext";
import { channelOf } from "../data/channels";
import { compact, cx } from "../lib/format";
import { useDismiss } from "../lib/hooks";
import { Icon } from "./Icon";

export function SubscribeButton({
  handle,
  size = "md",
  showCount = true,
}: {
  handle: string;
  size?: "sm" | "md";
  showCount?: boolean;
}) {
  const { state, toggleSub, toast, setUser } = useApp();
  const channel = channelOf(handle);
  const subscribed = state.subscriptions.includes(handle);
  const bell = useDismiss<HTMLDivElement>();

  return (
    <div className="sub-anchor" ref={bell.ref}>
      <button
        className={cx(
          "subscribe",
          subscribed && "is-subscribed",
          size === "sm" && "subscribe--sm",
        )}
        onClick={() => {
          if (!state.user && !subscribed) {
            setUser({ name: "Collins Maiko", email: "collinsmaiko91@gmail.com", handle: "@collinsmaiko" });
          }
          toggleSub(handle);
          toast(subscribed ? `Unsubscribed from ${channel.name}` : `Subscribed to ${channel.name}`, {
            actionLabel: "Undo",
            onAction: () => toggleSub(handle),
          });
          if (subscribed) bell.close();
        }}
        aria-pressed={subscribed}
      >
        {subscribed && <Icon name="bell" size={18} />}
        {subscribed ? "Subscribed" : "Subscribe"}
        {showCount && !subscribed && <span className="subscribe__count">{compact(channel.subscribers)}</span>}
      </button>

      {subscribed && (
        <button
          className={cx("subscribe subscribe--bell", bell.open && "is-open")}
          onClick={() => bell.setOpen(!bell.open)}
          aria-label="Notification options"
        >
          <Icon name="chevronDown" size={18} />
        </button>
      )}

      {bell.open && (
        <div className="dropdown dropdown--bell" role="menu">
          <button className="menu-item" onClick={() => { bell.close(); toast("Notifications: All"); }}>
            <Icon name="bell" size={18} /> All
          </button>
          <button className="menu-item" onClick={() => { bell.close(); toast("Notifications: Personalised"); }}>
            <Icon name="bell" size={18} /> Personalised
          </button>
          <button className="menu-item" onClick={() => { bell.close(); toast("Notifications: None"); }}>
            <Icon name="close" size={18} /> None
          </button>
        </div>
      )}
    </div>
  );
}
