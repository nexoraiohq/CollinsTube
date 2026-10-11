import { useMemo, useState } from "react";
import type { Comment } from "../types";
import { useApp } from "../store/AppContext";
import { commentsFor } from "../data/comments";
import { compact, cx, timeAgo } from "../lib/format";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

type SortMode = "top" | "new";

export function CommentsSection({
  videoId,
  onNeedSignIn,
}: {
  videoId: string;
  onNeedSignIn: () => void;
}) {
  const { state, toast } = useApp();
  const [sort, setSort] = useState<SortMode>("top");
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Comment[]>([]);
  const [liked, setLiked] = useState<string[]>([]);

  const base = useMemo(() => commentsFor(videoId), [videoId]);
  const all = useMemo(() => [...extra, ...base], [extra, base]);
  const sorted = useMemo(() => {
    const arr = [...all];
    if (sort === "top") arr.sort((a, b) => (a.pinned === b.pinned ? b.likes - a.likes : a.pinned ? -1 : 1));
    else arr.sort((a, b) => a.ageDays - b.ageDays);
    return arr;
  }, [all, sort]);

  const count = 412 + all.length * 37 + (videoId.length % 9) * 113;

  const post = () => {
    if (!state.user) {
      onNeedSignIn();
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setExtra((x) => [
      {
        id: `you-${Date.now()}`,
        author: state.user!.name,
        handle: state.user!.handle,
        text,
        likes: 0,
        ageDays: 0,
      },
      ...x,
    ]);
    setDraft("");
    toast("Comment added");
  };

  return (
    <section className="comments" id="comments" aria-label="Comments">
      <header className="comments__head">
        <h2>{count.toLocaleString("en-US")} Comments</h2>
        <div className="comments__sort">
          <button
            className="btn btn--ghost"
            onClick={() => setSort((s) => (s === "top" ? "new" : "top"))}
          >
            <Icon name="sort" size={20} />
            Sort by: <strong>{sort === "top" ? "Top comments" : "Newest first"}</strong>
          </button>
        </div>
      </header>

      <div className="comment-compose">
        <Avatar name={state.user?.name ?? "Guest"} size={40} />
        <div className="comment-compose__field">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              if (!state.user) onNeedSignIn();
            }}
            onKeyDown={(e) => e.key === "Enter" && post()}
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />
          <span className="comment-compose__underline" style={{ transform: `scaleX(${draft ? 1 : 0})` }} />
          {draft && (
            <div className="comment-compose__actions">
              <button className="btn btn--ghost" onClick={() => setDraft("")}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={post} disabled={!draft.trim()}>
                Comment
              </button>
            </div>
          )}
        </div>
      </div>

      <ul className="comment-list">
        {sorted.map((c) => {
          const isLiked = liked.includes(c.id);
          return (
            <li className="comment" key={c.id}>
              <Avatar name={c.author} size={40} />
              <div className="comment__body">
                {c.pinned && (
                  <span className="comment__badge">
                    <Icon name="pin" size={13} /> Pinned by creator
                  </span>
                )}
                <p className="comment__meta">
                  <span className="comment__author">{c.handle}</span>
                  <time>{timeAgo(c.ageDays)}</time>
                </p>
                <p className="comment__text">{c.text}</p>
                <div className="comment__actions">
                  <button
                    className={cx("chipbtn", isLiked && "is-active")}
                    onClick={() => {
                      setLiked((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id]));
                    }}
                    aria-pressed={isLiked}
                  >
                    <Icon name="thumbUp" size={16} />
                    {compact(c.likes + (isLiked ? 1 : 0))}
                  </button>
                  <button
                    className="chipbtn"
                    onClick={() => setLiked((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l))}
                    aria-label="Dislike"
                  >
                    <Icon name="thumbDown" size={16} />
                  </button>
                  <button className="chipbtn" onClick={() => toast("Reply box opened — demo only")}>
                    Reply
                  </button>
                  {c.hearted && (
                    <span className="comment__heart" title="Loved by creator">
                      ❤️
                    </span>
                  )}
                </div>
                {c.replies ? (
                  <button className="linkbtn linkbtn--replies">
                    <Icon name="chevronDown" size={16} /> {c.replies} replies
                  </button>
                ) : null}
              </div>
              <button className="iconbtn comment__more" aria-label="More" onClick={() => toast("Comment options")}>
                <Icon name="more" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
