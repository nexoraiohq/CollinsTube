import { useApp } from "../store/AppContext";
import { Icon } from "../components/Icon";
import { colorFor, cx, timeAgo } from "../lib/format";
import type { Upload } from "../types";

function UploadCard({ u, onDelete }: { u: Upload; onDelete: () => void }) {
  const { toast } = useApp();
  const [from, to] = colorFor(u.id);
  const done = u.progress >= 100;
  return (
    <article className="card upload-card">
      <button
        className="upload-card__media"
        style={{ backgroundImage: `linear-gradient(135deg, ${u.thumbnailColor?.[0] ?? from}, ${u.thumbnailColor?.[1] ?? to})` }}
        onClick={() => toast(done ? "Preview player is warming up" : "Still processing…")}
      >
        <span className="upload-card__play">
          <Icon name="play" size={26} />
        </span>
        <span className="upload-card__duration">{done ? "12:00" : "—"}</span>
        {!done && (
          <span className="upload-card__progress">
            <span style={{ width: `${u.progress}%` }} />
          </span>
        )}
      </button>
      <div className="card__body">
        <div className="card__meta">
          <p className={cx("upload-card__title", done ? "" : "muted")}>{u.title || "Untitled upload"}</p>
          <p className="card__stats">
            {done ? "Published" : `Processing ${u.progress}%`} · {u.visibility} ·{" "}
            {timeAgo(Math.floor((Date.now() - u.createdAt) / 86_400_000))}
          </p>
          <div className="upload-card__actions">
            <button className="btn btn--chip" onClick={() => toast("Editor opened (demo)")}>
              Edit
            </button>
            <button className="btn btn--chip" onClick={() => toast("Analytics are gathering data")}>
              Analytics
            </button>
            <button className="btn btn--chip" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function YourVideosPage({ onOpenUpload }: { onOpenUpload: () => void }) {
  const { state, removeUpload, toast } = useApp();

  return (
    <div className="page">
      <div className="page-head page-head--split">
        <div>
          <h1>Your videos</h1>
          <p className="muted">Uploads live on this device — nothing leaves your browser.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--chip" onClick={() => toast("No drafts")}>
            Drafts
          </button>
          <button className="btn btn--primary" onClick={onOpenUpload}>
            <Icon name="upload" size={18} /> Upload video
          </button>
        </div>
      </div>

      {state.uploads.length === 0 ? (
        <div className="empty">
          <div className="empty__art empty__art--big">
            <Icon name="upload" size={46} />
          </div>
          <h2>Nothing uploaded yet</h2>
          <p className="muted">Share your first video — drag a file anywhere onto the Create dialog.</p>
          <button className="btn btn--primary" onClick={onOpenUpload}>
            Upload your first video
          </button>
        </div>
      ) : (
        <div className="grid grid--home">
          {state.uploads.map((u) => (
            <UploadCard key={u.id} u={u} onDelete={() => {
              removeUpload(u.id);
              toast("Upload deleted");
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
