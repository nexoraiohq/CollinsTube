import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { Notification, Theme, Toast, Upload, Video } from "../types";
import { NOTIFICATIONS } from "../data/misc";
import { VIDEOS } from "../data/videos";
import { onKeyRejected } from "../lib/ytApi";

export type User = { name: string; email: string; handle: string };

/**
 * Mini-player is the floating bottom-left player opened from a card's
 * "open in mini player" action. `start` carries the playback position so the
 * embedded player can resume where the card was up to, and `expanded` is the
 * larger size toggled by the `i` shortcut (YouTube's miniplayer key).
 */
export type MiniPlayerState = { id: string; start: number; expanded: boolean; video?: Video };

type State = {
  theme: Theme;
  railExpanded: boolean;
  user: User | null;
  liked: string[];
  disliked: string[];
  saved: string[];
  subscriptions: string[];
  history: string[];
  uploads: Upload[];
  notifications: Notification[];
  searchHistory: string[];
  toasts: Toast[];
  miniPlayer: MiniPlayerState | null;
  imports: Video[];
  progress: Record<string, number>;
  apiKey: string;
};

type Action =
  | { type: "theme"; value: Theme }
  | { type: "rail"; value: boolean }
  | { type: "user"; value: User | null }
  | { type: "liked"; id: string }
  | { type: "disliked"; id: string }
  | { type: "saved"; id: string }
  | { type: "sub"; handle: string }
  | { type: "historyAdd"; id: string }
  | { type: "historyRemove"; id: string }
  | { type: "historyClear" }
  | { type: "uploadAdd"; value: Upload }
  | { type: "uploadRemove"; id: string }
  | { type: "notifRead"; id?: string }
  | { type: "searchAdd"; q: string }
  | { type: "searchClear" }
  | { type: "toastAdd"; value: Toast }
  | { type: "toastRemove"; id: number }
  | { type: "mini"; value: MiniPlayerState | null }
  | { type: "importAdd"; value: Video }
  | { type: "progressSet"; id: string; sec: number }
  | { type: "apiKey"; value: string }
  | { type: "hydrate"; value: State };

const STORAGE_KEY = "ytclone.state.v1";

const initial: State = {
  theme: "dark",
  railExpanded: false,
  user: null,
  liked: [],
  disliked: [],
  saved: [],
  subscriptions: ["@lofigirl", "@3blue1brown"],
  history: [],
  uploads: [],
  notifications: NOTIFICATIONS,
  searchHistory: ["lofi hip hop radio", "event loop javascript"],
  toasts: [],
  miniPlayer: null,
  imports: [],
  progress: {},
  apiKey: "",
};

function persist(state: State) {
  try {
    const { toasts, miniPlayer, ...rest } = state;
    void toasts;
    void miniPlayer;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      ...initial,
      ...parsed,
      notifications: parsed.notifications ?? NOTIFICATIONS,
      imports: Array.isArray(parsed.imports) ? parsed.imports : [],
      progress:
        parsed.progress && typeof parsed.progress === "object" ? (parsed.progress as Record<string, number>) : {},
      toasts: [],
      miniPlayer: null,
    };
  } catch {
    return initial;
  }
}

const toggle = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "theme":
      return { ...state, theme: action.value };
    case "rail":
      return { ...state, railExpanded: action.value };
    case "user":
      return { ...state, user: action.value };
    case "liked":
      return {
        ...state,
        liked: toggle(state.liked, action.id),
        disliked: state.disliked.includes(action.id)
          ? state.disliked.filter((x) => x !== action.id)
          : state.disliked,
      };
    case "disliked":
      return {
        ...state,
        disliked: toggle(state.disliked, action.id),
        liked: state.liked.includes(action.id)
          ? state.liked.filter((x) => x !== action.id)
          : state.liked,
      };
    case "saved":
      return { ...state, saved: toggle(state.saved, action.id) };
    case "sub":
      return { ...state, subscriptions: toggle(state.subscriptions, action.handle) };
    case "historyAdd":
      return { ...state, history: [action.id, ...state.history.filter((x) => x !== action.id)].slice(0, 200) };
    case "historyRemove":
      return { ...state, history: state.history.filter((x) => x !== action.id) };
    case "historyClear":
      return { ...state, history: [] };
    case "uploadAdd":
      return { ...state, uploads: [action.value, ...state.uploads] };
    case "uploadRemove":
      return { ...state, uploads: state.uploads.filter((u) => u.id !== action.id) };
    case "notifRead":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          action.id ? (n.id === action.id ? { ...n, unread: false } : n) : { ...n, unread: false },
        ),
      };
    case "searchAdd": {
      const q = action.q.trim();
      if (!q) return state;
      return {
        ...state,
        searchHistory: [q, ...state.searchHistory.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10),
      };
    }
    case "searchClear":
      return { ...state, searchHistory: [] };
    case "toastAdd":
      return { ...state, toasts: [...state.toasts, action.value].slice(-3) };
    case "toastRemove":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "mini":
      return { ...state, miniPlayer: action.value };
    case "importAdd":
      return state.imports.some((v) => v.id === action.value.id)
        ? state
        : { ...state, imports: [action.value, ...state.imports] };
    case "progressSet":
      return {
        ...state,
        progress: { ...state.progress, [action.id]: Math.max(state.progress[action.id] ?? 0, action.sec) },
      };
    case "apiKey":
      return { ...state, apiKey: action.value };
    case "hydrate":
      return action.value;
    default:
      return state;
  }
}

type Ctx = {
  state: State;
  setTheme: (t: Theme) => void;
  toggleRail: () => void;
  setUser: (u: User | null) => void;
  toggleLike: (id: string) => void;
  toggleDislike: (id: string) => void;
  toggleSave: (id: string) => void;
  toggleSub: (handle: string) => void;
  addHistory: (id: string) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  addUpload: (u: Upload) => void;
  removeUpload: (id: string) => void;
  readNotifications: (id?: string) => void;
  addSearch: (q: string) => void;
  clearSearch: () => void;
  toast: (message: string, opts?: { actionLabel?: string; actionTo?: string; onAction?: () => void }) => void;
  dismissToast: (id: number) => void;
  setMiniPlayer: (value: MiniPlayerState | null) => void;
  addImport: (v: Video) => void;
  setProgress: (id: string, sec: number) => void;
  setApiKey: (key: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const toastSeq = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", state.theme === "dark" ? "#0a0a0b" : "#fbfbfc");
  }, [state.theme]);

  useEffect(() => {
    persist(state);
  }, [state]);

  // When ytApi rejects a stored Settings key as invalid it clears localStorage,
  // but the persist-effect would immediately re-write state.apiKey back. Clear
  // the in-memory key too so the dead key can't stick and the app falls back to
  // the working built-in key.
  useEffect(() => {
    onKeyRejected(() => dispatch({ type: "apiKey", value: "" }));
    return () => onKeyRejected(null);
  }, []);

  const toast = useCallback<Ctx["toast"]>((message, opts) => {
    const id = ++toastSeq.current;
    dispatch({ type: "toastAdd", value: { id, message, ...opts } });
    window.setTimeout(() => dispatch({ type: "toastRemove", id }), opts?.actionLabel ? 6000 : 3800);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      setTheme: (t) => dispatch({ type: "theme", value: t }),
      toggleRail: () => dispatch({ type: "rail", value: !state.railExpanded }),
      setUser: (u) => dispatch({ type: "user", value: u }),
      toggleLike: (id) => dispatch({ type: "liked", id }),
      toggleDislike: (id) => dispatch({ type: "disliked", id }),
      toggleSave: (id) => dispatch({ type: "saved", id }),
      toggleSub: (handle) => dispatch({ type: "sub", handle }),
      addHistory: (id) => dispatch({ type: "historyAdd", id }),
      removeHistory: (id) => dispatch({ type: "historyRemove", id }),
      clearHistory: () => dispatch({ type: "historyClear" }),
      addUpload: (u) => dispatch({ type: "uploadAdd", value: u }),
      removeUpload: (id) => dispatch({ type: "uploadRemove", id }),
      readNotifications: (id) => dispatch({ type: "notifRead", id }),
      addSearch: (q) => dispatch({ type: "searchAdd", q }),
      clearSearch: () => dispatch({ type: "searchClear" }),
      toast,
      dismissToast: (id) => dispatch({ type: "toastRemove", id }),
      setMiniPlayer: (value) => dispatch({ type: "mini", value }),
      addImport: (v) => dispatch({ type: "importAdd", value: v }),
      setProgress: (id, sec) => dispatch({ type: "progressSet", id, sec }),
      setApiKey: (key) => dispatch({ type: "apiKey", value: key }),
    }),
    [state, toast],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function useLibrary() {
  const { state } = useApp();
  return useMemo(() => {
    const videos = state.imports.length ? [...state.imports, ...VIDEOS] : VIDEOS;
    return {
      videos,
      find: (id?: string | null): Video | undefined =>
        id ? videos.find((v) => v.id === id) : undefined,
      byHandle: (handle: string): Video[] => videos.filter((v) => v.handle === handle),
    };
  }, [state.imports]);
}
