import { useEffect, useState } from "react";
import { apiKeySource, resolveApiKey } from "../lib/ytApi";
import { useApp } from "../store/AppContext";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function ApiSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setApiKey, toast } = useApp();
  const [draft, setDraft] = useState(state.apiKey);

  useEffect(() => {
    if (open) setDraft(state.apiKey);
  }, [open, state.apiKey]);

  const source = apiKeySource(state.apiKey);
  const effective = resolveApiKey(state.apiKey);

  return (
    <Modal open={open} onClose={onClose} label="YouTube API settings" size="sm">
      <div className="apisettings">
        <h3 className="apisettings__title">YouTube Data API</h3>
        <p className="muted apisettings__lead">
          CollinsTube uses the official YouTube Data API v3 for live search, trending and channel
          uploads. The free tier includes <strong>10,000 quota units/day</strong> (roughly 100
          searches) and needs no credit card.
        </p>

        <label className="field apisettings__field">
          <span>API key</span>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <p className="apisettings__status muted">
          Status:{" "}
          {source === "settings" && "saved in this browser"}
          {source === "env" && "loaded from build env (VITE_YT_API_KEY)"}
          {source === "builtin" && "built-in key — live YouTube content enabled"}
          {source === "none" && "no key — offline catalog only"}
          {effective && <span className="apisettings__dot apisettings__dot--on" />}
        </p>

        <div className="apisettings__actions">
          <button
            className="btn btn--primary"
            onClick={() => {
              setApiKey(draft.trim());
              toast(draft.trim() ? "API key saved — live YouTube content enabled" : "API key removed");
              onClose();
            }}
          >
            Save
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setDraft("");
              setApiKey("");
              toast("API key cleared");
            }}
          >
            Remove key
          </button>
        </div>

        <hr className="dropdown__rule" />
        <a
          className="apisettings__link"
          href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chevronRight" size={16} /> Get a free key (Google Cloud → YouTube Data API v3)
        </a>
        <p className="muted apisettings__fineprint">
          The key stays in this browser (localStorage) or your build environment. Data API access
          never includes video stream URLs — playback still uses YouTube's official embedded player.
        </p>
      </div>
    </Modal>
  );
}

/** Slim notice shown on content pages while no API key is configured. */
export function ApiKeyBanner() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  if (resolveApiKey(state.apiKey)) return null;
  return (
    <>
      <div className="apibanner" role="status">
        <Icon name="info" size={18} />
        <span>
          Browsing the offline demo catalog — add a free YouTube API key for live search, trending
          and new uploads.
        </span>
        <button className="btn btn--chip" onClick={() => setOpen(true)}>
          Add API key
        </button>
      </div>
      <ApiSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
