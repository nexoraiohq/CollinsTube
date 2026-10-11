import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Video } from "../types";
import { useApp } from "../store/AppContext";
import { channelOf } from "../data/channels";
import { compact, cx, timeAgo, viewsLabel } from "../lib/format";
import { Avatar } from "./Avatar";
import { HoverPreview } from "./HoverPreview";
import { Icon } from "./Icon";
import { Thumbnail } from "./Thumbnail";

/** YouTube waits ~550ms of hover before starting the muted inline preview. */
const PREVIEW_DELAY_MS = 550;

function watchedPct(video: Video, progress: Record<string, number>): number | null {
  const sec = progress[video.id];
  if (sec === undefined) return null;
  if (video.duration <= 0) return 100;
  return Math.max(4, Math.min(100, Math.round((sec / video.duration) * 100)));
}

function ProgressIfWatched({ video }: { video: Video }) {
  const { state } = useApp();
  const pct = watchedPct(video, state.progress);
  if (pct === null) return null;
  return <span className="card__progress" style={{ width: `${pct}%` }} />;
}

function CardMenu({ video, onDone }: { video: Video; onDone?: () => void }) {
  const { state, toggleSave, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const saved = state.saved.includes(video.id);

  // Popup is absolutely anchored to the dots (right edge flush with the dots,
  // scrolls with the card). Opens ABOVE the dots; flips below only when there
  // is no room above (viewport top / fixed header) or below the screen.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const pop = popRef.current?.getBoundingClientRect();
    if (!btn || !pop) return;
    const headBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const fitsAbove = btn.top - 6 - pop.height >= headBottom + 8;
    const fitsBelow = btn.bottom + 6 + pop.height <= window.innerHeight - 8;
    setUp(fitsAbove || !fitsBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="cardmenu" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        className={cx("card__more", open && "is-open")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="More actions"
        aria-expanded={open}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <>
          <div className="cardmenu__shield" onClick={() => setOpen(false)} />
          <div
            ref={popRef}
            className={cx("cardmenu__pop", up && "cardmenu__pop--up")}
            role="menu"
          >
            <button
              className="menu-item"
              onClick={() => {
                toggleSave(video.id);
                toast(saved ? "Removed from Watch later" : "Saved to Watch later", {
                  actionLabel: "View",
                  actionTo: "/playlist?list=WL",
                });
                setOpen(false);
                onDone?.();
              }}
            >
              <Icon name={saved ? "saved" : "clock"} size={20} />
              {saved ? "Remove from Watch later" : "Save to Watch later"}
            </button>
            <button
              className="menu-item"
              onClick={() => {
                toast("We'll show fewer videos like this");
                setOpen(false);
                onDone?.();
              }}
            >
              <Icon name="close" size={20} />
              Not interested
            </button>
            <button
              className="menu-item"
              onClick={() => {
                toast("Thanks for the report");
                setOpen(false);
                onDone?.();
              }}
            >
              <Icon name="flag" size={20} />
              Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Quick actions that float over a card's thumbnail on hover, stacked vertically
 * top-right like YouTube's. "Watch later" flips to a tick for a moment so the
 * save is confirmed without opening a menu; "open in mini player" starts the
 * video in the floating bottom-left player.
 */
function CardQuickActions({ video, onMini }: { video: Video; onMini: () => void }) {
  const { state, toggleSave, toast } = useApp();
  const saved = state.saved.includes(video.id);
  const [justSaved, setJustSaved] = useState(false);
  const tickTimer = useRef<number | null>(null);
  useEffect(() => () => { if (tickTimer.current !== null) window.clearTimeout(tickTimer.current); }, []);

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave(video.id);
    toast(saved ? "Removed from Watch later" : "Saved to Watch later", {
      actionLabel: "View",
      actionTo: "/playlist?list=WL",
    });
    // Confirm with a tick, then settle back to the plain clock so the button
    // still reads as "watch later" once the confirmation has been seen.
    setJustSaved(true);
    if (tickTimer.current !== null) window.clearTimeout(tickTimer.current);
    tickTimer.current = window.setTimeout(() => setJustSaved(false), 1800);
  };

  const onOpenMini = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMini();
  };

  return (
    <div className="card__quick">
      <button
        className={cx("card__quickbtn", justSaved && "is-saved")}
        onClick={onSave}
        aria-label={saved ? "Remove from Watch later" : "Watch later"}
        title={saved ? "Remove from Watch later" : "Watch later"}
      >
        <Icon name={justSaved ? "check" : saved ? "saved" : "clock"} size={20} />
      </button>
      <button
        className="card__quickbtn"
        onClick={onOpenMini}
        aria-label="Open in mini player"
        title="Open in mini player"
      >
        <Icon name="miniplayer" size={20} />
      </button>
    </div>
  );
}

export function VideoCard({
  video,
  showChannel = true,
  eager = false,
  className,
}: {
  video: Video;
  showChannel?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const { state, setMiniPlayer, toast } = useApp();
  const nav = useNavigate();
  const channel = channelOf(video.handle);
  const [previewing, setPreviewing] = useState(false);
  const [hovering, setHovering] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  // Start the floating bottom-left player, resuming from wherever the video
  // was last left off on the watch page.
  const openInMini = () => {
    setMiniPlayer({ id: video.id, start: state.progress[video.id] ?? 0, expanded: false, video });
    toast("Playing in mini player");
  };

  // Pointer-only: touch devices have no hover, so never arm the preview there.
  // Live videos have no seekable head to preview, so they are skipped too.
  const hoverCapable =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const armPreview = () => {
    setHovering(true);
    if (!hoverCapable || video.live || video.duration <= 0) return;
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPreviewing(true), PREVIEW_DELAY_MS);
  };
  // Leaving the card should only cancel when the pointer is truly outside it.
  // Scrubbing the preview's timeline calls preventDefault on pointerdown, which
  // makes the browser synthesise a mouseleave on the card <Link> even though the
  // pointer is still over the timeline. Ignoring that synthetic leave keeps the
  // preview mounted for the whole drag.
  const isPointerInside = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  const cancelPreview = (e: React.MouseEvent) => {
    if (isPointerInside(e)) return;
    setHovering(false);
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPreviewing(false);
  };
  useEffect(() => () => { if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current); }, []);

  return (
    <article className={cx("card", className)}>
      <Link
        to={`/watch?v=${video.id}`}
        className="card__media"
        aria-label={video.title}
        onMouseEnter={armPreview}
        onMouseLeave={cancelPreview}
        onClick={(e) => {
          // The preview iframe swallows clicks and navigates itself; don't
          // double-navigate when the click lands on the frame's controls.
          if ((e.target as HTMLElement).closest(".card__previewctl")) e.preventDefault();
        }}
      >
        <span className="card__clip">
          <Thumbnail video={video} eager={eager} />
          <span className="card__progress-wrap">
            <ProgressIfWatched video={video} />
          </span>
        </span>
        {previewing && <HoverPreview id={video.id} active={hovering} />}
      </Link>
      <div className="card__body">
        {showChannel && (
          <Link to={`/${channel.handle}`} className="card__avatar" aria-label={channel.name}>
            <Avatar name={channel.name} size={36} src={video.avatar ?? channel.avatar} />
          </Link>
        )}
        <div className="card__meta">
          <Link to={`/watch?v=${video.id}`} className="card__title">
            {video.title}
          </Link>
          {showChannel && (
            <Link to={`/${channel.handle}`} className="card__channel">
              {channel.name}
              {video.verified && <Icon name="verified" size={14} className="verified" />}
            </Link>
          )}
          <p className="card__stats">
            {viewsLabel(video.views, video.live)} · {video.live ? "started 2 hours ago" : timeAgo(video.ageDays)}
          </p>
        </div>
        <CardMenu video={video} />
      </div>
      <CardQuickActions video={video} onMini={openInMini} />
    </article>
  );
}

function RowProgress({ video }: { video: Video }) {
  const { state } = useApp();
  const pct = watchedPct(video, state.progress);
  if (pct === null) return null;
  return (
    <span className="row__progress">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Horizontal row used by search results, related lists and history. */
export function VideoRow({
  video,
  variant = "search",
  description,
  onRemove,
}: {
  video: Video;
  variant?: "search" | "related" | "history";
  description?: string;
  onRemove?: () => void;
}) {
  const channel = channelOf(video.handle);
  const nav = useNavigate();
  return (
    <article
      className={cx("row", `row--${variant}`)}
      onClick={() => nav(`/watch?v=${video.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && nav(`/watch?v=${video.id}`)}
    >
      <div className="row__media">
        <Thumbnail video={video} showMeta={variant !== "history"} />
        {variant === "related" && <RowProgress video={video} />}
      </div>
      <div className="row__body">
        <h3 className="row__title">{video.title}</h3>
        {variant === "related" && (
          <p className="row__channel-inline">
            {channel.name}
            {video.verified && <Icon name="verified" size={13} className="verified" />}
          </p>
        )}
        <p className="row__stats">
          {viewsLabel(video.views, video.live)} · {timeAgo(video.ageDays)}
        </p>
        {variant === "search" && (
          <Link to={`/${channel.handle}`} className="row__channel" onClick={(e) => e.stopPropagation()}>
            <Avatar name={channel.name} size={24} src={video.avatar ?? channel.avatar} />
            {channel.name}
            {video.verified && <Icon name="verified" size={13} className="verified" />}
          </Link>
        )}
        {variant !== "related" && (
          <p className="row__desc">{description ?? video.description}</p>
        )}
        {variant === "history" && onRemove && (
          <button
            className="btn btn--chip row__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Icon name="close" size={16} /> Remove
          </button>
        )}
      </div>
      {variant === "related" && (
        <div className="row__tail" onClick={(e) => e.stopPropagation()}>
          <CardMenu video={video} />
        </div>
      )}
      {variant === "search" && (
        <div className="row__tail" onClick={(e) => e.stopPropagation()}>
          <CardMenu video={video} />
        </div>
      )}
    </article>
  );
}

export function VideoGrid({
  videos,
  eagerFirst = 3,
  className,
  showChannel = true,
}: {
  videos: Video[];
  eagerFirst?: number;
  className?: string;
  showChannel?: boolean;
}) {
  return (
    <div className={cx("grid", className)}>
      {videos.map((v, i) => (
        <VideoCard key={v.id} video={v} eager={i < eagerFirst} showChannel={showChannel} />
      ))}
    </div>
  );
}

export function CompactCard({ video }: { video: Video }) {
  const channel = channelOf(video.handle);
  return (
    <Link to={`/watch?v=${video.id}`} className="compact">
      <Thumbnail video={video} showMeta={false} />
      <div>
        <p className="compact__title">{video.title}</p>
        <p className="compact__channel">{channel.name}</p>
        <p className="compact__stats">
          {compact(video.views)} views · {timeAgo(video.ageDays)}
        </p>
      </div>
    </Link>
  );
}
