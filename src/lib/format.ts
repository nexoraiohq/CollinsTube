/** Formatting + deterministic helpers shared across the app. */

export const compact = (n: number): string => {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (n < 1_000_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  const v = n / 1_000_000_000;
  return `${v.toFixed(1).replace(/\.0$/, "")}B`;
};

export const fullNumber = (n: number): string => n.toLocaleString("en-US");

export const timeAgo = (days: number): string => {
  if (days <= 0) return "just now";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
};

export const durationTime = (s: number): string => {
  if (s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

export const viewsLabel = (n: number, live = false): string =>
  live ? "watching now" : `${compact(n)} views`;

export const hash = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export const PALETTES: [string, string][] = [
  ["#ff0033", "#7a0019"],
  ["#7c4dff", "#3d1a9e"],
  ["#00b8d4", "#00567a"],
  ["#ff6d00", "#a83c00"],
  ["#00c853", "#00692c"],
  ["#f50057", "#8a0032"],
  ["#2979ff", "#0b3a8f"],
  ["#ffd600", "#a88a00"],
  ["#d500f9", "#75008c"],
  ["#18ffff", "#007a80"],
  ["#ff4081", "#a10042"],
  ["#64ffda", "#00806f"],
];

export const colorFor = (seed: string): [string, string] =>
  PALETTES[hash(seed) % PALETTES.length];

export const initials = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const thumbnailUrl = (id: string, quality: "hq" | "mq" | "max" = "hq"): string => {
  const file = quality === "max" ? "maxresdefault.jpg" : quality === "mq" ? "mqdefault.jpg" : "hqdefault.jpg";
  return `https://i.ytimg.com/vi/${id}/${file}`;
};

/** CDN fallback: proxied, converted to WebP — survives transient i.ytimg failures. */
export const thumbnailProxyUrl = (id: string): string =>
  `https://wsrv.nl/?url=${encodeURIComponent(`i.ytimg.com/vi/${id}/hqdefault.jpg`)}&w=480&output=webp`;

/** Channel avatars via the same CDN: resized WebP (~2 kB), cacheable, no ORB issues. */
export const avatarProxyUrl = (url: string): string =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=320&h=320&fit=cover&output=webp`;

/** Channel banner art via the CDN (wide WebP, cropped by CSS like YouTube). */
export const bannerProxyUrl = (url: string): string =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1760&output=webp`;

/** Fire-and-forget warm-up so above-the-fold art is cached before it is rendered. */
export const prefetchThumbnails = (ids: string[]): void => {
  ids.forEach((id) => {
    const img = new Image();
    img.src = thumbnailUrl(id);
  });
};

export const playerUrl = (
  id: string,
  autoplay = true,
  muted = true,
  start = 0,
  enableJsApi = false,
  origin?: string,
): string => {
  const s = Math.max(0, Math.floor(start));
  const o = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&controls=0&iv_load_policy=3&color=white&autoplay=${
    autoplay ? 1 : 0
  }&mute=${muted ? 1 : 0}${s > 0 ? `&start=${s}` : ""}${enableJsApi ? "&enablejsapi=1" : ""}${o}`;
};

/** Drop duplicate videos by id (API pages can repeat across requests). */
export const dedupeById = <T extends { id: string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  return list.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
};

/** Extract a video id from any YouTube URL shape (watch, youtu.be, shorts, live, embed). */
export const parseVideoId = (input: string): string | null => {
  const s = input.trim();
  const m =
    s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ??
    s.match(/youtube(?:-nocookie)?\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/) ??
    s.match(/youtube(?:-nocookie)?\.com\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/** Bare 11-char ids only when they look id-like (mixed case / digits / _ / -),
 *  so normal words like "programming" still search. */
export const isLikelyVideoId = (s: string): boolean =>
  /^[A-Za-z0-9_-]{11}$/.test(s) && /[A-Z0-9_-]/.test(s);

export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
