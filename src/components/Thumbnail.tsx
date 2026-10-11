import { useEffect, useRef, useState } from "react";
import type { Video } from "../types";
import { colorFor, cx, durationTime, thumbnailProxyUrl, thumbnailUrl } from "../lib/format";

/**
 * Real YouTube artwork with a two-stage source (direct CDN → proxied WebP CDN)
 * and a deterministic, art-directed fallback so the UI never shows a broken
 * image (offline, deleted video, rate limits…) and never gets stuck on a
 * skeleton — even when the browser answered from cache before React attached
 * its load handler.
 */
export function Thumbnail({
  video,
  className,
  eager = false,
  showMeta = true,
}: {
  video: Video;
  className?: string;
  eager?: boolean;
  showMeta?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<0 | 1>(0);
  const [failed, setFailed] = useState(false);
  const [from, to] = colorFor(video.id);

  useEffect(() => {
    setLoaded(false);
    setStage(0);
    setFailed(false);
  }, [video.id]);

  const src = stage === 0 ? thumbnailUrl(video.id) : thumbnailProxyUrl(video.id);

  return (
    <div className={cx("thumb", className)} data-loaded={loaded || failed}>
      {!failed ? (
        <img
          className="thumb__img"
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          ref={(el) => {
            if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          onError={() => (stage === 0 ? setStage(1) : setFailed(true))}
        />
      ) : (
        <div className="thumb__fallback" style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}>
          <span className="thumb__fallback-mark">▶</span>
          <span className="thumb__fallback-title">{video.title}</span>
        </div>
      )}

      {showMeta && (
        <>
          {(video.live || durationTime(video.duration) !== "") && (
            <span className={cx("thumb__duration", video.live && "thumb__duration--live")}>
              {video.live ? "LIVE" : durationTime(video.duration)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
