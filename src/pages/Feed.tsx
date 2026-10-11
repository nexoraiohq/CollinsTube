import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useLibrary } from "../store/AppContext";
import { CHANNELS } from "../data/channels";
import { compact, timeAgo } from "../lib/format";
import { apiUploadsForHandles, friendlyApiError, resolveApiKey } from "../lib/ytApi";
import type { Video } from "../types";
import { ApiKeyBanner } from "../components/ApiSettingsModal";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { VideoGrid, VideoRow } from "../components/VideoCard";

export function SubscriptionsPage() {
  const { state, toggleSub, toast } = useApp();
  const { videos } = useLibrary();
  const key = resolveApiKey(state.apiKey);
  const [apiList, setApiList] = useState<Video[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const subsKey = state.subscriptions.join(",");

  useEffect(() => {
    if (!key || state.subscriptions.length === 0) {
      setApiList(null);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    setStatus("loading");
    apiUploadsForHandles(key, state.subscriptions, 5)
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setApiList(list);
        setStatus("ok");
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setErrMsg(friendlyApiError(err));
        setStatus("error");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, subsKey]);

  const localList = videos
    .filter((v) => state.subscriptions.includes(v.handle))
    .sort((a, b) => a.ageDays - b.ageDays);
  const list = key && apiList ? apiList : localList;
  const subs = state.subscriptions.map((h) => CHANNELS[h]).filter(Boolean);

  return (
    <div className="page">
      {!key && <ApiKeyBanner />}
      {status === "loading" && (
        <p className="muted" role="status">
          Checking live uploads from YouTube…
        </p>
      )}
      {status === "error" && (
        <p className="muted" role="alert">
          Live uploads unavailable ({errMsg}) — showing offline catalog.
        </p>
      )}
      <div className="page-head">
        <h1>Latest from your subscriptions</h1>
        <div className="page-head__row">
          <div className="subs-chips">
            <button
              className="chip is-active"
              onClick={() => toast(`Manage ${subs.length} subscriptions`)}
            >
              Manage
            </button>
            {subs.map((c) => (
              <Link key={c.handle} to={`/${c.handle}`} className="chip chip--avatar">
                <Avatar name={c.name} size={22} src={c.avatar} />
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty__art">
            <Icon name="subs" size={38} />
          </div>
          <h2>No videos yet</h2>
          <p className="muted">Subscribe to a few channels and their newest uploads land here.</p>
          <div className="empty__suggestions">
            {Object.values(CHANNELS)
              .slice(0, 4)
              .map((c) => (
                <button
                  key={c.handle}
                  className="btn btn--outline"
                  onClick={() => {
                    toggleSub(c.handle);
                    toast(`Subscribed to ${c.name}`);
                  }}
                >
                  + {c.name}
                </button>
              ))}
          </div>
        </div>
      ) : (
        <>
          <VideoGrid videos={list.slice(0, 16)} />
          <p className="muted center">
            {list.length} videos · last checked {timeAgo(list[0]?.ageDays ?? 0)}
          </p>
        </>
      )}
    </div>
  );
}

export function HistoryPage() {
  const { state, removeHistory, addHistory, clearHistory, toast } = useApp();
  const { find } = useLibrary();
  const items = state.history.map((id) => find(id)).filter(Boolean);

  return (
    <div className="page page--history">
      <div className="page-head page-head--split">
        <h1>Watch history</h1>
        <div className="page-head__actions">
          <button className="btn btn--chip" onClick={() => toast("Search history panel")}>
            <Icon name="search" size={18} /> Search history
          </button>
          <button
            className="btn btn--chip"
            onClick={() => {
              clearHistory();
              toast("Watch history cleared");
            }}
            disabled={!items.length}
          >
            <Icon name="trash" size={18} /> Clear all watch history
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty__art">
            <Icon name="history" size={38} />
          </div>
          <h2>No watch history</h2>
          <p className="muted">Videos you watch will show up here.</p>
          <Link className="btn btn--primary" to="/">
            Start watching
          </Link>
        </div>
      ) : (
        <>
          <h2 className="shelf__title">Recently watched</h2>
          <ul className="history-list">
            {items.map((v) => (
              <li key={v!.id} className="history-item">
                <button
                  className="history-item__remove"
                  onClick={() => {
                    const id = v!.id;
                    removeHistory(id);
                    toast("Removed from history", {
                      actionLabel: "Undo",
                      onAction: () => addHistory(id),
                    });
                  }}
                  aria-label="Remove from history"
                >
                  <Icon name="close" size={18} />
                </button>
                <VideoRow video={v!} variant="history" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function LibraryPage() {
  const { state } = useApp();
  const { find } = useLibrary();
  const liked = state.liked.map((id) => find(id)).filter(Boolean);
  const cards = [
    { to: "/feed/history", label: "History", icon: "history" as const, meta: `${state.history.length} videos` },
    { to: "/playlist?list=WL", label: "Watch later", icon: "clock" as const, meta: `${state.saved.length} videos` },
    { to: "/playlist?list=LL", label: "Liked videos", icon: "thumbUp" as const, meta: `${liked.length} videos` },
    { to: "/feed/your-videos", label: "Your videos", icon: "playlist" as const, meta: `${state.uploads.length} uploads` },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>Library</h1>
      </div>
      <div className="library-grid">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="library-card">
            <span className="library-card__icon">
              <Icon name={c.icon} size={30} />
            </span>
            <span>
              <strong>{c.label}</strong>
              <small className="muted">{c.meta}</small>
            </span>
            <Icon name="chevronRight" size={20} className="library-card__chev" />
          </Link>
        ))}
      </div>

      <div className="shelf">
        <h2 className="shelf__title">Continue watching</h2>
        {state.history.length ? (
          <VideoGrid videos={state.history.slice(0, 4).map((id) => find(id)!).filter(Boolean)} />
        ) : (
          <p className="muted">Nothing in progress — pick something from Home.</p>
        )}
      </div>

      <div className="shelf">
        <h2 className="shelf__title">Playlists</h2>
        <div className="playlist-shelf">
          <Link to="/playlist?list=WL" className="pl-card">
            <span className="pl-card__art">
              <Icon name="clock" size={30} />
            </span>
            <span>
              <h3>Watch later</h3>
              <p className="muted">{state.saved.length} videos</p>
            </span>
          </Link>
          <Link to="/playlist?list=LL" className="pl-card">
            <span className="pl-card__art">
              <Icon name="thumbUp" size={30} />
            </span>
            <span>
              <h3>Liked videos</h3>
              <p className="muted">{state.liked.length} videos</p>
            </span>
          </Link>
        </div>
      </div>

      <p className="muted">
        Storage used: {compact(state.history.length * 4 + state.uploads.length * 900)} KB of local history ·
        synced {timeAgo(0)}
      </p>
    </div>
  );
}
