import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, videoById } from "../data/videos";
import { compact, cx, dedupeById, prefetchThumbnails } from "../lib/format";
import { Link } from "react-router-dom";
import {
  apiChannel,
  apiSearch,
  apiTrending,
  apiUploadsForHandles,
  CATEGORY_ID_BY_NAME,
  friendlyApiError,
  resolveApiKey,
  searchQuotaSpent,
  YtApiError,
  type ApiSearchResult,
} from "../lib/ytApi";
import type { Video } from "../types";
import { useApp, useLibrary } from "../store/AppContext";
import { ApiKeyBanner } from "../components/ApiSettingsModal";
import { ChipBar } from "../components/ChipBar";
import { Icon } from "../components/Icon";
import { Thumbnail } from "../components/Thumbnail";
import { VideoGrid } from "../components/VideoCard";

/** Offline catalog: clips short enough to be plausible shorts. */
const isShortsShelfClip = (v: Video): boolean => v.duration > 0 && v.duration <= 180;

type ApiState = {
  status: "idle" | "loading" | "ok" | "error";
  videos: Video[];
  error?: string;
  next?: string;
  page: number;
};

const API_IDLE: ApiState = { status: "idle", videos: [], page: 0 };

export function HomePage() {
  const [chip, setChip] = useState("All");
  const [recentOnly, setRecentOnly] = useState(false);
  const [api, setApi] = useState<ApiState>(API_IDLE);
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const { state, toast } = useApp();
  const { videos } = useLibrary();
  const key = resolveApiKey(state.apiKey);

  // YouTube places the Shorts shelf either at the very top or a couple of
  // rows into the grid; flip a coin (seeded) so each visit varies.
  const shelfAtTop = seed % 2 === 0;
  const SHELF_MID_AFTER = 8; // cards shown before the mid-feed shelf

  // ── Personalization ─────────────────────────────────────────────────────
  // Watch history + subscriptions define the taste profile; the feed
  // (offline ranking and live API queries) is built from it.
  const interests = useMemo(() => {
    const cats = new Map<string, number>();
    const tags = new Map<string, number>();
    const chans = new Map<string, number>();
    for (const id of state.history) {
      const v = videoById(id);
      if (!v) continue;
      cats.set(v.category, (cats.get(v.category) ?? 0) + 1);
      for (const t of v.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
      chans.set(v.handle, (chans.get(v.handle) ?? 0) + 1);
    }
    for (const h of state.subscriptions) chans.set(h, (chans.get(h) ?? 0) + 2);
    const topOf = <T,>(m: Map<T, number>): T | undefined =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topTag = topOf(tags);
    const topCat = topOf(cats);
    const topChans = [...chans.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([h]) => h);
    return { topTag, topCat, topChans, hasSignals: !!(topTag || topCat || topChans.length) };
  }, [state.history, state.subscriptions]);
  const watchedSet = useMemo(() => new Set(state.history), [state.history]);

  // Deterministic-per-load rank: newer videos stay on top, exact order
  // reshuffles on every refresh (like YouTube mixing fresh + recommended).
  const rank = (v: Video): number => {
    let h = seed;
    for (let i = 0; i < v.id.length; i++) h = (h * 31 + v.id.charCodeAt(i)) | 0;
    const jitter = ((h >>> 0) % 10_000) / 10_000; // 0..1
    return v.ageDays * (0.55 + jitter * 0.7);
  };

  // Videos matching the taste profile float up (max 60% rank reduction).
  const interestBoost = (v: Video): number => {
    let boost = 0;
    if (interests.topCat && v.category === interests.topCat) boost += 0.4;
    if (interests.topTag && v.tags.includes(interests.topTag)) boost += 0.35;
    if (interests.topChans.includes(v.handle)) boost += 0.3;
    return Math.min(0.6, boost);
  };

  const shortsShelf = useMemo(
    () =>
      videos
        .filter((v) => isShortsShelfClip(v) && !watchedSet.has(v.id))
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videos, seed, watchedSet],
  );
  const shelfIds = useMemo(() => new Set(shortsShelf.map((v) => v.id)), [shortsShelf]);

  const localList = useMemo(() => {
    const out = videos.filter(
      (v) => !shelfIds.has(v.id) && !watchedSet.has(v.id) && (chip === "All" || v.category === chip),
    );
    return out.sort(
      (a, b) => rank(a) * (1 - interestBoost(a)) - rank(b) * (1 - interestBoost(b)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip, videos, seed, shelfIds, watchedSet, interests]);

  // Live YouTube content (official Data API) when a key is configured.
  useEffect(() => {
    if (!key) {
      setApi((a) => (a.status === "idle" ? a : API_IDLE));
      return;
    }
    const ctrl = new AbortController();
    setApi({ status: "loading", videos: [], page: 0 });
    const run = async (): Promise<{ videos: Video[]; next?: string }> => {
      try {
        if (chip === "All") {
          // Search quota already spent for this key — don't even try search;
          // jump straight to the non-search fallback (trending + uploads).
          if (searchQuotaSpent(key)) {
            throw new YtApiError("quota", "Daily search quota exceeded");
          }
          const freshTask = apiSearch(key, { type: "video", order: "date", maxResults: 24 });
          if (!interests.hasSignals) {
            const fresh = await freshTask;
            return { videos: fresh.videos, next: fresh.nextPageToken };
          }
          const recQuery = interests.topTag ?? interests.topCat;
          const tasks: Promise<unknown>[] = [freshTask];
          if (recQuery) {
            tasks.push(apiSearch(key, { q: recQuery, type: "video", order: "relevance", maxResults: 10 }));
          }
          for (const h of interests.topChans) {
            tasks.push(
              apiChannel(key, h)
                .then((r) => r?.uploads.slice(0, 5) ?? [])
                .catch(() => [] as Video[]),
            );
          }
          const settled = await Promise.allSettled(tasks);
          const first = settled[0]!;
          if (first.status === "rejected") throw first.reason;
          const freshRes = first.value as ApiSearchResult;
          const merged: Video[] = [...freshRes.videos];
          for (let i = 1; i < settled.length; i++) {
            const s = settled[i]!;
            if (s.status !== "fulfilled") continue;
            const val = s.value as Video[] | ApiSearchResult;
            merged.push(...(Array.isArray(val) ? val : val.videos));
          }
          const personalized = dedupeById(merged).filter((v) => !watchedSet.has(v.id));
          return { videos: personalized, next: freshRes.nextPageToken };
        }
        if (chip === "Live") {
          const res = await apiSearch(key, { type: "video", eventType: "live", order: "date", maxResults: 24 });
          return { videos: res.videos, next: res.nextPageToken };
        }
        const catId = CATEGORY_ID_BY_NAME[chip];
        const res = await apiSearch(key, {
          q: catId ? undefined : chip.toLowerCase(),
          videoCategoryId: catId,
          type: "video",
          order: recentOnly ? "date" : catId ? "viewCount" : "relevance",
          maxResults: 24,
        });
        return { videos: res.videos, next: res.nextPageToken };
      } catch (err) {
        const kind = err instanceof YtApiError ? err.kind : null;
        // Google's own wording when we have it — "API key expired" beats a
        // vague "unavailable" and tells the user what to actually fix.
        const why = err instanceof YtApiError && err.detail ? err.detail : "";
        // Quota spent OR key rejected (mobile referrer mismatch) — both fall
        // back to the same path so desktop and mobile always show content.
        if (kind !== "quota" && kind !== "key") throw err;
        // Daily search quota spent. Chart + uploads use a different quota
        // bucket — still live. If those fail too, fall back to the offline catalog.
        if (chip === "All") {
          const subChans = interests.topChans.length ? interests.topChans : state.subscriptions;
          const [trend, subsFeed] = await Promise.allSettled([
            apiTrending(key),
            apiUploadsForHandles(key, subChans, 5),
          ]);
          const merged: Video[] = [];
          if (subsFeed.status === "fulfilled") merged.push(...subsFeed.value);
          if (trend.status === "fulfilled") merged.push(...trend.value);
          const personal = dedupeById(merged).filter((v) => !watchedSet.has(v.id));
          if (personal.length > 0) {
            // 429 on search.list is a PER-PROJECT bucket (~100 searches/day),
            // so a brand-new key in the same project still reads as spent.
            // Trending (videos.list) uses the separate 10k/day budget and stays
            // live — say so instead of implying the whole key is dead.
            toast(
              kind === "key"
                ? `Live YouTube unavailable${why ? ` (${why})` : ""} — showing trending + subscriptions`
                : "Search quota spent for this project (resets midnight Pacific) — showing trending + subscriptions",
            );
            return { videos: personal };
          }
          // API key rejected or everything failed — use the offline catalog so
          // mobile never dies on a hard error when desktop would still show videos.
          const offlineAll = dedupeById(videos);
          if (offlineAll.length > 0) {
            toast(kind === "key" ? `Live YouTube unavailable${why ? ` (${why})` : ""} — showing the offline catalog` : "Live YouTube unavailable — showing the offline catalog");
            return { videos: offlineAll };
          }
          throw err;
        }
        const offline = dedupeById(
          videos.filter((v) => (chip === "Live" ? v.live : v.category === chip)),
        );
        if (offline.length > 0) {
          toast(kind === "key" ? `Live YouTube unavailable${why ? ` (${why})` : ""} — showing offline catalog matches` : "Search quota spent for this project (resets midnight Pacific) — showing offline catalog matches");
          return { videos: offline };
        }
        // Last resort: full offline catalog, never a dead error page.
        const fallbackAll = dedupeById(videos);
        if (fallbackAll.length > 0) {
          toast(kind === "key" ? `Live YouTube unavailable${why ? ` (${why})` : ""} — showing the offline catalog` : "Live YouTube unavailable — showing the offline catalog");
          return { videos: fallbackAll };
        }
        throw err;
      }
    };
    // Refresh-shuffle: seeded permutation of the recent block so card positions
    // aren't pinned between visits (recency kept overall). Runs on every source —
    // live, quota-fallback and offline — so the feed never freezes in place.
    const shuffleHead = (inVids: Video[]): Video[] => {
      const vids = [...inVids];
      const head = vids.slice(0, 16);
      let h = seed;
      for (let i = head.length - 1; i > 0; i--) {
        h = (h * 1_664_525 + 1_013_904_223) | 0;
        const j = (h >>> 0) % (i + 1);
        [head[i], head[j]] = [head[j], head[i]];
      }
      return [...head, ...vids.slice(16)];
    };

    run()
      .then((res) => {
        if (ctrl.signal.aborted) return;
        let vids = dedupeById(res.videos);
        if (chip === "All") vids = shuffleHead(vids);
        prefetchThumbnails(vids.slice(0, 18).map((v) => v.id));
        setApi({ status: "ok", videos: vids, next: res.next, page: 1 });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof YtApiError && (err.kind === "key" || err.kind === "quota")) {
          // Key rejected or quota spent — never a dead error page. Fall back
          // to the offline catalog so mobile and desktop always show videos.
          const offlineAll = dedupeById(videos);
          if (offlineAll.length > 0) {
            const why = err.detail ? ` (${err.detail})` : "";
            toast(`Live YouTube unavailable${why} — showing the offline catalog`);
            setApi({ status: "ok", videos: offlineAll, next: undefined, page: 1 });
            return;
          }
        }
        setApi({ status: "error", videos: [], error: friendlyApiError(err), page: 0 });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, chip, recentOnly, retry, interests]);

  const loadMoreApi = () => {
    if (!key || !api.next || api.status !== "ok" || loadingMore) return;
    const token = api.next;
    setLoadingMore(true);
    apiSearch(key, {
      q: CATEGORY_ID_BY_NAME[chip] ? undefined : chip.toLowerCase(),
      videoCategoryId: CATEGORY_ID_BY_NAME[chip],
      type: "video",
      order: (recentOnly || chip !== "All" ? "date" : "relevance") as "date" | "relevance",
      pageToken: token,
      maxResults: 24,
    })
      .then((res) => {
        setApi((a) => ({
          status: "ok",
          videos: dedupeById([...a.videos, ...res.videos]),
          next: res.nextPageToken,
          page: a.page + 1,
        }));
      })
      .catch((err) => {
        // Keep everything already on screen — never collapse the feed on a
        // paging failure (that would yank the scroll position to the top).
        if (err instanceof YtApiError && err.kind === "quota") {
          toast("Search quota spent for this project (resets midnight Pacific) — no more pages today");
        } else {
          toast(`Couldn't load more videos (${friendlyApiError(err)})`);
        }
        setApi((a) => ({ ...a, status: "ok", next: undefined }));
      })
      .finally(() => setLoadingMore(false));
  };
  const loadMoreRef = useRef(loadMoreApi);
  loadMoreRef.current = loadMoreApi;

  // Infinite scroll: no "Load more" button — the next page fetches itself
  // when the bottom sentinel scrolls into view (YouTube-style).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !key) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [key, chip, recentOnly]);

  const useApi = !!key && api.status !== "idle";
  const list = useApi ? api.videos.filter((v) => !shelfIds.has(v.id)) : localList;
  // Everything available renders at once — no page-size cap, ever.
  const shown = list;
  const atEnd = key ? !api.next : true;

  // Split the grid around the Shorts shelf (top on some loads, mid-feed on others).
  const gridHead = !shelfAtTop && shelfIds.size > 0 ? shown.slice(0, SHELF_MID_AFTER) : shown;
  const gridTail = !shelfAtTop && shelfIds.size > 0 ? shown.slice(SHELF_MID_AFTER) : [];

  return (
    <div className="page page--home">
      {!key && <ApiKeyBanner />}
      <div className="home-chips">
        <ChipBar
          chips={[...CATEGORIES, "New to you", "Recently uploaded"]}
          value={recentOnly ? "New to you" : chip}
          onChange={(c) => {
            if (c === "New to you" || c === "Recently uploaded") {
              setChip("All");
              setRecentOnly(true);
            } else {
              setChip(c);
              setRecentOnly(false);
            }
          }}
          ariaLabel="Video categories"
        />
      </div>

      {shelfAtTop && shortsShelf.length > 0 && (
        <div className="shelf shelf--shorts">
          <h2 className="shelf__title shelf__title--shorts">
            <Icon name="shorts" size={26} /> Shorts
          </h2>
          <div className="shorts-row">
            {shortsShelf.map((v) => (
              <Link key={v.id} to={`/shorts/${v.id}`} className="shortcard">
                <span className="shortcard__media">
                  <Thumbnail video={v} showMeta={false} />
                </span>
                <p className="shortcard__title">{v.title}</p>
                <p className="shortcard__stats">{compact(v.views)} views</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {api.status === "error" && (
        <div className="empty">
          <div className="empty__art">
            <Icon name="info" size={38} />
          </div>
          <h2>Couldn't load live YouTube content</h2>
          <p className="muted">{api.error}</p>
          <div className="empty__suggestions">
            <button className="btn btn--primary" onClick={() => setRetry((r) => r + 1)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {api.status === "loading" && api.page === 0 && <HomeSkeleton />}

      {(api.status === "ok" || !key) && gridHead.length > 0 && (
        <VideoGrid videos={gridHead} className="grid--home" />
      )}

      {!shelfAtTop && shortsShelf.length > 0 && (
        <div className="shelf shelf--shorts shelf--mid">
          <h2 className="shelf__title shelf__title--shorts">
            <Icon name="shorts" size={26} /> Shorts
          </h2>
          <div className="shorts-row">
            {shortsShelf.map((v) => (
              <Link key={v.id} to={`/shorts/${v.id}`} className="shortcard">
                <span className="shortcard__media">
                  <Thumbnail video={v} showMeta={false} />
                </span>
                <p className="shortcard__title">{v.title}</p>
                <p className="shortcard__stats">{compact(v.views)} views</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(api.status === "ok" || !key) && gridTail.length > 0 && (
        <VideoGrid videos={gridTail} className="grid--home" />
      )}

      {/* Infinite-scroll sentinel: fetches the next page automatically. */}
      <div ref={sentinelRef} aria-hidden="true" />

      <div className="loadmore">
        {loadingMore ? (
          <p className="muted">Loading…</p>
        ) : atEnd ? (
          <p className={cx("caughtup")}>
            <Icon name="check" size={18} /> You're all caught up
          </p>
        ) : (
          <p className="muted" />
        )}
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="grid grid--home">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="card sk" key={i}>
          <div className="sk__thumb" />
          <div className="sk__row">
            <div className="sk__avatar" />
            <div className="sk__lines">
              <span />
              <span />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { compact };
