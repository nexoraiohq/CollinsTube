import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp, useLibrary } from "../store/AppContext";
import { compact, cx, durationTime } from "../lib/format";
import { Icon } from "../components/Icon";
import { VideoRow } from "../components/VideoCard";

export function PlaylistPage() {
  const [params] = useSearchParams();
  const listId = params.get("list") ?? "WL";
  const nav = useNavigate();
  const { state, toggleSave, toggleLike, toast, clearHistory } = useApp();
  const { find } = useLibrary();

  const isWatchLater = listId === "WL";
  const isLiked = listId === "LL";

  const ids = isWatchLater ? state.saved : isLiked ? state.liked : [];
  const videos = useMemo(
    () => ids.map((id) => find(id)).filter(Boolean),
    [ids, find],
  );

  const title = isWatchLater ? "Watch later" : isLiked ? "Liked videos" : "Saved playlist";
  const subtitle = isWatchLater
    ? "Videos you save for the perfect moment"
    : isLiked
      ? "Everything you've given a thumbs up"
      : "Your private collection";

  const totalDuration = videos.reduce((acc, v) => acc + (v?.duration ?? 0), 0);

  return (
    <div className="page page--playlist">
      <header className="pl-hero">
        <div className="pl-hero__art">
          <Icon name={isLiked ? "thumbUp" : "clock"} size={46} />
          <span className="pl-hero__count">{videos.length}</span>
        </div>
        <div className="pl-hero__body">
          <span className="pl-hero__eyebrow">Playlist · {isWatchLater || isLiked ? "Private" : "Public"}</span>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          <p className="muted">
            {state.user?.name ?? "You"} · {videos.length} videos ·{" "}
            {totalDuration ? durationTime(totalDuration) : "0:00"} total
          </p>
          <div className="pl-hero__actions">
            <button
              className="btn btn--primary"
              disabled={!videos.length}
              onClick={() => nav(`/watch?v=${videos[0]!.id}`)}
            >
              <Icon name="play" size={18} /> Play all
            </button>
            <button
              className="btn btn--outline"
              disabled={!videos.length}
              onClick={() => {
                const pick = videos[Math.floor(Math.random() * videos.length)]!;
                nav(`/watch?v=${pick.id}`);
              }}
            >
              <Icon name="sort" size={18} /> Shuffle
            </button>
            <button
              className="btn btn--chip"
              onClick={() =>
                toast(
                  isWatchLater || isLiked
                    ? "System playlists can't be deleted"
                    : "Playlist deleted",
                )
              }
            >
              <Icon name="trash" size={16} /> Delete
            </button>
            {isWatchLater && state.history.length > 0 && (
              <button
                className="btn btn--chip"
                onClick={() => {
                  clearHistory();
                  toast("Watch history cleared too");
                }}
              >
                Clear history
              </button>
            )}
          </div>
        </div>
      </header>

      {videos.length === 0 ? (
        <div className="empty">
          <div className="empty__art">
            <Icon name={isLiked ? "thumbUp" : "clock"} size={38} />
          </div>
          <h2>{title} is empty</h2>
          <p className="muted">
            {isLiked
              ? "Tap the thumbs up under any video and it lands here."
              : "Use Save on any video to keep it here for later."}
          </p>
          <Link className="btn btn--primary" to="/">
            Browse videos
          </Link>
        </div>
      ) : (
        <ul className="pl-list">
          {videos.map((v, i) => (
            <li key={v!.id} className={cx("pl-row")}>
              <span className="pl-row__index">{i + 1}</span>
              <VideoRow
                video={v!}
                variant="search"
                onRemove={
                  isWatchLater || isLiked
                    ? () => {
                        if (isWatchLater) toggleSave(v!.id);
                        else toggleLike(v!.id);
                        toast("Removed from playlist", {
                          actionLabel: "Undo",
                          onAction: () => {
                            if (isWatchLater) toggleSave(v!.id);
                            else toggleLike(v!.id);
                          },
                        });
                      }
                    : undefined
                }
              />
              <button
                className="iconbtn pl-row__remove"
                onClick={() => {
                  if (isWatchLater) toggleSave(v!.id);
                  else toggleLike(v!.id);
                  toast("Removed from playlist", {
                    actionLabel: "Undo",
                    onAction: () => {
                      if (isWatchLater) toggleSave(v!.id);
                      else toggleLike(v!.id);
                    },
                  });
                }}
                aria-label="Remove"
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="muted">
        {compact(videos.length * 1200)} playlist views · updated just now
      </p>
    </div>
  );
}
