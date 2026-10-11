import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CHANNELS } from "../data/channels";
import { MOCK_FILTERS } from "../data/misc";
import { compact, cx, dedupeById, parseVideoId, timeAgo, viewsLabel } from "../lib/format";
import { allTags, parseTokens, searchVideos } from "../lib/search";
import { apiSearch, friendlyApiError, resolveApiKey, YtApiError, type ApiChannelInfo, type ApiSearchOpts } from "../lib/ytApi";
import type { Video } from "../types";
import { useApp, useLibrary } from "../store/AppContext";
import { ApiKeyBanner } from "../components/ApiSettingsModal";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { SubscribeButton } from "../components/SubscribeButton";
import { Thumbnail } from "../components/Thumbnail";
import { VideoRow } from "../components/VideoCard";

const TYPE_CHIPS = ["All", "Shorts", "Videos", "Recently uploaded", "Live"] as const;
type TypeChip = (typeof TYPE_CHIPS)[number];

type FilterGroup = "date" | "type" | "duration" | "sort";

const GROUP_OF: Record<string, FilterGroup> = {
  "Last hour": "date",
  Today: "date",
  "This week": "date",
  "This month": "date",
  "This year": "date",
  Video: "type",
  Channel: "type",
  Playlist: "type",
  Movie: "type",
  "Under 4 minutes": "duration",
  "4–20 minutes": "duration",
  "Over 20 minutes": "duration",
  Relevance: "sort",
  "Upload date": "sort",
  "View count": "sort",
  Rating: "sort",
};

const DATE_DAYS: Record<string, number> = {
  "Last hour": 0.042,
  Today: 1,
  "This week": 7,
  "This month": 30,
  "This year": 365,
};

type ApiState = {
  status: "idle" | "loading" | "ok" | "error";
  videos: Video[];
  channels: ApiChannelInfo[];
  error?: string;
  next?: string;
  page: number;
};

const API_IDLE: ApiState = { status: "idle", videos: [], channels: [], page: 0 };

export function SearchPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const q = (params.get("search_query") ?? "").trim();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<FilterGroup, string>>>({ sort: "Relevance" });
  const [chip, setChip] = useState<TypeChip>("All");
  const [api, setApi] = useState<ApiState>(API_IDLE);
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const { state, toast } = useApp();
  const { videos: library, byHandle } = useLibrary();
  const key = resolveApiKey(state.apiKey);

  const tokens = parseTokens(q);
  const activeFilters = Object.values(filters).filter(Boolean) as string[];

  // A pasted YouTube URL in the address bar goes straight to the player.
  useEffect(() => {
    const id = parseVideoId(q);
    if (id) nav(`/watch?v=${id}`, { replace: true });
  }, [q, nav]);

  const localResults = useMemo(() => {
    let list = searchVideos(library, q);

    if (filters.date) {
      const max = DATE_DAYS[filters.date] ?? Infinity;
      list = list.filter((v) => v.ageDays < max);
    }
    if (filters.type && filters.type !== "Video") list = [];
    if (filters.duration === "Under 4 minutes") list = list.filter((v) => v.duration > 0 && v.duration < 240);
    if (filters.duration === "4–20 minutes") list = list.filter((v) => v.duration >= 240 && v.duration < 1200);
    if (filters.duration === "Over 20 minutes") list = list.filter((v) => v.duration >= 1200);

    const isShort = (v: (typeof library)[number]) => v.duration > 0 && v.duration <= 180;
    if (chip === "Shorts") list = list.filter(isShort);
    if (chip === "Videos") list = list.filter((v) => !isShort(v));
    if (chip === "Live") list = list.filter((v) => v.live);

    if (filters.sort === "Upload date") list = [...list].sort((a, b) => a.ageDays - b.ageDays);
    else if (filters.sort === "View count") list = [...list].sort((a, b) => b.views - a.views);
    else if (filters.sort === "Rating") list = [...list].sort((a, b) => b.likes / b.views - a.likes / a.views);
    else if (chip === "Recently uploaded") list = [...list].sort((a, b) => a.ageDays - b.ageDays);

    return list;
  }, [q, filters, chip, library]);

  // Live YouTube search through the official Data API (when a key is set).
  const wantApi = !!key && !!q.trim() && !parseVideoId(q);
  const buildOpts = (pageToken?: string): ApiSearchOpts => ({
    q: q.trim() || undefined,
    type: filters.type === "Channel" ? "channel" : "video",
    order:
      filters.sort === "Upload date"
        ? "date"
        : filters.sort === "View count"
          ? "viewCount"
          : filters.sort === "Rating"
            ? "rating"
            : chip === "Recently uploaded"
              ? "date"
              : "relevance",
    publishedAfter: filters.date
      ? new Date(Date.now() - (DATE_DAYS[filters.date] ?? 365) * 86_400_000).toISOString()
      : undefined,
    videoDuration:
      filters.duration === "Under 4 minutes"
        ? "short"
        : filters.duration === "4–20 minutes"
          ? "medium"
          : filters.duration === "Over 20 minutes"
            ? "long"
            : undefined,
    eventType: chip === "Live" ? "live" : undefined,
    pageToken,
    maxResults: 20,
  });

  useEffect(() => {
    if (!wantApi || !key) {
      setApi((a) => (a.status === "idle" ? a : API_IDLE));
      return;
    }
    const ctrl = new AbortController();
    setApi({ status: "loading", videos: [], channels: [], page: 0 });
    apiSearch(key, buildOpts())
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setApi({ status: "ok", videos: res.videos, channels: res.channels, next: res.nextPageToken, page: 1 });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof YtApiError && (err.kind === "quota" || err.kind === "key")) {
          // Quota spent or key rejected — fall back to local results, never a
          // dead error page. Same path on desktop and mobile.
          toast(err.kind === "key" ? `Live YouTube unavailable${err.detail ? ` (${err.detail})` : ""} — showing offline results` : "Search quota spent for this project (resets midnight Pacific) — showing offline catalog results");
          setApi(API_IDLE);
          return;
        }
        setApi({ status: "error", videos: [], channels: [], error: friendlyApiError(err), page: 0 });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters, chip, key, wantApi, retry]);

  const loadMoreApi = () => {
    if (!key || !api.next || api.status !== "ok" || loadingMore) return;
    const token = api.next;
    setLoadingMore(true);
    apiSearch(key, buildOpts(token))
      .then((res) => {
        setApi((a) => ({
          status: "ok",
          videos: dedupeById([...a.videos, ...res.videos]),
          channels: [...a.channels, ...res.channels],
          next: res.nextPageToken,
          page: a.page + 1,
        }));
      })
      .catch((err) => {
        // Never wipe already-loaded results on a paging failure — the user
        // keeps their scroll position and everything on screen.
        if (err instanceof YtApiError && err.kind === "quota") {
          toast("Search quota spent for this project (resets midnight Pacific) — no more pages today");
        } else {
          toast(`Couldn't load more results (${friendlyApiError(err)})`);
        }
        setApi((a) => ({ ...a, status: "ok", next: undefined }));
      })
      .finally(() => setLoadingMore(false));
  };

  const useApi = wantApi && api.status !== "idle";
  const isShort = (v: Video) => v.duration > 0 && v.duration <= 180;
  const apiVideos = useMemo(() => {
    let list = api.videos;
    if (chip === "Shorts") list = list.filter(isShort);
    if (chip === "Videos") list = list.filter((v) => !isShort(v));
    return list;
  }, [api.videos, chip]);

  const results = useApi ? apiVideos : localResults;

  const matchedChannel = tokens.length
    ? Object.values(CHANNELS).find(
        (c) => c.name.toLowerCase().includes(tokens[0]!.term) || c.handle.includes(tokens[0]!.term),
      )
    : undefined;
  const apiChannelHit = useApi ? api.channels[0] : undefined;

  const toggleFilter = (label: string) => {
    const group = GROUP_OF[label];
    if (!group) return;
    setFilters((f) => {
      const next = { ...f };
      if (f[group] === label) {
        if (group === "sort") next.sort = "Relevance";
        else delete next[group];
      } else next[group] = label;
      return next;
    });
  };

  const tagSuggestions = useMemo(() => allTags(library).slice(0, 4), [library]);
  const showEmpty =
    api.status !== "loading" &&
    results.length === 0 &&
    !(filters.type === "Channel" && (apiChannelHit || matchedChannel));

  return (
    <div className="page page--search">
      <h1 className="sr-only">
        Search results{q ? ` for ${q}` : ""}
      </h1>
      {!key && <ApiKeyBanner />}
      <div className="search-toolbar">
        <div className="search-toolbar__chips">
          {TYPE_CHIPS.map((c) => (
            <button key={c} className={cx("chip", chip === c && "is-active")} onClick={() => setChip(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="search-toolbar__spacer" />
        <button className="btn btn--chip" onClick={() => setShowFilters((s) => !s)}>
          <Icon name="filter" size={18} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="filters">
          {MOCK_FILTERS.map((group) => (
            <div className="filters__group" key={group.label}>
              <p className="filters__label">{group.label}</p>
              <div className="filters__options">
                {group.options.map((o) => (
                  <button
                    key={o}
                    className={cx("chip", activeFilters.includes(o) && "is-active")}
                    onClick={() => toggleFilter(o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="filters__actions">
            <button
              className="btn btn--ghost"
              onClick={() => setFilters({ sort: "Relevance" })}
            >
              Reset all
            </button>
            <button className="btn btn--primary" onClick={() => setShowFilters(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {api.status === "loading" && api.page === 0 && (
        <div className="grid grid--home" aria-busy="true" aria-label="Searching YouTube">
          {Array.from({ length: 6 }).map((_, i) => (
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
      )}

      {api.status === "error" && (
        <div className="empty">
          <div className="empty__art">
            <Icon name="info" size={38} />
          </div>
          <h2>YouTube search failed</h2>
          <p className="muted">{api.error}</p>
          <div className="empty__suggestions">
            <button className="btn btn--primary" onClick={() => setRetry((r) => r + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {(apiChannelHit || matchedChannel) && (
        <div className="channel-hit">
          {apiChannelHit ? (
            <>
              <Avatar name={apiChannelHit.name} size={112} className="channel-hit__avatar" src={apiChannelHit.avatar} />
              <div className="channel-hit__id">
                <Link
                  to={`/${apiChannelHit.handle.startsWith("@") ? apiChannelHit.handle : `@${apiChannelHit.handle}`}`}
                  className="channel-hit__name"
                >
                  {apiChannelHit.name}
                </Link>
                <p className="muted channel-hit__meta">
                  {apiChannelHit.handle} · {compact(apiChannelHit.subscribers)} subscribers ·{" "}
                  {apiChannelHit.videos} videos
                </p>
              </div>
              <div className="channel-hit__side">
                <p className="channel-hit__desc">{apiChannelHit.description.slice(0, 220)}</p>
                <div className="channel-hit__actions">
                  <SubscribeButton
                    handle={
                      apiChannelHit.handle.startsWith("@")
                        ? apiChannelHit.handle
                        : `@${apiChannelHit.handle}`
                    }
                    showCount={false}
                  />
                  <Link
                    className="btn btn--outline"
                    to={`/${apiChannelHit.handle.startsWith("@") ? apiChannelHit.handle : `@${apiChannelHit.handle}`}`}
                  >
                    View channel
                  </Link>
                </div>
              </div>
            </>
          ) : matchedChannel ? (
            <>
              <Avatar name={matchedChannel.name} size={112} className="channel-hit__avatar" src={matchedChannel.avatar} />
              <div className="channel-hit__id">
                <Link to={`/${matchedChannel.handle}`} className="channel-hit__name">
                  {matchedChannel.name}
                  <Icon name="verified" size={22} className="verified" />
                </Link>
                <p className="muted channel-hit__meta">
                  {matchedChannel.handle} · {compact(matchedChannel.subscribers)} subscribers ·{" "}
                  {matchedChannel.videos} videos
                </p>
              </div>
              <div className="channel-hit__side">
                <p className="channel-hit__desc">{matchedChannel.description}</p>
                <div className="channel-hit__actions">
                  <SubscribeButton handle={matchedChannel.handle} showCount={false} />
                  <Link className="btn btn--outline" to={`/${matchedChannel.handle}`}>
                    View channel
                  </Link>
                </div>
              </div>
              <div className="channel-hit__videos">
                {byHandle(matchedChannel.handle)
                  .slice(0, 3)
                  .map((v) => (
                    <Link key={v.id} to={`/watch?v=${v.id}`} className="channel-hit__video">
                      <Thumbnail video={v} showMeta={false} />
                      <p className="channel-hit__video-title">{v.title}</p>
                      <p className="muted channel-hit__video-meta">
                        {viewsLabel(v.views, v.live)} · {timeAgo(v.ageDays)}
                      </p>
                    </Link>
                  ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {results.length > 0 ? (
        <>
          <div className="search-results">
            {results.map((v) => (
              <VideoRow key={v.id} video={v} variant="search" />
            ))}
          </div>
          {useApi && api.next && api.status === "ok" && (
            <div className="loadmore">
              <button
                type="button"
                className="btn btn--outline"
                onClick={loadMoreApi}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more results"}
              </button>
            </div>
          )}
          <p className="search-results__end muted">
            {useApi
              ? `End of page ${api.page} · live from YouTube`
              : `End of results · newest item ${timeAgo(Math.min(...results.map((r) => r.ageDays)))}`}
          </p>
        </>
      ) : showEmpty ? (
        <div className="empty">
          <div className="empty__art">
            <Icon name="search" size={38} />
          </div>
          <h2>No results found</h2>
          <p className="muted">
            {useApi
              ? "Try different keywords or remove search filters."
              : "Try different keywords or remove search filters."}
          </p>
          <div className="empty__suggestions">
            {tagSuggestions.map((t) => (
              <Link key={t.tag} className="chip" to={`/results?search_query=%23${t.tag}`}>
                #{t.tag}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
