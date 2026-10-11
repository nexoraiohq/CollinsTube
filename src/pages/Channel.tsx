import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { channelOf } from "../data/channels";
import { compact, cx, fullNumber, timeAgo, viewsLabel, bannerProxyUrl } from "../lib/format";
import { apiChannel, friendlyApiError, resolveApiKey, type ApiChannelInfo } from "../lib/ytApi";
import type { Video } from "../types";
import { useApp, useLibrary } from "../store/AppContext";
import { ApiKeyBanner } from "../components/ApiSettingsModal";
import { Avatar } from "../components/Avatar";
import { ChipBar } from "../components/ChipBar";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { SubscribeButton } from "../components/SubscribeButton";
import { Thumbnail } from "../components/Thumbnail";
import { VideoGrid } from "../components/VideoCard";
import { NotFoundPage } from "./NotFound";

const TABS = ["Home", "Videos", "Shorts", "Playlists"];

/** Every channel's header preview is cut at the same length (YouTube-style). */
const DESC_PREVIEW_MAX = 120;
const descPreview = (s: string): string => {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= DESC_PREVIEW_MAX) return clean;
  const cut = clean.slice(0, DESC_PREVIEW_MAX);
  const space = cut.lastIndexOf(" ");
  return (space > 60 ? cut.slice(0, space) : cut).trimEnd() + "…";
};

export function ChannelPage() {
  const { handle: raw } = useParams();
  const handle = raw ?? "";
  const { state, toast } = useApp();
  const { byHandle } = useLibrary();
  const key = resolveApiKey(state.apiKey);
  const [apiData, setApiData] = useState<{ channel: ApiChannelInfo; uploads: Video[] } | null>(null);
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "ok" | "error" | "notfound">("idle");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!key || !raw) {
      setApiData(null);
      setApiStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    setApiStatus("loading");
    setApiError("");
    apiChannel(key, raw)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        if (res) {
          setApiData(res);
          setApiStatus("ok");
        } else {
          setApiStatus("notfound");
        }
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setApiError(friendlyApiError(err));
        setApiStatus("error");
      });
    return () => ctrl.abort();
  }, [key, raw]);

  const localChannel = channelOf(handle.startsWith("@") ? handle : `@${handle}`);
  const localAll = byHandle(localChannel.handle);
  const channel = apiData?.channel ?? localChannel;
  const all = apiData ? apiData.uploads : localAll;
  const bannerSrc = channel.banner
    ? bannerProxyUrl(channel.banner)
    : localChannel.banner
      ? bannerProxyUrl(localChannel.banner)
      : undefined;
  const [tab, setTab] = useState("Home");
  const [sort, setSort] = useState("Latest");
  const [aboutOpen, setAboutOpen] = useState(false);

  const videos = useMemo(() => {
    const arr = [...all];
    if (sort === "Popular") arr.sort((a, b) => b.views - a.views);
    if (sort === "Oldest") arr.sort((a, b) => b.ageDays - a.ageDays);
    if (sort === "Latest") arr.sort((a, b) => a.ageDays - b.ageDays);
    return arr;
  }, [all, sort]);

  if (apiStatus === "notfound") return <NotFoundPage />;
  if (!raw || (!raw.startsWith("@") && all.length === 0 && channel.videos === 0 && apiStatus !== "loading")) {
    return <NotFoundPage />;
  }

  const subscribed = state.subscriptions.includes(channel.handle);

  return (
    <div className="page page--channel">
      {!key && <ApiKeyBanner />}
      {apiStatus === "loading" && !apiData && (
        <p className="muted" role="status">
          Loading live channel data from YouTube…
        </p>
      )}
      {apiStatus === "error" && (
        <p className="muted" role="alert">
          Live channel data unavailable ({apiError}) — showing offline data.
        </p>
      )}

      <div
        className="channel-banner"
        style={{
          backgroundColor: channel.bannerFrom,
        }}
      >
        {bannerSrc && (
          <img
            className="channel-banner__img"
            src={bannerSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <span className="channel-banner__grid" />
      </div>

      <header className="channel-head">
        <Avatar name={channel.name} size={160} className="channel-head__avatar" src={channel.avatar} />
        <div className="channel-head__info">
          <h1>
            {channel.name}
            {channel.videos > 0 && <Icon name="verified" size={22} className="verified" />}
          </h1>
          <p className="muted channel-head__meta">
            <span className="dark-text">{channel.handle}</span> · {compact(channel.subscribers)} subscribers ·{" "}
            {channel.videos} videos · {fullNumber(channel.totalViews)} views
          </p>
          <p className="channel-head__desc">
            <span className="channel-head__desc-text">{descPreview(channel.description)}</span>
            <button className="linkbtn" onClick={() => setAboutOpen(true)}>
              ...more
            </button>
          </p>
          <div className="channel-head__actions">
            <SubscribeButton handle={channel.handle} showCount={false} />
            <button
              className="btn btn--outline"
              onClick={() => toast("Joined alerts enabled")}
            >
              Join
            </button>
          </div>
        </div>
      </header>

      <nav className="channel-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={cx("channel-tab", tab === t && "is-active")}
            onClick={() => setTab(t)}
          >
            {t}
            <span className="channel-tab__ink" />
          </button>
        ))}
      </nav>

      {tab === "Home" && (
        <>
          {videos.length > 0 ? (
            <>
              <div className="channel-featured">
                <Link to={`/watch?v=${videos[0].id}`} className="channel-featured__media">
                  <Thumbnail video={videos[0]} showMeta={false} />
                  <span className="channel-featured__play">
                    <Icon name="play" size={26} />
                  </span>
                </Link>
                <div className="channel-featured__body">
                  <h2>{videos[0].title}</h2>
                  <p className="muted">
                    {viewsLabel(videos[0].views, videos[0].live)} · {timeAgo(videos[0].ageDays)}
                  </p>
                  <p className="channel-featured__desc">{videos[0].description}</p>
                </div>
              </div>
              <h3 className="channel-section-title">Latest from {channel.name}</h3>
              <VideoGrid
                videos={videos.slice(1, 8)}
                showChannel={false}
                className="grid--channel"
              />
              <div className="channel-section-foot">
                <button className="btn btn--outline" onClick={() => setTab("Videos")}>
                  View all {channel.videos} videos
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="empty__art">
                <Icon name="user" size={36} />
              </div>
              <h2>This channel has no content yet</h2>
            </div>
          )}
        </>
      )}

      {tab === "Videos" && (
        <>
          <div className="channel-sort">
            <ChipBar chips={["Latest", "Popular", "Oldest"]} value={sort} onChange={setSort} ariaLabel="Sort videos" />
          </div>
          {videos.length ? (
            <VideoGrid videos={videos} showChannel={false} className="grid--channel" />
          ) : (
            <div className="empty">
              <div className="empty__art">
                <Icon name="playlist" size={36} />
              </div>
              <h2>No videos yet</h2>
              <p className="muted">This channel hasn't uploaded anything public.</p>
            </div>
          )}
        </>
      )}

      {tab === "Shorts" && (
        <div className="shorts-shelf">
          {videos.slice(0, 4).map((v) => (
            <Link key={v.id} to={`/shorts/${v.id}`} className="shorts-shelf__card">
              <div className="shorts-shelf__art" data-id={v.id}>
                <span className="shorts-shelf__play">
                  <Icon name="play" size={26} />
                </span>
              </div>
              <p className="shorts-shelf__title">{v.title}</p>
              <p className="muted">{compact(v.views)} views</p>
            </Link>
          ))}
          {!videos.length && <p className="muted">No shorts published.</p>}
        </div>
      )}

      {tab === "Playlists" && (
        <div className="playlist-shelf">
          {[
            { title: "Popular uploads", count: videos.length, sub: `${compact(channel.totalViews)} views` },
            { title: "Latest videos", count: Math.min(videos.length, 6), sub: `${channel.videos} videos` },
            { title: "Watch later", count: state.saved.length, sub: "Private playlist" },
          ].map((p) => (
            <div className="pl-card" key={p.title}>
              <div className="pl-card__art">
                <Icon name="playlist" size={34} />
              </div>
              <div>
                <h3>{p.title}</h3>
                <p className="muted">
                  {p.count} videos · {p.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* About — YouTube-style popup instead of a tab */}
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} label="About channel" size="md">
        <div className="about">
          <h2>Description</h2>
          <p>{channel.description}</p>
          <h2>Channel details</h2>
          <ul className="about__list">
            <li>
              <Icon name="user" size={18} /> {channel.handle}
            </li>
            <li>
              <Icon name="location" size={18} /> {channel.location}
            </li>
            <li>
              <Icon name="calendar" size={18} /> Joined {channel.joined}
            </li>
            <li>
              <Icon name="eye" size={18} /> {fullNumber(channel.totalViews)} views
            </li>
          </ul>
          {channel.links?.length ? (
            <>
              <h2>Links</h2>
              <ul className="about__list">
                {channel.links.map((l) => (
                  <li key={l.url}>
                    <Icon name="flag" size={18} />
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="muted">Last uploaded {timeAgo(videos[0]?.ageDays ?? 30)} ago.</p>
        </div>
      </Modal>
    </div>
  );
}
