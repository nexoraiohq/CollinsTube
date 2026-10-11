/**
 * Minimal typed loader for the YouTube IFrame Player API.
 * Falls back gracefully: if the script is blocked (offline, strict CSP),
 * callers catch the rejection and render a plain embed iframe instead.
 */

export type YTPlayer = {
  destroy(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoLoadedFraction(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  isMuted(): boolean;
};

type YTApi = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let pending: Promise<YTApi> | null = null;

export function loadYTApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YTApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube iframe API failed to load"));
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube iframe API timed out"));
    }, 8000);
  }).catch((err) => {
    pending = null;
    throw err;
  });

  return pending;
}
