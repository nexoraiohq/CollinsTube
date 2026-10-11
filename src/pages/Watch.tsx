import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CATEGORIES } from "../data/videos";
import { CHANNELS, channelOf } from "../data/channels";
import { compact, cx, durationTime, fullNumber, parseVideoId, playerUrl, timeAgo, viewsLabel } from "../lib/format";
import { apiSearch, apiVideos, resolveApiKey } from "../lib/ytApi";
import { fetchSkipSegments, type SkipSegment } from "../lib/sponsorblock";
import type { Video } from "../types";
import { Avatar } from "../components/Avatar";
import { CommentsSection } from "../components/CommentsSection";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { SubscribeButton } from "../components/SubscribeButton";
import { Thumbnail } from "../components/Thumbnail";
import { VideoRow } from "../components/VideoCard";
import { useApp, useLibrary } from "../store/AppContext";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

// Quality ladder offered in the player settings. The embed speaks in quality
// names (hd2160, large, …) for both availableQualityLevels and the rung it
// reports back in infoDelivery, so setPlaybackQuality must be handed the same
// name to stick — a numeric itag like "313" is never recognised and the choice
// silently falls back to Auto.
const QUALITIES: { id: string; label: string; maxRes: number }[] = [
  { id: "auto", label: "Auto", maxRes: 0 },
  { id: "hd2160", label: "2160p", maxRes: 2160 },
  { id: "hd1440", label: "1440p", maxRes: 1440 },
  { id: "hd1080", label: "1080p", maxRes: 1080 },
  { id: "hd720", label: "720p", maxRes: 720 },
  { id: "large", label: "480p", maxRes: 480 },
  { id: "medium", label: "360p", maxRes: 360 },
  { id: "small", label: "240p", maxRes: 240 },
  { id: "tiny", label: "144p", maxRes: 144 },
];

const QUALITY_LABEL: Record<string, string> = {
  auto: "Auto",
  highres: "4320p",
  hd2160: "2160p",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  light: "8K",
  unknown: "Auto",
};

function Player({
  id,
  title,
  autoplay,
  startAt,
  onProgress,
  onEnded,
  overlay,
}: {
  id: string;
  title: string;
  autoplay: boolean;
  startAt: number;
  onProgress: (sec: number) => void;
  onEnded: () => void;
  overlay?: React.ReactNode;
}) {
  const { toast } = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hideRef = useRef<number | undefined>(undefined);
  const dragRef = useRef(false);
  const qualRetryRef = useRef<number | undefined>(undefined);
  const playingRef = useRef(false);
  const settingsRef = useRef<"root" | "speed" | "quality" | null>(null);
  const [playError, setPlayError] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [vol, setVol] = useState(100);
  const [muted, setMuted] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [settings, setSettingsState] = useState<"root" | "speed" | "quality" | null>(null);
  const [speed, setSpeed] = useState(1);
  // The rung the player actually picked on its own (shown while quality is
  // "auto"), plus a pinned choice the user made from the settings menu.
  const [autoQuality, setAutoQuality] = useState("hd720");
  const [quality, setQuality] = useState("auto");
  const autoQualityRef = useRef("hd720");
  const qualityPickedRef = useRef(false);
  const qualityRef = useRef("auto");
  qualityRef.current = quality;
  // Rungs the stream actually ships, reported by the embed in infoDelivery as
  // availableQualityLevels. The menu offers only these (plus Auto), so a
  // resolution the video doesn't have can never be picked and look broken.
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const availableQualitiesRef = useRef<string[]>([]);
  const [stats, setStats] = useState(false);
  const [sbSegments, setSbSegments] = useState<SkipSegment[]>([]);
  const sbSkipRef = useRef<string | null>(null);

  const cb = useRef({ onProgress, onEnded });
  cb.current = { onProgress, onEnded };
  const startRef = useRef(startAt);
  startRef.current = startAt;
  settingsRef.current = settings;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const poke = () => {
    setChrome(true);
    window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      if (playingRef.current && settingsRef.current === null && !dragRef.current) setChrome(false);
    }, 2600);
  };
  const setSettings = (v: "root" | "speed" | "quality" | null) => {
    setSettingsState(v);
    if (v) poke();
  };

  const post = (func: string, args: unknown[] = []) => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(JSON.stringify({ event: "command", id: 1, func, args }), "*");
  };

  const report = (t: number) => {
    setCur(t);
    if (sbSegments.length && playingRef.current) {
      const hit = sbSegments.find((s) => t >= s.start && t < s.end - 0.6);
      if (hit) {
        const skipKey = `${hit.category}:${hit.start.toFixed(1)}`;
        if (sbSkipRef.current !== skipKey) {
          sbSkipRef.current = skipKey;
          post("seekTo", [hit.end, true]);
          t = hit.end;
          setCur(hit.end);
        }
      }
    }
    cb.current.onProgress(t);
  };
  const reportRef = useRef(report);
  reportRef.current = report;
  const ended = () => {
    setPlaying(false);
    playingRef.current = false;
    cb.current.onEnded();
  };
  const endedRef = useRef(ended);
  endedRef.current = ended;

  const applyVol = (v: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(v)));
    post("setVolume", [clamped]);
    setVol(clamped);
    if (clamped > 0 && muted) {
      post("unMute");
      setMuted(false);
    }
  };
  const toggleMute = () => {
    if (muted) {
      post("unMute");
      setMuted(false);
    } else {
      post("mute");
      setMuted(true);
    }
    poke();
  };
  // Pin a quality rung (or go back to Auto). setPlaybackQuality is a soft
  // request the embed may ignore on the first call, so we assert it now and
  // re-assert it shortly after if the reported rung hasn't matched — real
  // YouTube behaves the same way (the choice sticks once ABR settles).
  const applyQuality = (id: string) => {
    const rung = QUALITIES.find((q) => q.id === id);
    setQuality(id);
    window.clearTimeout(qualRetryRef.current);
    if (!rung) return;
    if (id === "auto") {
      qualityPickedRef.current = false;
      post("setPlaybackQuality", ["auto"]);
      setSettings(null);
      poke();
      return;
    }
    qualityPickedRef.current = true;
    // Hand the embed the same quality name it reports back; a numeric itag is
    // not recognised and the pin would silently fall back to Auto.
    post("setPlaybackQuality", [rung.id]);
    // Re-assert a couple of times, then keep the pin only if the rung is one
    // this stream actually offers. The old check compared against the rung the
    // player happens to be on, which is never the rung you just picked — so any
    // real change looked "unavailable" and snapped back to Auto.
    let tries = 0;
    const assert = () => {
      tries += 1;
      const lv = availableQualitiesRef.current;
      const supported = lv.length === 0 || lv.includes(rung.id);
      if (supported || tries >= 3) {
        if (!supported) {
          qualityPickedRef.current = false;
          post("setPlaybackQuality", ["auto"]);
          setQuality("auto");
          toast(`Quality unavailable — staying on ${QUALITY_LABEL[autoQualityRef.current] ?? "Auto"}`);
        }
        return;
      }
      post("setPlaybackQuality", [rung.id]);
      qualRetryRef.current = window.setTimeout(assert, 900);
    };
    qualRetryRef.current = window.setTimeout(assert, 900);
    setSettings(null);
    poke();
  };
  const activeQualityId = quality === "auto" ? "auto" : quality;
  const activeQualityLabel =
    quality === "auto"
      ? `${QUALITY_LABEL[autoQuality] ?? "Auto"} (Auto)`
      : (QUALITIES.find((q) => q.id === quality)?.label ?? "Auto");
  const togglePlay = () => {
    if (playingRef.current) post("pauseVideo");
    else post("playVideo");
    poke();
  };
  const toggleFullscreen = () => {
    // Fullscreen the video itself, not our 16:9 wrapper. On a phone the wrapper
    // would letterbox into a portrait void, whereas the embed's own fullscreen
    // fills the screen and rotates into the video's native landscape — the same
    // as tapping fullscreen on real YouTube. On desktop the wrapper already
    // matches the video's 16:9, so either target fills identically.
    const frame = frameRef.current;
    const doc = frame?.ownerDocument ?? document;
    if (doc.fullscreenElement) {
      void doc.exitFullscreen?.();
      return;
    }
    if (frame) {
      const request = frame.requestFullscreen?.bind(frame)
        // Safari (iPhone) only exposes the prefixed WebKit entry point.
        ?? (frame as HTMLIFrameElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.bind(frame);
      if (request) {
        void request();
        return;
      }
    }
    const el = rootRef.current;
    if (!el) return;
    void el.requestFullscreen?.();
  };

  const seekAt = (clientX: number, el: HTMLElement) => {
    if (dur <= 0) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    post("seekTo", [ratio * dur, true]);
    setCur(ratio * dur);
  };
  const onSeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dragRef.current = true;
    poke();
    seekAt(e.clientX, e.currentTarget);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture unavailable */
    }
  };
  const onSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      poke();
      seekAt(e.clientX, e.currentTarget);
    }
  };
  const onSeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const k = e.key;
      if (k === " " || k === "k" || k === "K") {
        e.preventDefault();
        togglePlay();
      } else if (k === "m" || k === "M") {
        toggleMute();
      } else if (k === "f" || k === "F") {
        toggleFullscreen();
      } else if (k === "ArrowRight") {
        e.preventDefault();
        post("seekTo", [Math.min(dur, cur + 5), true]);
        poke();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        post("seekTo", [Math.max(0, cur - 5), true]);
        poke();
      } else if (k === "ArrowUp") {
        e.preventDefault();
        applyVol(vol + 5);
      } else if (k === "ArrowDown") {
        e.preventDefault();
        applyVol(vol - 5);
      } else if (k === "Escape") {
        setSettings(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSbSegments([]);
    sbSkipRef.current = null;
    fetchSkipSegments(id).then((segs) => {
      if (!cancelled && segs.length) setSbSegments(segs);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const start = Math.max(0, Math.floor(startRef.current));
    setPlayError(false);
    setMuted(true);
    setPlaying(autoplay);
    playingRef.current = autoplay;

    // Plain embed + enablejsapi works on every origin (localhost, LAN IP, phone).
    // The YT IFrame API script itself rejects private-IP parent pages, so we talk
    // to the embed directly over postMessage instead of loading that script.
    const src = playerUrl(id, autoplay, true, start, true, window.location.origin);
    host.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "origin";
    iframe.loading = "eager";
    iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;";
    host.appendChild(iframe);
    frameRef.current = iframe;

    const send = (func: string, args: unknown[] = []) => {
      const w = iframe.contentWindow;
      if (!w) return;
      w.postMessage(JSON.stringify({ event: "command", id: 1, func, args }), "*");
    };
    const listening = () => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
    };

    // The embed only accepts commands and emits infoDelivery after this handshake.
    listening();
    const listenTimer = window.setInterval(listening, 1000);

    // Mobile browsers block unmuted autoplay before a user gesture; start muted
    // and let the first tap on the surface unmute.
    const muteTimer = window.setTimeout(() => send("mute"), 300);
    const playTimer = window.setTimeout(() => {
      if (autoplay) send("playVideo");
      setReady(true);
    }, 600);

    const progressTimer = window.setInterval(() => {
      if (cancelled) return;
      send("getDuration");
      send("getCurrentTime");
      send("getVideoLoadedFraction");
      send("getPlayerState");
      // Reported media size + current ABR rung; the quality menu prunes rungs
      // above the stream's real resolution and pins the selection to a rung
      // the player actually lands on.
      send("getVideoData");
      send("getPlaybackQuality");
    }, 1000);

    const onMsg = (e: MessageEvent) => {
      if (cancelled || e.source !== iframe.contentWindow) return;
      let data: { event?: string; info?: Record<string, unknown> } | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      // The embed answers polled getters (getVideoData, getPlaybackQuality,
      // getDuration, …) as `initialDelivery`, while its own pushed updates use
      // `infoDelivery`. Both carry the same flat `info` shape, so accept either
      // or the polled fields never arrive.
      if ((data?.event !== "infoDelivery" && data?.event !== "initialDelivery") || !data.info) return;
      const info = data.info;
      if (typeof info.duration === "number" && info.duration > 0) setDur(info.duration);
      if (typeof info.videoLoadedFraction === "number") setBuf(Math.round(info.videoLoadedFraction * 100));
      if (typeof info.playbackRate === "number" && info.playbackRate !== speedRef.current) setSpeed(info.playbackRate);
      // Current ABR rung. Always tracked — even while a rung is pinned — so the
      // pin's "landed" check can tell when the player settles on the choice.
      if (typeof info.playbackQuality === "string") {
        const q = info.playbackQuality as string;
        if (q !== autoQualityRef.current) {
          autoQualityRef.current = q;
          setAutoQuality(q);
        }
      }
      // Rungs this stream actually ships (e.g. hd1080, hd720, large, …). Used to
      // prune the quality menu down to choices that really exist, so picking one
      // can never silently fall back to Auto.
      if (Array.isArray(info.availableQualityLevels)) {
        const lv = (info.availableQualityLevels as unknown[]).filter(
          (x): x is string => typeof x === "string" && x !== "auto",
        );
        if (lv.length && lv.join() !== availableQualitiesRef.current.join()) {
          availableQualitiesRef.current = lv;
          setAvailableQualities(lv);
        }
      }
      if (typeof info.playerState === "number") {
        const s = info.playerState;
        if (s === 1) {
          setPlaying(true);
          playingRef.current = true;
          poke();
        } else if (s === 2) {
          setPlaying(false);
          playingRef.current = false;
          poke();
        } else if (s === 0) {
          setPlaying(false);
          playingRef.current = false;
          endedRef.current();
        }
      }
      if (typeof info.currentTime === "number") reportRef.current(info.currentTime);
    };
    window.addEventListener("message", onMsg);

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMsg);
      window.clearInterval(listenTimer);
      window.clearInterval(progressTimer);
      window.clearTimeout(muteTimer);
      window.clearTimeout(playTimer);
      window.clearTimeout(hideRef.current);
      window.clearTimeout(qualRetryRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, autoplay, title]);

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className="player" ref={rootRef} onPointerMove={poke}>
      <div className="player__host" ref={hostRef} />
      <div
        className="player__surface"
        onPointerDown={() => {
          setSettings(null);
          poke();
          togglePlay();
        }}
      />

      {stats && ready && (
        <div className="player__stats" role="status">
          <p>
            <strong>CollinsTube stats</strong>
          </p>
          <p>Video ID: {id}</p>
          <p>Playback rate: {speed}×</p>
          <p>
            Time: {durationTime(cur)} / {durationTime(dur)}
          </p>
          <p>Buffered: {buf}%</p>
          <p>State: {playing ? "playing" : "paused"}</p>
          <p>
            SponsorBlock:{" "}
            {sbSegments.length ? `${sbSegments.length} segments (auto-skip on)` : "no segments"}
          </p>
        </div>
      )}

      {ready && (
        <div className={cx("ctl", !chrome && !settings && "ctl--hidden")}>
          <div
            className="ctl__seek"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(dur)}
            aria-valuenow={Math.floor(cur)}
            tabIndex={0}
            onPointerDown={onSeekDown}
            onPointerMove={onSeekMove}
            onPointerUp={onSeekUp}
            onPointerCancel={onSeekUp}
          >
            <span className="ctl__buf" style={{ width: `${buf}%` }} />
            <span className="ctl__fill" style={{ width: `${pct}%` }} />
            <span className="ctl__knob" style={{ left: `${pct}%` }} />
          </div>

          <div className="ctl__row">
            <button className="ctl__btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              <Icon name={playing ? "pause" : "play"} size={22} />
            </button>
            <button className="ctl__btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              <Icon name={muted ? "mute" : "volume"} size={22} />
            </button>
            <input
              className="ctl__vol"
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : vol}
              onChange={(e) => applyVol(Number(e.target.value))}
              aria-label="Volume"
            />
            <span className="ctl__time">
              {durationTime(cur)} / {durationTime(dur)}
            </span>
            <span className="ctl__spacer" />

            {sbSegments.length > 0 && (
              <span
                className="ctl__sb"
                title={`SponsorBlock: auto-skipping ${sbSegments.length} segment${sbSegments.length === 1 ? "" : "s"}`}
              >
                <Icon name="check" size={14} /> SB {sbSegments.length}
              </span>
            )}

            <span className="ctl__anchor">
              <button
                className={cx("ctl__btn", settings && "is-active")}
                onClick={() => setSettings(settings ? null : "root")}
                aria-label="Settings"
                aria-expanded={!!settings}
              >
                <Icon name="settings" size={20} />
              </button>

              {settings && (
                <div className="ctl__pop" role="menu" onClick={(e) => e.stopPropagation()}>
                  {settings === "root" ? (
                    <>
                      <button className="ctl__pop-item" onClick={() => setSettings("quality")}>
                        <span>Quality</span>
                        <strong>{activeQualityLabel}</strong>
                        <Icon name="chevronRight" size={16} />
                      </button>
                      <button className="ctl__pop-item" onClick={() => setSettings("speed")}>
                        <span>Playback speed</span>
                        <strong>{speed === 1 ? "Normal" : `${speed}×`}</strong>
                        <Icon name="chevronRight" size={16} />
                      </button>
                      <button
                        className="ctl__pop-item"
                        onClick={() => {
                          setStats((s) => !s);
                          setSettings(null);
                        }}
                      >
                        <span>Stats for nerds</span>
                        <strong>{stats ? "On" : "Off"}</strong>
                      </button>
                    </>
                  ) : settings === "quality" ? (
                    <>
                      <button className="ctl__pop-item ctl__pop-item--back" onClick={() => setSettings("root")}>
                        <Icon name="arrowBack" size={16} />
                        <span>Quality</span>
                      </button>
                      {QUALITIES.filter(
                        // Offer only rungs the stream actually ships, per the
                        // embed's availableQualityLevels. Once that list arrives,
                        // drop anything it left out — offering 4K on a 720p-only
                        // video just makes a selection silently fall back to Auto.
                        (q) =>
                          q.maxRes === 0 ||
                          availableQualities.length === 0 ||
                          availableQualities.includes(q.id),
                      ).map((q) => (
                        <button
                          key={q.id}
                          className={cx("ctl__pop-item", q.id === activeQualityId && "is-on")}
                          onClick={() => applyQuality(q.id)}
                        >
                          <span>{q.label}</span>
                          {q.id === activeQualityId && <Icon name="check" size={16} />}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <button className="ctl__pop-item ctl__pop-item--back" onClick={() => setSettings("root")}>
                        <Icon name="arrowBack" size={16} />
                        <span>Playback speed</span>
                      </button>
                      {SPEEDS.map((v) => (
                        <button
                          key={v}
                          className={cx("ctl__pop-item", v === speed && "is-on")}
                          onClick={() => {
                            post("setPlaybackRate", [v]);
                            setSpeed(v);
                            setSettings(null);
                          }}
                        >
                          <span>{v === 1 ? "Normal" : `${v}×`}</span>
                          {v === speed && <Icon name="check" size={16} />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </span>

            <button className="ctl__btn" onClick={toggleFullscreen} aria-label="Fullscreen">
              <Icon name="fullscreen" size={20} />
            </button>
          </div>
        </div>
      )}

      {overlay}
    </div>
  );
}

export function WatchPage({ onNeedSignIn }: { onNeedSignIn: () => void }) {
  const [params] = useSearchParams();
  const rawId = params.get("v") ?? "";
  const normalizedId = parseVideoId(rawId) ?? (/^[A-Za-z0-9_-]{11}$/.test(rawId) ? rawId : null);
  const { videos, find } = useLibrary();
  const known = find(normalizedId);
  const knownId = known?.id ?? null;
  const nav = useNavigate();
  const { state, addHistory, toggleLike, toggleDislike, toggleSave, toast, setMiniPlayer, addImport, setProgress } =
    useApp();

  const [theater, setTheater] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [remote, setRemote] = useState<{
    id: string;
    state: "loading" | "ok" | "invalid";
    video?: Video;
  } | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveCat, setSaveCat] = useState(CATEGORIES[1] ?? "Music");
  const [saveTags, setSaveTags] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [nextUp, setNextUp] = useState<{ next: Video; from: string } | null>(null);
  const [count, setCount] = useState(5);
  const lastSavedRef = useRef(0);
  const key = resolveApiKey(state.apiKey);
  const [enriched, setEnriched] = useState<{ id: string; video: Video } | null>(null);
  const [apiRelated, setApiRelated] = useState<Video[]>([]);

  useEffect(() => {
    if (!normalizedId || normalizedId === knownId) {
      setRemote(null);
      return;
    }
    const ctrl = new AbortController();
    setRemote({ id: normalizedId, state: "loading" });
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${normalizedId}`,
    )}&format=json`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { title?: string; author_name?: string; author_url?: string }) => {
        const handle = (j.author_url?.match(/@[\w.-]+/)?.[0] ?? "@youtube").toLowerCase();
        setRemote({
          id: normalizedId,
          state: "ok",
          video: {
            id: normalizedId,
            title: j.title || "YouTube video",
            channel: j.author_name || "YouTube",
            handle,
            views: 0,
            ageDays: 0,
            duration: -1,
            description: "",
            tags: [],
            category: "Imported",
            likes: 0,
            imported: true,
          },
        });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setRemote({ id: normalizedId, state: "invalid" });
      });
    return () => ctrl.abort();
  }, [normalizedId, knownId]);

  // Enrich unknown videos with live data (views, description, tags) and
  // fetch real related videos via the official Data API when a key is set.
  useEffect(() => {
    if (!key || !normalizedId || knownId) {
      setEnriched(null);
      setApiRelated([]);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const vids = await apiVideos(key, [normalizedId]);
        if (ctrl.signal.aborted) return;
        const v = vids[0];
        if (v) setEnriched({ id: normalizedId, video: v });
        const qWords = (v?.title ?? "")
          .split(/\s+/)
          .filter((w) => w.length > 3 && !/^(this|that|with|from|your|have|video)$/i.test(w))
          .slice(0, 6);
        if (qWords.length >= 2) {
          const res = await apiSearch(key, {
            q: qWords.join(" "),
            type: "video",
            order: "relevance",
            maxResults: 16,
          });
          if (ctrl.signal.aborted) return;
          setApiRelated(res.videos.filter((rv) => rv.id !== normalizedId));
        }
      } catch {
        /* best-effort: oEmbed/local fallback remains */
      }
    })();
    return () => ctrl.abort();
  }, [key, normalizedId, knownId]);

  const remoteFor = remote && remote.id === normalizedId ? remote : null;
  const enrichedFor = enriched && enriched.id === normalizedId ? enriched : null;
  const video = known ?? enrichedFor?.video ?? (remoteFor?.state === "ok" ? remoteFor.video : undefined);
  const unavailable = !video && !!normalizedId && remoteFor?.state === "invalid";
  const loading = !video && !unavailable && !!normalizedId;

  useEffect(() => {
    if (knownId) return;
    if (remoteFor?.state === "ok" && remoteFor.video) {
      document.title = `${remoteFor.video.title} — YouTube Clone`;
    } else if (!normalizedId || remoteFor?.state === "invalid") {
      document.title = "Video unavailable — YouTube Clone";
    }
  }, [knownId, normalizedId, remoteFor]);

  const watchId = video?.id ?? null;

  useEffect(() => {
    if (!watchId) return;
    addHistory(watchId);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchId]);

  useEffect(() => {
    if (!watchId) return;
    return () =>
      setMiniPlayer({ id: watchId, start: state.progress[watchId] ?? 0, expanded: false, video });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "t" || e.key === "T") setTheater((v) => !v);
      if (e.key === "a" || e.key === "A") setAutoplay((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    lastSavedRef.current = state.progress[watchId ?? ""] ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchId]);

  useEffect(() => {
    setNextUp(null);
    setCount(5);
  }, [watchId]);

  useEffect(() => {
    if (!nextUp || nextUp.from !== watchId) return;
    setCount(5);
    const iv = window.setInterval(() => setCount((c) => c - 1), 1000);
    return () => window.clearInterval(iv);
  }, [nextUp, watchId]);

  useEffect(() => {
    if (nextUp && nextUp.from === watchId && count <= 0) {
      const target = nextUp.next.id;
      setNextUp(null);
      nav(`/watch?v=${target}`);
    }
  }, [count, nextUp, watchId, nav]);

  const related = useMemo(() => {
    const score = (v: Video) =>
      (v.handle === video?.handle ? 5 : 0) +
      (v.category === video?.category ? 3 : 0) +
      (video ? v.tags.filter((t) => video.tags.includes(t)).length * 2 : 0);
    const localList = video
      ? [...videos.filter((v) => v.id !== video.id)]
          .sort((a, b) => score(b) - score(a))
          .slice(0, 16)
      : videos.slice(0, 12);
    if (!apiRelated.length) return localList;
    const seen = new Set(localList.map((v) => v.id));
    const remoteList = apiRelated.filter((v) => v.id !== video?.id && !seen.has(v.id));
    return [...remoteList, ...localList].slice(0, 16);
  }, [video, videos, apiRelated]);

  if (!video && loading) {
    return (
      <div className="page watch watch--missing">
        <div className="empty">
          <div className="empty__art">
            <Icon name="info" size={40} />
          </div>
          <h2>Looking up this video…</h2>
          <p className="muted">Checking YouTube for a video with this ID.</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="page watch watch--missing">
        <div className="empty">
          <div className="empty__art">
            <Icon name="info" size={40} />
          </div>
          <h2>This video isn't available</h2>
          <p className="muted">
            The link may be broken or the video was removed. Try one of these instead.
          </p>
          <button className="btn btn--primary" onClick={() => nav("/")}>
            Go to Home
          </button>
        </div>
        <aside className="watch__rail">
          {related.slice(0, 8).map((v) => (
            <VideoRow key={v.id} video={v} variant="related" />
          ))}
        </aside>
      </div>
    );
  }

  const baseChannel = channelOf(video.handle);
  const channel = CHANNELS[video.handle] ? baseChannel : { ...baseChannel, name: video.channel };
  const liked = state.liked.includes(video.id);
  const disliked = state.disliked.includes(video.id);
  const saved = state.saved.includes(video.id);
  const likeCount = video.likes + (liked ? 1 : 0);

  const share = () => {
    const url = `${location.origin}/watch?v=${video.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast("Link copied to clipboard", { actionLabel: "Copy again", onAction: share });
  };

  const saveImport = () => {
    if (!video || known) return;
    addImport({
      ...video,
      category: CATEGORIES.includes(saveCat) && saveCat !== "All" ? saveCat : "Music",
      tags: saveTags
        .split(",")
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
      description: saveDesc.trim(),
      imported: true,
    });
    setShowSave(false);
    toast("Saved to your library — it now shows up in Home and search");
  };

  const savedSec = state.progress[video.id] ?? 0;
  const resumeAt = video.duration > 0 && savedSec >= video.duration - 2 ? 0 : savedSec;

  const handleProgress = (t: number) => {
    const sec = Math.floor(t);
    if (sec < 1 || sec <= lastSavedRef.current) return;
    lastSavedRef.current = sec;
    setProgress(video.id, sec);
  };

  const handleEnded = () => {
    if (video.duration > 0) {
      lastSavedRef.current = video.duration;
      setProgress(video.id, video.duration);
    }
    const next = related[0];
    if (autoplay && next && next.id !== video.id) setNextUp({ next, from: video.id });
  };

  return (
    <div className={cx("watch", theater && "watch--theater")}>
      <div className="player-col">
        <Player
          id={video.id}
          title={video.title}
          autoplay={autoplay}
          startAt={resumeAt}
          onProgress={handleProgress}
          onEnded={handleEnded}
          overlay={
            nextUp && nextUp.from === watchId ? (
              <div className="upnext">
                <div className="upnext__head">
                  <span className="upnext__kicker">Up next in {count}…</span>
                  <button
                    className="iconbtn upnext__close"
                    onClick={() => setNextUp(null)}
                    aria-label="Cancel up next"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="upnext__row">
                  <Thumbnail video={nextUp.next} showMeta={false} className="upnext__thumb" />
                  <div className="upnext__meta">
                    <p className="upnext__title">{nextUp.next.title}</p>
                    <p className="upnext__channel">
                      {nextUp.next.channel || channelOf(nextUp.next.handle).name}
                    </p>
                  </div>
                </div>
                <div className="upnext__actions">
                  <button className="btn btn--ghost" onClick={() => setNextUp(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={() => {
                      const target = nextUp.next.id;
                      setNextUp(null);
                      nav(`/watch?v=${target}`);
                    }}
                  >
                    Play now
                  </button>
                </div>
                <span className="upnext__bar" style={{ width: `${((5 - count) / 5) * 100}%` }} />
              </div>
            ) : null
          }
        />

        <div className="watch__below">
          <h1 className="watch__title">{video.title}</h1>

          <div className="watch__metarow">
            <div className="channelrow">
              <Link to={`/${channel.handle}`} className="channelrow__id">
                <Avatar name={channel.name} size={40} src={video.avatar ?? channel.avatar} />
                <span>
                  <strong>
                    {channel.name}
                    {video.verified && <Icon name="verified" size={14} className="verified" />}
                  </strong>
                  <small>
                    {channel.subscribers > 0 ? `${compact(channel.subscribers)} subscribers` : "New channel"}
                  </small>
                </span>
              </Link>
              <SubscribeButton handle={channel.handle} showCount={false} />
            </div>

            <div className="actions">
            <div className="segmented">
              <button
                className={cx("segmented__btn", liked && "is-active")}
                onClick={() => toggleLike(video.id)}
                aria-pressed={liked}
              >
                <Icon name="thumbUp" size={20} />
                {compact(likeCount)}
              </button>
              <span className="segmented__divider" />
              <button
                className={cx("segmented__btn", disliked && "is-active")}
                onClick={() => toggleDislike(video.id)}
                aria-pressed={disliked}
                aria-label="Dislike"
              >
                <Icon name="thumbDown" size={20} />
              </button>
            </div>
            <button className="pill" onClick={share}>
              <Icon name="share" size={20} /> Share
            </button>
            <button
              className="pill"
              onClick={() => {
                const el = document.getElementById("comments");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              aria-label="Jump to comments"
            >
              <Icon name="feedback" size={20} /> Comments
            </button>
            <button
              className="pill"
              onClick={() => toast("Download queued — demo mode", { actionLabel: "Details", onAction: () => toast("No file is really downloaded") })}
            >
              <Icon name="download" size={20} /> Download
            </button>
            <button
              className={cx("pill", saved && "is-active")}
              onClick={() => {
                toggleSave(video.id);
                toast(saved ? "Removed from Watch later" : "Saved to Watch later", {
                  actionLabel: "View",
                  actionTo: "/playlist?list=WL",
                });
              }}
            >
              <Icon name={saved ? "saved" : "save"} size={20} /> {saved ? "Saved" : "Save"}
            </button>
            {video.imported && !known && (
              <button className="pill" onClick={() => setShowSave(true)}>
                <Icon name="plus" size={20} /> Save to library
              </button>
            )}
            <button className="pill" onClick={() => toast("Clip, transcript and speed options coming next")}>
              <Icon name="more" size={20} />
            </button>
            </div>
          </div>

          <div className={cx("desc", expanded && "is-open")} onClick={() => setExpanded(true)}>
            <p className="desc__stats">
              {video.imported
                ? "Imported from YouTube · just now"
                : `${viewsLabel(video.views, video.live)} · ${
                    video.live ? "Started streaming 2 hours ago" : `Streamed live ${timeAgo(video.ageDays)}`
                  }`}
              {video.tags.map((t) => (
                <Link
                  className="desc__tag"
                  key={t}
                  to={`/results?search_query=%23${encodeURIComponent(t)}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  #{t}
                </Link>
              ))}
            </p>
            <p className="desc__text">
              {video.description.split(/(#[A-Za-z0-9_]+)/).map((part, i) =>
                part.startsWith("#") && part.length > 1 ? (
                  <Link
                    key={i}
                    className="desc__hashtag"
                    to={`/results?search_query=${encodeURIComponent(part)}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {part}
                  </Link>
                ) : (
                  part
                ),
              )}
            </p>
            <p className="desc__text desc__text--more">
              Filmed and published by {channel.name}. Follow for more, and turn on notifications so you never
              miss an upload. Business enquiries via the channel page — links in the description.
            </p>
            <button
              className="linkbtn desc__toggle"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </div>

          <CommentsSection videoId={video.id} onNeedSignIn={onNeedSignIn} />
        </div>
      </div>

      <aside className="watch__rail">
        {related.map((v) => (
          <VideoRow key={v.id} video={v} variant="related" />
        ))}

        <p className="rail__foot muted">
          Showing {related.length} of {videos.length} videos · {fullNumber(channel.totalViews)} channel views
        </p>
      </aside>

      <Modal open={showSave} onClose={() => setShowSave(false)} label="Save to your library" size="sm">
        <div className="saveform">
          <label className="field">
            <span>Title</span>
            <input value={video.title} readOnly />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={saveCat} onChange={(e) => setSaveCat(e.target.value)}>
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tags — comma separated, powers search</span>
            <input
              placeholder="e.g. reaction, live, gaming"
              value={saveTags}
              onChange={(e) => setSaveTags(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Description — optional</span>
            <textarea
              rows={3}
              placeholder="What is this video about?"
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
            />
          </label>
          <div className="saveform__actions">
            <button className="btn btn--ghost" onClick={() => setShowSave(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={saveImport}>
              Save video
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
