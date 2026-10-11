import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp, useLibrary } from "../store/AppContext";
import { cx, isLikelyVideoId, parseVideoId } from "../lib/format";
import { suggestFor } from "../lib/search";
import { useDismiss } from "../lib/hooks";
import { CHANNELS } from "../data/channels";
import { ApiSettingsModal } from "./ApiSettingsModal";
import { Avatar } from "./Avatar";
import { Icon, YTLogo } from "./Icon";
import { Modal } from "./Modal";

type Props = {
  onToggleSidebar: () => void;
  onOpenUpload: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
};

export function Header({ onToggleSidebar, onOpenUpload, onOpenShortcuts }: Props) {
  const { state, setTheme, setUser, addSearch, toast, readNotifications } = useApp();
  const { videos: library } = useLibrary();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [mcursor, setMCursor] = useState(-1);
  const [listening, setListening] = useState(false);
  const [apiSettings, setApiSettings] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (mobileSearch) {
      requestAnimationFrame(() => mobileInputRef.current?.focus());
    } else {
      setMCursor(-1);
    }
  }, [mobileSearch]);

  const search = useDismiss<HTMLDivElement>();
  const notif = useDismiss<HTMLDivElement>();
  const account = useDismiss<HTMLDivElement>();

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    setQ(params.get("search_query") ?? "");
    search.close();
    notif.close();
    account.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search, loc.pathname]);

  const suggestions = useMemo(
    () => (q.trim() ? suggestFor(library, state.searchHistory, q) : []),
    [q, state.searchHistory, library],
  );

  const submit = (value?: string) => {
    const term = (value ?? q).trim();
    if (!term) return;
    // A pasted YouTube link (or an id-like token) opens the player directly.
    const directId = parseVideoId(term) ?? (value === undefined && isLikelyVideoId(term) ? term : null);
    if (directId) {
      addSearch(term);
      setQ(term);
      search.close();
      inputRef.current?.blur();
      nav(`/watch?v=${directId}`);
      return;
    }
    addSearch(term);
    setQ(term);
    search.close();
    inputRef.current?.blur();
    nav(`/results?search_query=${encodeURIComponent(term)}`);
  };

  const unread = state.notifications.filter((n) => n.unread).length;

  return (
    <header className="header">
      <div className="header__left">
        <button className="iconbtn header__menu" onClick={onToggleSidebar} aria-label="Toggle menu">
          <Icon name="menu" />
        </button>
        <Link to="/" className="header__logo" aria-label="CollinsTube Home">
          <YTLogo />
        </Link>
      </div>

      <div className={cx("header__search", search.open && "is-focused")} ref={search.ref}>
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            submit(cursor >= 0 ? suggestions[cursor]?.text : undefined);
          }}
          role="search"
        >
          <div className="searchbar__field">
            {search.open && (
              <button
                type="button"
                className="searchbar__lead iconbtn"
                onClick={() => {
                  search.close();
                  inputRef.current?.blur();
                }}
                aria-label="Back"
              >
                <Icon name="arrowBack" size={20} />
              </button>
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(-1);
                search.setOpen(true);
              }}
              onFocus={() => search.setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && suggestions.length > 0) {
                  e.preventDefault();
                  const next = Math.min(cursor + 1, suggestions.length - 1);
                  setCursor(next);
                  optionRefs.current[next]?.focus();
                } else if (e.key === "ArrowUp" && suggestions.length > 0) {
                  e.preventDefault();
                  if (cursor <= 0) {
                    setCursor(-1);
                    inputRef.current?.focus();
                  } else {
                    const prev = cursor - 1;
                    setCursor(prev);
                    optionRefs.current[prev]?.focus();
                  }
                } else if (e.key === "Escape") {
                  search.close();
                  inputRef.current?.blur();
                }
              }}
              placeholder="Search"
              aria-label="Search"
              autoComplete="off"
            />
            {q && (
              <button
                type="button"
                className="searchbar__clear iconbtn"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
          <button className="searchbar__btn" type="submit" aria-label="Search">
            <Icon name="search" size={22} />
          </button>
          <button
            type="button"
            className="searchbar__mic iconbtn"
            onClick={() => setListening(true)}
            aria-label="Search with your voice"
            title="Search with your voice"
          >
            <Icon name="mic" size={20} />
          </button>
        </form>

        {search.open && suggestions.length > 0 && (
          <div className="suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <button
                key={s.text}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                className={cx("suggestions__item", i === cursor && "is-active")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setCursor(i)}
                onClick={() => submit(s.text)}
                role="option"
                aria-selected={i === cursor}
              >
                <Icon name={q ? "search" : "history"} size={18} />
                <span className={cx("suggestions__text", s.kind === "tag" && "suggestions__text--tag")}>{s.text}</span>
                <Icon name="arrowBack" size={16} className="suggestions__go" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="header__right">
        <button
          className="iconbtn header__mobile-search"
          onClick={() => setMobileSearch(true)}
          aria-label="Search"
        >
          <Icon name="search" />
        </button>
        <button className="btn btn--ghost header__create" onClick={onOpenUpload}>
          <Icon name="plus" size={22} />
          <span>Create</span>
        </button>

        <div className="dropdown-anchor" ref={notif.ref}>
          <button
            className={cx("iconbtn", notif.open && "is-open")}
            onClick={() => {
              notif.setOpen(!notif.open);
              if (!notif.open) account.close();
            }}
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <Icon name="bell" />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          {notif.open && (
            <div className="dropdown dropdown--notif">
              <div className="dropdown__head">
                <h3>Notifications</h3>
                <button
                  className="linkbtn"
                  onClick={() => {
                    readNotifications();
                    toast("All notifications marked as read");
                  }}
                >
                  Mark all read
                </button>
              </div>
              <ul className="notif-list">
                {state.notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      className={cx("notif", n.unread && "is-unread")}
                      onClick={() => {
                        readNotifications(n.id);
                        notif.close();
                        nav(n.videoId ? `/watch?v=${n.videoId}` : `/@${n.handle.replace("@", "")}`);
                      }}
                    >
                      <Avatar name={n.channel} size={40} src={CHANNELS[n.handle]?.avatar} />
                      <span className="notif__body">
                        <strong>{n.channel}</strong> {n.text}
                        <time>{n.ageDays === 0 ? "new" : `${n.ageDays}d ago`}</time>
                      </span>
                      {n.unread && <span className="notif__dot" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="dropdown-anchor" ref={account.ref}>
          <button
            className="header__account"
            onClick={() => {
              account.setOpen(!account.open);
              if (!account.open) notif.close();
            }}
            aria-label="Account menu"
          >
            {state.user ? (
              <Avatar name={state.user.name} size={32} />
            ) : (
              <span className="signin-avatar">
                <Icon name="user" size={20} />
              </span>
            )}
          </button>
          {account.open && (
            <div className="dropdown dropdown--account">
              <div className="account-card">
                {state.user ? (
                  <>
                    <Avatar name={state.user.name} size={44} />
                    <div>
                      <strong>{state.user.name}</strong>
                      <span className="muted">{state.user.email}</span>
                      <Link
                        className="account-card__link"
                        to={`/${state.user.handle}`}
                        onClick={() => account.close()}
                      >
                        View your channel
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="signin-avatar signin-avatar--lg">
                      <Icon name="user" size={26} />
                    </span>
                    <div>
                      <strong>You're not signed in</strong>
                      <span className="muted">Sign in to like, comment and subscribe.</span>
                    </div>
                  </>
                )}
              </div>
              <hr className="dropdown__rule" />
              <button
                className="menu-item"
                onClick={() => {
                  setTheme(state.theme === "dark" ? "light" : "dark");
                  toast(`Appearance: ${state.theme === "dark" ? "light" : "dark"}`);
                  account.close();
                }}
              >
                <Icon name={state.theme === "dark" ? "sun" : "moon"} size={20} />
                Appearance: {state.theme === "dark" ? "Light" : "Dark"}
                <Icon name="chevronRight" size={16} className="menu-item__chev" />
              </button>
              <button className="menu-item" onClick={() => {
                account.close();
                onOpenShortcuts();
              }}>
                <Icon name="keyboard" size={20} />
                Keyboard shortcuts
              </button>
              <hr className="dropdown__rule" />
              {state.user ? (
                <button
                  className="menu-item"
                  onClick={() => {
                    setUser(null);
                    account.close();
                    toast("Signed out");
                  }}
                >
                  <Icon name="logout" size={20} />
                  Sign out
                </button>
              ) : (
                <button
                  className="menu-item"
                  onClick={() => {
                    setUser({
                      name: "Collins Maiko",
                      email: "collinsmaiko91@gmail.com",
                      handle: "@collinsmaiko",
                    });
                    account.close();
                    toast("Signed in as Collins Maiko");
                  }}
                >
                  <Icon name="user" size={20} />
                  Sign in
                </button>
              )}
              <button className="menu-item" onClick={() => {
                account.close();
                setApiSettings(true);
              }}>
                <Icon name="settings" size={20} />
                Settings
              </button>
              <button className="menu-item" onClick={() => toast("Thanks â€” feedback sent to the team")}>
                <Icon name="feedback" size={20} />
                Send feedback
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={mobileSearch}
        onClose={() => setMobileSearch(false)}
        label="Search"
        size="full"
        bare
        closeOnBackdrop={false}
      >
        <div className="msearch">
          <div className="msearch__bar">
            <button
              type="button"
              className="iconbtn"
              onClick={() => setMobileSearch(false)}
              aria-label="Back"
            >
              <Icon name="arrowBack" size={22} />
            </button>
            <form
              className="searchbar"
              onSubmit={(e) => {
                e.preventDefault();
                submit(mcursor >= 0 ? suggestions[mcursor]?.text : undefined);
                setMobileSearch(false);
              }}
              role="search"
            >
              <div className="searchbar__field">
                <input
                  ref={mobileInputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setMCursor(-1);
                  }}
                  onFocus={() => setMobileFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && suggestions.length > 0) {
                      e.preventDefault();
                      const next = Math.min(mcursor + 1, suggestions.length - 1);
                      setMCursor(next);
                      optionRefs.current[next]?.focus();
                    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
                      e.preventDefault();
                      if (mcursor <= 0) {
                        setMCursor(-1);
                        mobileInputRef.current?.focus();
                      } else {
                        const prev = mcursor - 1;
                        setMCursor(prev);
                        optionRefs.current[prev]?.focus();
                      }
                    } else if (e.key === "Escape") {
                      setMobileSearch(false);
                    }
                  }}
                  placeholder="Search"
                  aria-label="Search"
                  autoComplete="off"
                />
                {q && (
                  <button
                    type="button"
                    className="searchbar__clear iconbtn"
                    onClick={() => {
                      setQ("");
                      mobileInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <button className="searchbar__btn" type="submit" aria-label="Search">
                <Icon name="search" size={22} />
              </button>
            </form>
          </div>
          {mobileFocused && suggestions.length > 0 && (
            <div className="suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <button
                  key={s.text}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  className={cx("suggestions__item", i === mcursor && "is-active")}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setMCursor(i)}
                  onClick={() => {
                    submit(s.text);
                    setMobileSearch(false);
                  }}
                  role="option"
                  aria-selected={i === mcursor}
                >
                  <Icon name={q ? "search" : "history"} size={18} />
                  <span className={cx("suggestions__text", s.kind === "tag" && "suggestions__text--tag")}>
                    {s.text}
                  </span>
                  <Icon name="arrowBack" size={16} className="suggestions__go" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={listening} onClose={() => setListening(false)} label="Voice search" size="sm">
        <div className="voice">
          <div className="voice__pulse">
            <Icon name="mic" size={40} />
          </div>
          <p className="voice__status">Listeningâ€¦</p>
          <p className="muted">Say a video, artist or topic</p>
          <button
            className="btn btn--primary"
            onClick={() => {
              const pick = library[Math.floor(Math.random() * library.length)]!;
              setListening(false);
              submit(pick.title.split(" - ")[0] ?? "music");
            }}
          >
            Simulate result
          </button>
        </div>
      </Modal>

      <ApiSettingsModal open={apiSettings} onClose={() => setApiSettings(false)} />
    </header>
  );
}
