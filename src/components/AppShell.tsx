import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useApp, useLibrary } from "../store/AppContext";
import { VIDEOS } from "../data/videos";
import { useHotkey } from "../lib/hooks";
import { cx, playerUrl, prefetchThumbnails } from "../lib/format";
import { CommandPalette, SignInModal } from "./CommandPalette";
import { Header } from "./Header";
import { Icon } from "./Icon";
import { MobileNav } from "./MobileNav";
import { Modal } from "./Modal";
import { Sidebar } from "./Sidebar";
import { ToastHost } from "./ToastHost";
import { UploadModal } from "./UploadModal";
import { Thumbnail } from "./Thumbnail";
import { HomePage } from "../pages/Home";
import { WatchPage } from "../pages/Watch";
import { SearchPage } from "../pages/Search";
import { ChannelPage } from "../pages/Channel";
import { HistoryPage, LibraryPage, SubscriptionsPage } from "../pages/Feed";
import { PlaylistPage } from "../pages/Playlist";
import { TrendingPage } from "../pages/Trending";
import { ShortsPage } from "../pages/Shorts";
import { YourVideosPage } from "../pages/YourVideos";
import { NotFoundPage } from "../pages/NotFound";

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + K", "Open quick search palette"],
  ["/", "Focus the search bar"],
  ["T", "Toggle theater mode on a video"],
  ["A", "Toggle autoplay on a video"],
  ["↑ / ↓", "Move between shorts"],
  ["Esc", "Close any dialog, menu or panel"],
  ["Home logo click", "Back to the homepage"],
];

function useIsMobile() {
  const [m, setM] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1024px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function MiniPlayer() {
  const { state, setMiniPlayer, toast } = useApp();
  const { find } = useLibrary();
  const nav = useNavigate();
  const loc = useLocation();
  const mini = state.miniPlayer;
  const video = mini ? (mini.video ?? find(mini.id)) : null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  // The mini player owns the `i` key while it is open — YouTube's miniplayer
  // shortcut. Esc collapses an expanded mini player back to its small size.
  useHotkey(
    (e) => e.key.toLowerCase() === "i" && !e.ctrlKey && !e.metaKey && !e.altKey,
    () => setMiniPlayer(mini ? { ...mini, expanded: !mini.expanded } : null),
    !!mini,
  );
  const open = !!mini;
  useHotkey(
    (e) => e.key === "Escape" && !!mini?.expanded,
    () => {
      if (mini) setMiniPlayer({ ...mini, expanded: false });
    },
    open,
  );

  // Send a command to the embed over the raw postMessage protocol.
  const sendCmd = (func: string, args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", id: 1, func, args }),
      "*",
    );
  };

  const toggleMute = () => {
    if (muted) {
      sendCmd("unMute");
      setMuted(false);
    } else {
      sendCmd("mute");
      setMuted(true);
    }
  };

  const copyLink = () => {
    if (!video) return;
    const url = `${window.location.origin}/watch?v=${video.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast("Link copied to clipboard");
  };

  if (!video || !mini || loc.pathname === "/watch" || loc.pathname.startsWith("/shorts")) return null;

  return (
    <div
      className={cx("mini", mini.expanded && "mini--expanded")}
      role="complementary"
      aria-label="Mini player"
    >
      <div className="mini__media">
        <iframe
          ref={frameRef}
          className="mini__frame"
          // Must be muted: browsers block unmuted iframe autoplay, so a
          // sound-on embed would load and sit frozen on the poster frame.
          src={playerUrl(video.id, true, true, Math.floor(mini.start), true, window.location.origin)}
          title={video.title}
          allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="origin"
        />
        <Link
          className="mini__expand"
          to={`/watch?v=${video.id}`}
          aria-label="Open in full player"
          title="Open in full player"
          onClick={() => setMiniPlayer(null)}
        />
      </div>
      <div className="mini__meta">
        <p className="mini__title">{video.title}</p>
        <p className="muted">Playing now</p>
      </div>
      <div className="mini__controls">
        <button
          className="iconbtn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          <Icon name={muted ? "mute" : "volume"} size={20} />
        </button>
        <button
          className="iconbtn"
          onClick={copyLink}
          aria-label="Copy link"
          title="Copy link"
        >
          <Icon name="share" size={20} />
        </button>
        <button
          className="iconbtn"
          onClick={() => setMiniPlayer({ ...mini, expanded: !mini.expanded })}
          aria-label={mini.expanded ? "Collapse mini player" : "Expand mini player"}
          title={mini.expanded ? "Collapse (Esc)" : "Expand (i)"}
        >
          <Icon name={mini.expanded ? "chevronDown" : "chevronUp"} size={20} />
        </button>
        <button
          className="iconbtn"
          onClick={() => setMiniPlayer(null)}
          aria-label="Close mini player"
          title="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { state, toggleRail, setMiniPlayer, addSearch } = useApp();
  const { find } = useLibrary();
  const loc = useLocation();
  const nav = useNavigate();
  const isMobile = useIsMobile();

  const [drawer, setDrawer] = useState(false);
  const [upload, setUpload] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [signin, setSignin] = useState(false);

  useEffect(() => {
    if (loc.pathname === "/watch") setMiniPlayer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  useEffect(() => {
    setDrawer(false);
    if (loc.pathname !== "/watch") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Home",
      "/results": "Search results",
      "/shorts": "Shorts",
      "/feed/trending": "Trending",
      "/feed/history": "Watch history",
      "/feed/library": "Library",
      "/feed/subscriptions": "Subscriptions",
      "/feed/your-videos": "Your videos",
      "/playlist": "Playlist",
    };
    let title = titles[loc.pathname];
    if (loc.pathname === "/watch") {
      const v = find(new URLSearchParams(loc.search).get("v"));
      title = v ? v.title : "Video unavailable";
    }
    if (!title) {
      if (loc.pathname.startsWith("/shorts")) title = "Shorts";
      else if (loc.pathname.startsWith("/@")) title = loc.pathname.slice(2);
      else title = "Page not found";
    }
    document.title = `${title} — YouTube Clone`;
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    const ids = VIDEOS.slice(0, 16).map((v) => v.id);
    // Warm the first screenful immediately; the rest when the browser is idle.
    prefetchThumbnails(ids.slice(0, 8));
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (idle) idle(() => prefetchThumbnails(ids.slice(8)), { timeout: 2500 });
    else window.setTimeout(() => prefetchThumbnails(ids.slice(8)), 1500);
  }, []);

  useHotkey(
    (e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k",
    () => setPalette((v) => !v),
  );
  useHotkey(
    (e) =>
      e.key === "/" &&
      !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement | null)?.tagName ?? ""),
    () => document.querySelector<HTMLInputElement>('.searchbar input')?.focus(),
  );

  const sidebarMode = isMobile ? "drawer" : state.railExpanded ? "expanded" : "rail";
  const isWatch = loc.pathname === "/watch";

  const openSignIn = () => setSignin(true);

  const content = useMemo(
    () => (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/watch" element={<WatchPage onNeedSignIn={openSignIn} />} />
        <Route path="/results" element={<SearchPage />} />
        <Route path="/shorts" element={<ShortsPage />} />
        <Route path="/shorts/:id" element={<ShortsPage />} />
        <Route path="/feed/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/feed/history" element={<HistoryPage />} />
        <Route path="/feed/library" element={<LibraryPage />} />
        <Route path="/feed/trending" element={<TrendingPage />} />
        <Route path="/feed/your-videos" element={<YourVideosPage onOpenUpload={() => setUpload(true)} />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        <Route path="/:handle" element={<ChannelPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    ),
    [],
  );

  return (
    <div
      className={cx(
        "shell",
        isMobile && "shell--mobile",
        !isMobile && sidebarMode === "rail" && "shell--rail",
        !isMobile && sidebarMode === "expanded" && "shell--expanded",
        isWatch && "shell--watch",
      )}
    >
      <Header
        onToggleSidebar={() => (isMobile ? setDrawer((v) => !v) : toggleRail())}
        onOpenUpload={() => setUpload(true)}
        onOpenPalette={() => setPalette(true)}
        onOpenShortcuts={() => setShortcuts(true)}
      />

      <div className="shell__body">
        <Sidebar
          mode={sidebarMode}
          open={drawer}
          onClose={() => {
            setDrawer(false);
            if (!isMobile && isWatch && state.railExpanded) toggleRail();
          }}
          onOpenSignIn={openSignIn}
        />

        <main className="main" key={loc.pathname + loc.search}>
          {content}
        </main>
      </div>

      <MobileNav onCreate={() => setUpload(true)} />
      <MiniPlayer />
      <ToastHost />

      <UploadModal open={upload} onClose={() => setUpload(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <SignInModal open={signin} onClose={() => setSignin(false)} />

      <Modal open={shortcuts} onClose={() => setShortcuts(false)} label="Keyboard shortcuts" size="sm">
        <ul className="shortcut-list">
          {SHORTCUTS.map(([k, d]) => (
            <li key={k}>
              <kbd>{k}</kbd>
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <div className="shortcut-foot">
          <p className="muted">Shortcuts are ignored while typing in a field.</p>
          <button
            className="btn btn--primary"
            onClick={() => {
              addSearch("event loop javascript");
              setShortcuts(false);
              nav("/results?search_query=event%20loop%20javascript");
            }}
          >
            Try a search
          </button>
        </div>
      </Modal>
    </div>
  );
}
