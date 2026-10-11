import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { channelOf } from "../data/channels";
import { compact, cx, dedupeById, playerUrl } from "../lib/format";
import { apiSearch, resolveApiKey } from "../lib/ytApi";
import type { Video } from "../types";
import { useApp, useLibrary } from "../store/AppContext";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Thumbnail } from "../components/Thumbnail";

/** Actual shorts signal: very short runtime and/or #shorts tagging. */
const looksLikeShort = (v: Video): boolean =>
  v.duration > 0 &&
  v.duration <= 180 &&
  (/#short/i.test(`${v.title} ${v.description}`) || v.duration <= 60);

export function ShortsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state, toggleLike, toggleSave, toast } = useApp();
  const { videos } = useLibrary();
  const key = resolveApiKey(state.apiKey);
  const [apiShorts, setApiShorts] = useState<Video[]>([]);

  // Live shorts via the official Data API (newest first, refreshed each load).
  useEffect(() => {
    if (!key) {
      setApiShorts([]);
      return;
    }
    const ctrl = new AbortController();
    apiSearch(key, { q: "#shorts", type: "video", videoDuration: "short", order: "date", maxResults: 15 })
      .then((res) => {
        if (!ctrl.signal.aborted) setApiShorts(res.videos);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setApiShorts([]);
      });
    return () => ctrl.abort();
  }, [key]);

  const pool = (() => {
    const apiReal = apiShorts.filter(looksLikeShort);
    const apiPool = apiReal.length >= 6 ? apiReal : apiShorts.filter((v) => v.duration > 0 && v.duration <= 620);
    const local = videos.filter(looksLikeShort);
    return dedupeById([...apiPool, ...local]).sort((a, b) => a.ageDays - b.ageDays);
  })();
  const shorts = [...pool.slice(0, 14)];
  if (id && !shorts.some((v) => v.id === id)) {
    const requested = pool.find((v) => v.id === id);
    if (requested) shorts.unshift(requested);
  }
  const currentIndex = Math.max(
    0,
    shorts.findIndex((v) => v.id === id),
  );
  const active = shorts[currentIndex] ?? shorts[0]!;
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = containerRef.current?.children[currentIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "start" });
  }, [currentIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") go(1);
      if (e.key === "ArrowUp" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, shorts.length]);

  const go = (dir: 1 | -1) => {
    const next = Math.min(shorts.length - 1, Math.max(0, currentIndex + dir));
    nav(`/shorts/${shorts[next]!.id}`);
  };

  if (!active) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty__art">
            <Icon name="shorts" size={38} />
          </div>
          <h2>No shorts available</h2>
          <Link className="btn btn--primary" to="/">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const liked = state.liked.includes(active.id);

  return (
    <div className="shorts">
      <div className="shorts__nav">
        <button className="iconbtn" onClick={() => go(-1)} disabled={currentIndex === 0} aria-label="Previous short">
          <Icon name="chevronUp" />
        </button>
        <button
          className="iconbtn"
          onClick={() => go(1)}
          disabled={currentIndex === shorts.length - 1}
          aria-label="Next short"
        >
          <Icon name="chevronDown" />
        </button>
      </div>

      <div className="shorts__feed" ref={containerRef}>
        {shorts.map((v, i) => {
          const ch = channelOf(v.handle);
          const dispName = v.channel || ch.name;
          const hasHandle = v.handle.startsWith("@");
          const chanLink = hasHandle
            ? `/${v.handle}`
            : `/results?search_query=${encodeURIComponent(dispName)}`;
          return (
          <section className={cx("short", i === currentIndex && "is-active")} key={v.id} id={`short-${v.id}`}>
            <div className="short__stage">
              <div className="short__player">
                {Math.abs(i - currentIndex) <= 1 ? (
                  <iframe
                    key={v.id}
                    src={playerUrl(v.id, i === currentIndex, i === currentIndex ? muted : true)}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button className="short__poster" onClick={() => nav(`/shorts/${v.id}`)} aria-label={v.title}>
                    <Thumbnail video={v} showMeta={false} eager={false} />
                  </button>
                )}
              </div>

              <div className="short__topbar">
                <button className="iconbtn" onClick={() => nav("/")} aria-label="Exit shorts">
                  <Icon name="close" />
                </button>
                <button className="iconbtn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
                  <Icon name="volume" />
                </button>
              </div>

              <div className="short__meta">
                <div className="short__author">
                  <Link to={chanLink}>
                    <Avatar name={dispName} size={36} src={v.avatar ?? ch.avatar} />
                  </Link>
                  <Link to={chanLink} className="short__handle">
                    {hasHandle ? v.handle : dispName}
                  </Link>
                  <button
                    className="btn btn--primary btn--xs"
                    onClick={() => toast(`Following ${dispName}`)}
                  >
                    Follow
                  </button>
                </div>
                <h2 className="short__title">{v.title}</h2>
                <p className="short__views">{compact(v.views)} views · #shorts</p>
              </div>

              <div className="short__actions">
                <button
                  className={cx("short__action", liked && "is-active")}
                  onClick={() => toggleLike(v.id)}
                >
                  <Icon name="thumbUp" size={22} />
                  <span>{compact(v.likes + (liked ? 1 : 0))}</span>
                </button>
                <button className="short__action" onClick={() => toast("Comments opened")}>
                  <Icon name="feedback" size={22} />
                  <span>{compact(1200 + (v.id.length % 9) * 400)}</span>
                </button>
                <button
                  className="short__action"
                  onClick={() => {
                    toggleSave(v.id);
                    toast("Saved to Watch later", { actionLabel: "View", actionTo: "/playlist?list=WL" });
                  }}
                >
                  <Icon name="save" size={22} />
                  <span>Save</span>
                </button>
                <button
                  className="short__action"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${location.origin}/shorts/${v.id}`).catch(() => {});
                    toast("Short link copied");
                  }}
                >
                  <Icon name="share" size={22} />
                  <span>Share</span>
                </button>
                <button className="short__action" onClick={() => toast("Report submitted")}>
                  <Icon name="more" size={22} />
                </button>
              </div>
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}
