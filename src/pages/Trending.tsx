import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { channelOf } from "../data/channels";
import { compact, cx, timeAgo, viewsLabel } from "../lib/format";
import { apiSearch, apiTrending, CATEGORY_ID_BY_NAME, friendlyApiError, resolveApiKey, YtApiError } from "../lib/ytApi";
import type { Video } from "../types";
import { useApp, useLibrary } from "../store/AppContext";
import { ApiKeyBanner } from "../components/ApiSettingsModal";
import { Avatar } from "../components/Avatar";
import { ChipBar } from "../components/ChipBar";
import { Icon } from "../components/Icon";
import { Thumbnail } from "../components/Thumbnail";

const TABS = ["Now", "Music", "Coding", "Science", "Chill", "Viral", "Kids"];

export function TrendingPage() {
  const [tab, setTab] = useState("Now");
  const [apiVideos, setApiVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const nav = useNavigate();
  const { state, toast } = useApp();
  const { videos } = useLibrary();
  const key = resolveApiKey(state.apiKey);

  useEffect(() => {
    if (!key) {
      setApiVideos(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const run = async (): Promise<Video[]> => {
      if (tab === "Now") return apiTrending(key);
      const catId = CATEGORY_ID_BY_NAME[tab];
      const res = await apiSearch(key, {
        q: catId ? undefined : tab.toLowerCase(),
        videoCategoryId: catId,
        type: "video",
        order: "viewCount",
        maxResults: 20,
      });
      return res.videos;
    };
    run()
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setApiVideos(list);
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof YtApiError && (err.kind === "quota" || err.kind === "key")) {
          // Quota spent or key rejected — fall back to local list, never a
          // dead error page. Same path on desktop and mobile.
          toast(err.kind === "key" ? `Live YouTube unavailable${err.detail ? ` (${err.detail})` : ""} — showing offline trending` : "Search quota spent for this project (resets midnight Pacific) — showing offline trending");
          setApiVideos(null);
          return;
        }
        setError(friendlyApiError(err));
        setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tab, retry]);

  const localList = useMemo(() => {
    const base = tab === "Now" ? videos : videos.filter((v) => v.category === tab);
    return [...base].sort((a, b) => b.views - a.views).slice(0, 20);
  }, [tab, videos]);

  const list = key ? (apiVideos ?? []) : localList;

  return (
    <div className="page page--trending">
      {!key && <ApiKeyBanner />}
      <div className="trend-head">
        <span className="trend-head__icon">
          <Icon name="trending" size={30} />
        </span>
        <div>
          <h1>Trending</h1>
          <p className="muted">
            {key
              ? "What YouTube is watching right now · live via the official Data API"
              : `What the platform is watching right now · refreshed ${timeAgo(0)}`}
          </p>
        </div>
      </div>

      <ChipBar chips={TABS} value={tab} onChange={setTab} ariaLabel="Trending categories" />

      {loading && (
        <div className="grid grid--home" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
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

      {error && (
        <div className="empty">
          <div className="empty__art">
            <Icon name="info" size={38} />
          </div>
          <h2>Couldn't load trending</h2>
          <p className="muted">{error}</p>
          <div className="empty__suggestions">
            <button className="btn btn--primary" onClick={() => setRetry((r) => r + 1)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <ol className="trend-list">
          {list.map((v, i) => {
            const ch = channelOf(v.handle);
            const name = v.channel || ch.name;
            return (
              <li key={v.id} className="trend-item">
                <span className={cx("trend-item__rank", i < 3 && "is-top")}>{i + 1}</span>
                <button className="trend-item__media" onClick={() => nav(`/watch?v=${v.id}`)}>
                  <Thumbnail video={v} />
                </button>
                <div className="trend-item__body" onClick={() => nav(`/watch?v=${v.id}`)} role="link">
                  <h3>{v.title}</h3>
                  <p className="muted">{viewsLabel(v.views, v.live)} · {timeAgo(v.ageDays)}</p>
                  <p className="trend-item__channel">
                    <Avatar name={name} size={22} src={v.avatar ?? ch.avatar} />
                    {name}
                  </p>
                </div>
                <span className="trend-item__gain">
                  <Icon name="chart" size={16} /> +{compact(Math.round(v.views / (v.ageDays + 30)))}/day
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
