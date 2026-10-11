import { useEffect, useRef, useState } from "react";
import { durationTime, playerUrl } from "../lib/format";
import { Icon } from "./Icon";

/** Ignore clicks on the preview this long after any real seek interaction. */
const SEEK_CLICK_GUARD_MS = 500;

/**
 * Muted inline preview that plays a video's first moments while the pointer is
 * over a card — YouTube's hover-to-play behaviour.
 *
 * Playback goes through YouTube's embed player (the Data API never grants stream
 * URLs). That player refuses to serve video to a private-IP parent (it throws
 * onError 150), so we listen for the player's own events and tear the frame down
 * the moment playback is blocked or never starts — the card keeps its static
 * thumbnail instead of a black box.
 *
 * While the preview is live we also paint a slim YouTube-style control layer:
 * a scrubbable timeline along the bottom and volume + captions toggles on the
 * right. These only show once playback is confirmed, and they drive the embed
 * over postMessage (seek / mute / captions) so a visitor can scrub and hear the
 * video without ever leaving the grid.
 */
export function HoverPreview({
  id,
  active,
}: {
  id: string;
  /** True while the pointer is still over the card; controls hide when false. */
  active: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [cc, setCc] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const draggingRef = useRef(false);
  // Scrubbing must never open the video. The pointerup that ends a drag lands
  // as a click on the overlay, so we ignore any click shortly after a real seek.
  const seekGuardUntilRef = useRef(0);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let confirmed = false;
    // The raw embed protocol (no API library): the parent announces itself with
    // {event:"listening", id:N} — a "command" named "listening" is ignored and
    // the player never opens its message channel. Repeat until it answers.
    const send = (msg: Record<string, unknown>) => {
      frame.contentWindow?.postMessage(JSON.stringify(msg), "*");
    };
    const handshake = () => send({ event: "listening", id: 1 });
    const command = (func: string, args: unknown[] = []) =>
      send({ event: "command", id: 1, func, args });

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      let data: { event?: string; info?: Record<string, unknown> } | null = null;
      try {
        const raw: unknown = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        data = raw && typeof raw === "object" ? (raw as { event?: string; info?: Record<string, unknown> }) : null;
      } catch {
        return;
      }
      const event = data?.event;
      if (!event) return;
      if (event === "onError") {
        setBlocked(true);
        return;
      }
      const info = data?.info;
      if (typeof info === "number" && event === "onStateChange" && info === 1) confirmed = true;
      if (!info || typeof info !== "object") return;
      if (info.playerState === 1) {
        confirmed = true;
        setPlaying(true);
      } else if (info.playerState === 2) {
        setPlaying(false);
      } else if (info.playerState === 0) {
        setPlaying(false);
      }
      if (typeof info.currentTime === "number") {
        confirmed = true;
        setCur(info.currentTime);
      }
      // Only trust `duration` for VOD-length values. For live/DVR streams the
      // embed reports a huge window (tens of hours) as `duration`/`mediaReferenceTime`,
      // which would render a nonsense readout and a useless scrubber.
      if (typeof info.duration === "number" && info.duration > 0 && info.duration <= 12 * 3600) {
        setDur(info.duration);
      }
    };

    window.addEventListener("message", onMessage);
    const hs = window.setInterval(handshake, 250);
    handshake();

    // Poll the player for its clock — infoDelivery already streams currentTime,
    // but the explicit getters keep the scrubber smooth if a tick is dropped.
    const poll = window.setInterval(() => {
      command("getCurrentTime");
      command("getDuration");
      command("getPlayerState");
    }, 400);

    // Fallback watchdog, armed only once the embed has actually loaded so we
    // don't burn a timeout on a video that errors instantly. Startup can take
    // several seconds under YouTube's embed rate limiting, so give it room
    // before declaring the player dead and falling back to the thumbnail.
    let guard: number | undefined;
    const onLoad = () => {
      if (guard !== undefined) return;
      guard = window.setTimeout(() => {
        if (!confirmed) setBlocked(true);
      }, 12000);
    };
    frame.addEventListener("load", onLoad);

    // Store command on the element so the control handlers below can reach it.
    (frame as HTMLIFrameElement & { __cmd?: (f: string, a?: unknown[]) => void }).__cmd = command;

    return () => {
      // Stop playback the moment the preview unmounts so an unhover never
      // leaves audio/video running behind a removed frame.
      command("pauseVideo");
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", onLoad);
      window.clearInterval(hs);
      window.clearInterval(poll);
      if (guard !== undefined) window.clearTimeout(guard);
    };
  }, [id]);

  const cmd = (func: string, args: unknown[] = []) => {
    const f = frameRef.current as (HTMLIFrameElement & { __cmd?: (f: string, a?: unknown[]) => void }) | null;
    f?.__cmd?.(func, args);
  };

  // Leaving the card (active=false) pauses immediately, even while the frame
  // is still mounted — don't wait for the unmount to tear the embed down.
  useEffect(() => {
    if (!active) cmd("pauseVideo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const toggleMute = () => {
    if (muted) {
      cmd("unMute");
      setMuted(false);
    } else {
      cmd("mute");
      setMuted(true);
    }
  };

  const togglePlay = () => {
    if (playing) cmd("pauseVideo");
    else cmd("playVideo");
  };

  const toggleCaptions = () => {
    if (cc) {
      cmd("setOption", ["captions", "track", ""]);
      setCc(false);
    } else {
      cmd("loadModule", ["captions"]);
      cmd("setOption", ["captions", "track", {}]);
      setCc(true);
    }
  };

  const seekAt = (clientX: number, el: HTMLElement) => {
    if (dur <= 0) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    cmd("seekTo", [ratio * dur, true]);
    setCur(ratio * dur);
    seekGuardUntilRef.current = Date.now() + SEEK_CLICK_GUARD_MS;
  };
  const onSeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    seekAt(e.clientX, e.currentTarget);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture unavailable */
    }
  };
  const onSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      e.stopPropagation();
      seekAt(e.clientX, e.currentTarget);
    }
  };
  const onSeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // Releasing a captured drag synthesises a trailing click; eat it so the
    // video doesn't open when the user lets go of the timeline.
    suppressNextClickRef.current = true;
    seekGuardUntilRef.current = Date.now() + SEEK_CLICK_GUARD_MS;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  if (blocked) return null;

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <>
      <iframe
        ref={frameRef}
        className="card__preview"
        title=""
        tabIndex={-1}
        aria-hidden="true"
        allow="autoplay; encrypted-media"
        src={playerUrl(id, true, true, 0, true, window.location.origin)}
        onClick={(e) => {
          // A click right after scrubbing is the drag releasing, not intent to
          // open the video — swallow it.
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (Date.now() < seekGuardUntilRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Clicking the frame toggles play/pause via the embed's own centre
          // overlay. Navigating here killed the toggle — the frame unmounted
          // before the pause command could land, so the video just opened.
          e.preventDefault();
          e.stopPropagation();
          togglePlay();
        }}
      />
      <span className="card__previewscrim" aria-hidden="true" />
      {playing && (
        <div
          className="card__previewctl"
          data-visible={active}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="card__seek"
            role="slider"
            aria-label="Seek preview"
            aria-valuemin={0}
            aria-valuemax={Math.floor(dur)}
            aria-valuenow={Math.floor(cur)}
            tabIndex={-1}
            onPointerDown={onSeekDown}
            onPointerMove={onSeekMove}
            onPointerUp={onSeekUp}
            onPointerCancel={onSeekUp}
          >
            <span className="card__seek-fill" style={{ width: `${pct}%` }} />
            <span className="card__seek-knob" style={{ left: `${pct}%` }} />
          </div>
          <div className="card__previewmeta">
            <span className="card__previewtime">
              {dur > 0 ? `${durationTime(cur)} / ${durationTime(dur)}` : durationTime(cur)}
            </span>
            <span className="card__previewbtns">
              <button
                className="card__previewbtn"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={toggleMute}
              >
                <Icon name={muted ? "mute" : "volume"} size={18} />
              </button>
              <button
                className="card__previewbtn"
                aria-label="Captions"
                aria-pressed={cc}
                data-on={cc || undefined}
                onClick={toggleCaptions}
              >
                <Icon name="subtitle" size={18} />
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
