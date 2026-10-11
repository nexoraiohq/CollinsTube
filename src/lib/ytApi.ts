/**
 * YouTube Data API v3 client — the official, documented, free-quota content
 * source for CollinsTube.
 *
 * Quota (free tier, no credit card required for a key):
 *   - 10,000 units/day per project + a separate 100 search.list calls/day bucket.
 *   - search.list = 1 unit/call, videos.list = 1, channels.list = 1,
 *     playlistItems.list = 1, videos.list?chart=mostPopular = 1.
 *   CollinsTube spends ~3 units per search page (search + video details +
 *   channel handles), ~2 units per trending page, ~1+N units for a channel page.
 *
 * Auth: API key only for public reads (search/list). OAuth is NOT used —
 * private user data (subscriptions, watch history sync) is unsupported.
 *
 * Restrictions:
 *   - The Data API never grants video stream URLs or playback rights.
 *   - relatedToVideoId was removed in 2023; recommendations are approximated
 *     with relevance search over title keywords.
 *   - The key is embedded client-side by design (static site, no backend).
 *     Restrict it in Google Cloud to the YouTube Data API v3 + your origin.
 */

import type { Channel, Video } from "../types";

const YT_API = "https://www.googleapis.com/youtube/v3";

/**
 * Built-in key — used when no key is saved in Settings. This is a real,
 * working key: videos.list (trending) and channels.list return 200 with it.
 *
 * search.list is a SEPARATE per-PROJECT bucket (~100 queries/day). A brand-new
 * key created in the SAME Google Cloud project shares that exhausted bucket, so
 * search/Live chips can still 429 until midnight Pacific (or until a new
 * project is used). That is a Google limit, not a key problem.
 */
const BUILTIN_KEY = "AIzaSyAELjwlHQ2Tr48Tm2RcE08QAjMbJ8PK15I";

export type YtApiErrorKind = "no-key" | "quota" | "key" | "network" | "http";

export class YtApiError extends Error {
  kind: YtApiErrorKind;
  /** Google's own message, when we have one — lets the UI say why, not just that. */
  detail?: string;
  constructor(kind: YtApiErrorKind, message: string, detail?: string) {
    super(message);
    this.kind = kind;
    this.detail = detail;
    this.name = "YtApiError";
  }
}

export function resolveApiKey(storeKey?: string | null): string | null {
  const fromStore = (storeKey ?? "").trim();
  if (fromStore) return fromStore;
  const fromEnv = (import.meta.env.VITE_YT_API_KEY ?? "").trim();
  return fromEnv || BUILTIN_KEY;
}

export function apiKeySource(storeKey?: string | null): "settings" | "env" | "builtin" | "none" {
  if ((storeKey ?? "").trim()) return "settings";
  if ((import.meta.env.VITE_YT_API_KEY ?? "").trim()) return "env";
  return BUILTIN_KEY ? "builtin" : "none";
}

/**
 * Notified when a stored Settings key is rejected as invalid. The app store
 * registers a listener so it can clear state.apiKey too — otherwise the
 * persist-effect re-writes the dead key straight back to localStorage on the
 * next state change and the self-heal never actually sticks.
 */
type KeyRejectedListener = () => void;
let keyRejectedListener: KeyRejectedListener | null = null;
export function onKeyRejected(fn: KeyRejectedListener | null): void {
  keyRejectedListener = fn;
}

/**
 * Drop any API key saved in Settings. Called when Google rejects a stored key
 * as invalid so the next load falls back to the built-in key instead of
 * re-using the same dead one. localStorage is per-origin, so a phone on the
 * LAN IP can end up with a different (stale) stored key than desktop on
 * localhost even though both open the same app.
 */
function clearStoredApiKey(): void {
  try {
    // The app persists its whole state under ytclone.state.v1 — wipe the
    // apiKey field inside it so a rejected key can't stick on one device.
    const raw = localStorage.getItem("ytclone.state.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      delete parsed.apiKey;
      localStorage.setItem("ytclone.state.v1", JSON.stringify(parsed));
    }
    localStorage.removeItem("collinstube.apiKey");
    localStorage.removeItem("ytclone.apiKey");
  } catch {
    /* storage unavailable — non-fatal */
  }
  // Also clear the in-memory state so the persist-effect doesn't restore it.
  keyRejectedListener?.();
}

export function friendlyApiError(err: unknown): string {
  if (err instanceof YtApiError) {
    switch (err.kind) {
      case "quota":
        return "YouTube's free daily quota for this API key is used up. It resets at midnight Pacific Time.";
      case "key":
        return "YouTube rejected this API key. Check that it is for the YouTube Data API v3 and not restricted for this origin.";
      case "network":
        return "Could not reach YouTube. Check your connection and try again.";
      case "no-key":
        return "No API key configured.";
      default:
        return err.message;
    }
  }
  return "Unexpected error while contacting YouTube.";
}

type ApiThumbnails = { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string }; url?: string };

type ApiSnippet = {
  title?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  liveBroadcastContent?: string;
  customUrl?: string;
  tags?: string[];
  categoryId?: string;
  thumbnails?: ApiThumbnails;
  country?: string;
  localized?: { title?: string; description?: string };
};

/** channelThumbnailOf: first non-empty thumbnail url from an API snippet. */
const channelThumbnailOf = (sn?: ApiSnippet): string | undefined => {
  const t = sn?.thumbnails;
  const url = t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? t?.url;
  return url ?? undefined;
};

type ApiVideoItem = {
  id: string | { videoId?: string };
  snippet?: ApiSnippet;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
};

type ApiChannelItem = {
  id: string;
  snippet?: ApiSnippet;
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: { image?: { bannerExternalUrl?: string } };
};

type ApiList<T> = {
  items?: T[];
  nextPageToken?: string;
  error?: { message?: string; errors?: { reason?: string }[] };
};

// ── Search-quota memory ────────────────────────────────────────────────────
// search.list has a separate 100/day bucket per project. Once spent it stays
// dead until midnight Pacific — remember that so every page load/chip click
// skips the doomed round-trip and falls back instantly.
//
// IMPORTANT: the dead-day is scoped to the API key that spent it. A brand-new
// key (or a different stored key) must never inherit a previous key's dead
// day, otherwise switching keys looks like "quota still spent" with no
// network call ever made. The old un-scoped flag (a bare timestamp under
// ytclone.searchQuotaDeadUntil) is intentionally ignored.
const SEARCH_QUOTA_KEY = "ytclone.searchQuotaDead";

/** Short stable fingerprint of a key so a dead-day can't outlive a key swap. */
function keyFingerprint(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function msUntilPtMidnight(now = Date.now()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const ptNow = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour % 24) as number, +p.minute, +p.second);
  const ptMidnight = Date.UTC(+p.year, +p.month - 1, +p.day + 1);
  return Math.max(60_000, ptMidnight - ptNow);
}

export function searchQuotaSpent(key?: string | null): boolean {
  try {
    const raw = localStorage.getItem(SEARCH_QUOTA_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw) as { id?: string; until?: number };
    // Only honour the flag if it was set for THIS key. A fresh key (or a
    // different stored key) must never inherit another key's dead day.
    if (!rec?.id || rec.id !== keyFingerprint(key ?? "")) return false;
    return Date.now() < (rec.until ?? 0);
  } catch {
    return false;
  }
}

function markSearchQuotaSpent(key: string): void {
  try {
    localStorage.setItem(
      SEARCH_QUOTA_KEY,
      JSON.stringify({ id: keyFingerprint(key), until: Date.now() + msUntilPtMidnight() }),
    );
  } catch {
    /* private mode / storage full — worst case we retry the network */
  }
}

async function apiGetOnce<T>(key: string, path: string, params: Record<string, string | undefined>): Promise<T> {
  // Search quota already spent today for THIS key — fail fast, no network.
  if (path === "search" && searchQuotaSpent(key)) {
    throw new YtApiError("quota", "Daily search quota exceeded");
  }
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("key", key);

  let res: Response;
  try {
    // Always send the page origin as referrer. Mobile browsers default to a
    // stricter policy that strips it on cross-origin calls, which makes
    // Google's HTTP-referrer key check fail with 403 ipRefererBlocked on
    // phones while desktop (same URL) passes.
    res = await fetch(url.toString(), { referrer: window.location.origin, referrerPolicy: "origin" });
  } catch {
    throw new YtApiError("network", "Network error contacting YouTube");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiList<never> | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    if (res.status === 429) {
      if (path === "search") markSearchQuotaSpent(key);
      throw new YtApiError("quota", "Daily search quota exceeded");
    }
    if (res.status === 403) {
      if (reason.includes("quota") || reason.includes("RateLimit")) {
        throw new YtApiError("quota", "Daily quota exceeded");
      }
      // 403 with no quota reason is almost always the HTTP-referrer check
      // (ipRefererBlocked / API_KEY_HTTP_REFERRER_BLOCKED). Surface it as a
      // key error so callers fall back to the offline catalog instead of dying.
      throw new YtApiError("key", "API key rejected (403 referrer)", body?.error?.message ?? "");
    }
    if (res.status === 400 || res.status === 401) {
      const msg = body?.error?.message ?? "";
      // 400 covers both bad requests and quota errors. Classify quota first so
      // a spent key never gets treated as a dead key and pinned to local mode.
      if (
        reason.includes("quota") ||
        reason.includes("RateLimit") ||
        reason.includes("rateLimitExceeded") ||
        /quota/i.test(msg)
      ) {
        throw new YtApiError("quota", "Daily quota exceeded");
      }
      if (
        reason === "keyInvalid" ||
        reason === "API_KEY_INVALID" ||
        (res.status === 400 && /api key/i.test(msg))
      ) {
        throw new YtApiError("key", "Invalid API key", msg || undefined);
      }
      throw new YtApiError("http", `YouTube API error ${res.status}: ${reason || "bad request"}`);
    }
    throw new YtApiError("http", `YouTube API error ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * Self-healing wrapper.
 *
 * A stored (Settings) key can go stale: created, then deleted in Google Cloud,
 * or saved on one device but not another. resolveApiKey() prefers a stored key
 * over the built-in one, so a dead stored key would override a working
 * built-in key forever and every page would read "API Key not found".
 *
 * So: if a NON-built-in key is rejected as invalid, drop it from storage and
 * retry once with the built-in key. We only clear the stored key (never the
 * built-in), and only when the failing key is the stored one — a transient
 * 403 on the built-in key can't wipe a good stored key.
 */
async function apiGet<T>(key: string, path: string, params: Record<string, string | undefined>): Promise<T> {
  try {
    return await apiGetOnce<T>(key, path, params);
  } catch (err) {
    if (err instanceof YtApiError && err.kind === "key" && BUILTIN_KEY && key !== BUILTIN_KEY) {
      clearStoredApiKey();
      try {
        return await apiGetOnce<T>(BUILTIN_KEY, path, params);
      } catch {
        /* built-in also failed — fall through and rethrow the original error */
      }
    }
    throw err;
  }
}

/** ISO-8601 duration (PT#H#M#S) → seconds. Live/missing → 0. */
export function iso8601Duration(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) || 0) * 3600 + (Number(m[2] ?? 0) || 0) * 60 + (Number(m[3] ?? 0) || 0);
}

export function ageDaysFrom(publishedAt?: string): number {
  if (!publishedAt) return 0;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

const CATEGORY_BY_ID: Record<string, string> = {
  "10": "Music",
  "27": "Coding", // Education — closest local bucket for tutorials/coding
  "28": "Science", // Science & Technology
  "22": "Chill", // People & Blogs
  "24": "Viral", // Entertainment
  "20": "Viral", // Gaming
  "17": "Viral", // Sports
  "1": "Chill", // Film & Animation
  "15": "Chill", // Pets & Animals
  "26": "Chill", // Howto & Style
};

/** Local category chip → Data API videoCategoryId (undefined = no category filter). */
export const CATEGORY_ID_BY_NAME: Record<string, string> = {
  Music: "10",
  Coding: "27",
  Science: "28",
  Chill: "22",
  Viral: "24",
};

function handleOf(item: { snippet?: ApiSnippet; id: string }): string {
  const custom = (item.snippet?.customUrl ?? "").trim();
  if (custom) return custom.startsWith("@") ? custom.toLowerCase() : `@${custom.toLowerCase()}`;
  return item.id; // channelId fallback — Channel page resolves UC… ids via the API
}

type ChannelInfoLite = { handle: string; avatar?: string };

function videoFromDetails(item: ApiVideoItem, infoMap: Map<string, ChannelInfoLite>): Video | null {
  const id = typeof item.id === "object" ? item.id.videoId : item.id;
  if (!id) return null;
  const sn = item.snippet ?? {};
  const channelId = sn.channelId ?? "";
  const live = sn.liveBroadcastContent === "live";
  const info = infoMap.get(channelId);
  return {
    id,
    title: sn.title || "Untitled",
    channel: sn.channelTitle || "YouTube",
    handle: info?.handle ?? channelId,
    avatar: info?.avatar,
    views: Number(item.statistics?.viewCount ?? 0) || 0,
    ageDays: ageDaysFrom(sn.publishedAt),
    duration: live ? 0 : iso8601Duration(item.contentDetails?.duration),
    description: sn.description || "",
    tags: sn.tags ?? [],
    category: CATEGORY_BY_ID[sn.categoryId ?? ""] ?? "Viral",
    likes: Number(item.statistics?.likeCount ?? 0) || 0,
    live,
  };
}

/** channelId → { handle, avatar } via channels.list (1 unit per 50 ids), cached 10 min. */
const CHANNEL_INFO_TTL = 10 * 60_000;
const channelInfoCache = new Map<string, { at: number; info: ChannelInfoLite }>();

async function channelInfoMap(key: string, channelIds: string[]): Promise<Map<string, ChannelInfoLite>> {
  const map = new Map<string, ChannelInfoLite>();
  const now = Date.now();
  const missing: string[] = [];
  for (const id of new Set(channelIds.filter(Boolean))) {
    const hit = channelInfoCache.get(id);
    if (hit && now - hit.at < CHANNEL_INFO_TTL) map.set(id, hit.info);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const data = await apiGet<ApiList<ApiChannelItem>>(key, "channels", {
      part: "snippet",
      id: chunk.join(","),
    });
    for (const c of data.items ?? []) {
      const info = { handle: handleOf(c), avatar: channelThumbnailOf(c.snippet) };
      map.set(c.id, info);
      channelInfoCache.set(c.id, { at: now, info });
    }
  }
  return map;
}

async function enrichVideos(key: string, ids: string[]): Promise<Video[]> {
  const out: Video[] = [];
  let infoCache = new Map<string, ChannelInfoLite>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await apiGet<ApiList<ApiVideoItem>>(key, "videos", {
      part: "snippet,statistics,contentDetails",
      id: chunk.join(","),
    });
    const items = data.items ?? [];
    const maps = await channelInfoMap(key, items.map((v) => v.snippet?.channelId ?? ""));
    for (const [k, v] of maps) infoCache.set(k, v);
    for (const item of items) {
      const v = videoFromDetails(item, infoCache);
      if (v) out.push(v);
    }
  }
  return out;
}

export type ApiSearchOpts = {
  q?: string;
  type?: "video" | "channel";
  order?: "relevance" | "date" | "viewCount" | "rating";
  publishedAfter?: string;
  videoDuration?: "short" | "medium" | "long";
  videoCategoryId?: string;
  eventType?: "completed" | "live" | "upcoming";
  pageToken?: string;
  maxResults?: number;
};

export type ApiChannelInfo = Channel & { id: string; handle: string };

export type ApiSearchResult = {
  videos: Video[];
  channels: ApiChannelInfo[];
  nextPageToken?: string;
};

function channelFromItem(item: ApiChannelItem): ApiChannelInfo {
  const sn = item.snippet ?? {};
  const handle = handleOf(item);
  return {
    id: item.id,
    handle,
    name: sn.title || "Channel",
    subscribers: Number(item.statistics?.subscriberCount ?? 0) || 0,
    videos: Number(item.statistics?.videoCount ?? 0) || 0,
    description: sn.description || "",
    joined: sn.publishedAt ? new Date(sn.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—",
    location: sn.country ?? "—",
    totalViews: Number(item.statistics?.viewCount ?? 0) || 0,
    bannerFrom: "#1f2933",
    bannerTo: "#0f172a",
    avatar: channelThumbnailOf(sn),
    banner: item.brandingSettings?.image?.bannerExternalUrl || undefined,
  };
}

export async function apiSearch(key: string, opts: ApiSearchOpts): Promise<ApiSearchResult> {
  const type = opts.type ?? "video";
  const data = await apiGet<ApiList<ApiVideoItem & { id: string | { videoId?: string; channelId?: string } }>>(
    key,
    "search",
    {
      part: "snippet",
      q: opts.q,
      type,
      order: opts.order ?? "relevance",
      publishedAfter: opts.publishedAfter,
      videoDuration: opts.videoDuration,
      videoCategoryId: opts.videoCategoryId,
      eventType: opts.eventType,
      pageToken: opts.pageToken,
      maxResults: String(opts.maxResults ?? 20),
    },
  );
  const items = data.items ?? [];

  if (type === "channel") {
    const ids = items.map((i) => (typeof i.id === "object" ? i.id.channelId : undefined)).filter(Boolean) as string[];
    const channels: ApiChannelInfo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const det = await apiGet<ApiList<ApiChannelItem>>(key, "channels", {
        part: "snippet,statistics,contentDetails",
        id: chunk.join(","),
      });
      for (const c of det.items ?? []) channels.push(channelFromItem(c));
    }
    return { videos: [], channels, nextPageToken: data.nextPageToken };
  }

  const ids = items.map((i) => (typeof i.id === "object" ? i.id.videoId : i.id)).filter(Boolean) as string[];
  const videos = ids.length ? await enrichVideos(key, ids) : [];
  return { videos, channels: [], nextPageToken: data.nextPageToken };
}

export async function apiTrending(key: string, regionCode = "US"): Promise<Video[]> {
  const data = await apiGet<ApiList<ApiVideoItem>>(key, "videos", {
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode,
    maxResults: "24",
  });
  const items = data.items ?? [];
  const infoMap = await channelInfoMap(
    key,
    items.map((v) => v.snippet?.channelId ?? ""),
  );
  return items.map((i) => videoFromDetails(i, infoMap)).filter(Boolean) as Video[];
}

export async function apiVideos(key: string, ids: string[]): Promise<Video[]> {
  if (!ids.length) return [];
  return enrichVideos(key, ids);
}

export async function apiChannel(
  key: string,
  idOrHandle: string,
): Promise<{ channel: ApiChannelInfo; uploads: Video[] } | null> {
  const raw = idOrHandle.trim().replace(/^@/, "");
  const isId = /^UC[\w-]{20,}$/.test(raw);
  const data = await apiGet<ApiList<ApiChannelItem>>(key, "channels", {
    part: "snippet,statistics,contentDetails,brandingSettings",
    id: isId ? raw : undefined,
    forHandle: isId ? undefined : `@${raw}`,
  });
  const item = data.items?.[0];
  if (!item) return null;

  const uploadsPlaylist = item.contentDetails?.relatedPlaylists?.uploads;
  let uploads: Video[] = [];
  if (uploadsPlaylist) {
    const pl = await apiGet<ApiList<{ contentDetails?: { videoId?: string } }>>(key, "playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylist,
      maxResults: "15",
    });
    const ids = (pl.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];
    uploads = ids.length ? await enrichVideos(key, ids) : [];
  }

  return { channel: channelFromItem(item), uploads };
}

/** Newest uploads across subscribed handles — all channels fetched in parallel. */
export async function apiUploadsForHandles(key: string, handles: string[], perChannel = 5): Promise<Video[]> {
  const results = await Promise.allSettled(
    handles.slice(0, 12).map((handle) => apiChannel(key, handle)),
  );
  const out: Video[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out.push(...r.value.uploads.slice(0, perChannel));
  }
  return out.sort((a, b) => a.ageDays - b.ageDays);
}
