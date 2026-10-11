import { useEffect, useState } from "react";
import { useApp } from "../store/AppContext";
import { colorFor, cx, durationTime } from "../lib/format";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

type Step = "details" | "processing" | "published";

export function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addUpload, toast, state } = useApp();
  const [step, setStep] = useState<Step>("details");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [tags, setTags] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setStep("details");
        setProgress(0);
        setFileName(null);
        setTitle("");
        setDesc("");
        setTags("");
      }, 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "processing") return;
    const t = window.setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 14 + 4;
        if (next >= 100) {
          window.clearInterval(t);
          window.setTimeout(() => setStep("published"), 400);
          return 100;
        }
        return next;
      });
    }, 220);
    return () => window.clearInterval(t);
  }, [step]);

  const startUpload = () => {
    if (!fileName && !title.trim()) {
      toast("Add a file or a title first");
      return;
    }
    setStep("processing");
  };

  const publish = () => {
    const id = `up-${Date.now().toString(36)}`;
    addUpload({
      id,
      title: title.trim() || fileName || "Untitled upload",
      description: desc,
      visibility,
      progress: 100,
      createdAt: Date.now(),
      thumbnailColor: colorFor(id),
      duration: 720,
      tags,
    });
    setStep("published");
    toast("Video published to your channel", { actionLabel: "View", actionTo: "/feed/your-videos" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} label={step === "details" ? "Upload video" : step === "processing" ? "Processing" : "Published"} size="lg">
      {step === "details" && (
        <div className="upload">
          <div
            className={cx("dropzone", dragging && "is-dragging")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFileName(f.name);
                if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                toast(`Selected ${f.name}`);
              }
            }}
          >
            <span className="dropzone__art">
              <Icon name="upload" size={44} />
            </span>
            <h3>Drag and drop video files to upload</h3>
            <p className="muted">Your video will be private until you publish it.</p>
            <label className="btn btn--primary">
              Select files
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileName(f.name);
                    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
            </label>
            {fileName && (
              <p className="dropzone__file">
                <Icon name="check" size={16} /> {fileName}
              </p>
            )}
          </div>

          <div className="upload__form">
            <label className="field">
              <span>Title (required)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="Add a title that describes your video"
                maxLength={100}
              />
              <small className="field__count">{title.length}/100</small>
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                placeholder="Tell viewers about your video"
              />
            </label>
            <label className="field">
              <span>Tags</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="music, tutorial, vlog… (comma separated)"
              />
            </label>
            <fieldset className="field field--radios">
              <legend>Visibility</legend>
              {(["public", "unlisted", "private"] as const).map((v) => (
                <label key={v} className="radio">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                  />
                  <span className="radio__dot" />
                  <span className="radio__label">
                    <strong>{v[0]!.toUpperCase() + v.slice(1)}</strong>
                    <small className="muted">
                      {v === "public"
                        ? "Everyone can watch"
                        : v === "unlisted"
                          ? "Anyone with the link"
                          : "Only you"}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          <footer className="upload__foot">
            <p className="muted">
              Signed in as <strong>{state.user?.name ?? "Guest"}</strong> · Next: checks → publish
            </p>
            <div>
              <button className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={startUpload}>
                Upload
              </button>
            </div>
          </footer>
        </div>
      )}

      {step === "processing" && (
        <div className="upload-state">
          <div className="ring" style={{ ["--p" as string]: `${Math.round(progress)}%` }}>
            {Math.round(progress)}%
          </div>
          <h3>Uploading…</h3>
          <p className="muted">{fileName ?? title}</p>
          <ul className="checklist">
            <li className={progress > 15 ? "is-done" : ""}>
              <Icon name="check" size={16} /> Upload started
            </li>
            <li className={progress > 45 ? "is-done" : ""}>
              <Icon name="check" size={16} /> Checking for issues
            </li>
            <li className={progress > 75 ? "is-done" : ""}>
              <Icon name="check" size={16} /> Processing HD quality
            </li>
            <li className={progress >= 100 ? "is-done" : ""}>
              <Icon name="check" size={16} /> Ready to publish
            </li>
          </ul>
          <button className="btn btn--outline" onClick={() => setStep("details")}>
            Cancel upload
          </button>
        </div>
      )}

      {step === "published" && (
        <div className="upload-state">
          <div className="upload-state__ok">
            <Icon name="check" size={40} />
          </div>
          <h3>Your video is live</h3>
          <p className="muted">Duration {durationTime(720)} · visible to {visibility}</p>
          <div className="upload-state__actions">
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
