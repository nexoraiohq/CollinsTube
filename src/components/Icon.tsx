import { cx } from "../lib/format";

const P: Record<string, string> = {
  home: '<path d="M4 10.3 12 3.6l8 6.7V20h-6.2v-5.6H10.2V20H4z"/>',
  homeOutline:
    '<path d="M12 5.7 17 10.2V18h-2v-5.6H9V18H7v-7.8l5-4.5M12 3 3 11h2v9h5v-6h4v6h5v-9h2z"/>',
  shorts:
    '<path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25l1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07s3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"/>',
  subs: '<path d="M18.7 8.7H5.3V7h13.4v1.7zm-1.65-5H6.95v1.7h10.1V3.7zM21 12H3v7.3h18V12zm-11 3.7H6.7v-3.7H5.3v3.7H4v1.4h1.3v3.7h1.4v-3.7h1.3v-1.4zm6.7 0h-5.3v-3.7H11.3v3.7h1.4v-5.1H11.3V9.2h1.4V7.9h5.3v1.3h-1.4v5.1h1.4v1.4z"/>',
  library: '<path d="M4 6h11v2H4V6zm0 5h11v2H4v-2zm0 5h7v2H4v-2zm13-1.6V6l6 3.7-6 3.7z"/>',
  history: '<path d="M13 3c-4.97 0-9 4.03-9 9H1l3.9 3.9.1.1L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.96 8.96 0 0 0 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z"/>',
  clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.2-4.5-2.7V7z"/>',
  thumbUp:
    '<path transform="rotate(0 12 12)" d="M18.8 11h-4.3l1.5-4.9c.4-1.2-.5-2.4-1.7-2.5-.6 0-1.1.2-1.5.6L7 11H3v10h4h1h9.4c1.1 0 2-.7 2.2-1.6l1.4-6c.2-1.2-.7-2.4-2.2-2.4z"/>',
  thumbDown:
    '<path transform="rotate(180 12 12)" d="M18.8 11h-4.3l1.5-4.9c.4-1.2-.5-2.4-1.7-2.5-.6 0-1.1.2-1.5.6L7 11H3v10h4h1h9.4c1.1 0 2-.7 2.2-1.6l1.4-6c.2-1.2-.7-2.4-2.2-2.4z"/>',
  share:
    '<path d="M18 16.1c-.8 0-1.4.3-2 .8L8.9 12.7c0-.2.1-.5.1-.7s0-.5-.1-.7l7-4.1c.6.5 1.3.8 2.1.8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7L8 9.8C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7.1 4.2c0 .2-.1.4-.1.6 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.3-2.9-2.9-2.9z"/>',
  download:
    '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
  save: '<path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>',
  saved: '<path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>',
  more: '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>',
  moreH: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  search:
    '<circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m20.8 20.8-3.3-3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mic: '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3c0 3-2.5 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.4 2.7 6.2 6 6.7V21h2v-3.3c3.3-.5 6-3.3 6-6.7h-1.7z"/>',
  bell: '<path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z"/>',
  create: '<path d="M14 13h-3v3h-2v-3H6v-2h3V8h2v3h3v2zm7-7H3v14h18V6zm-2 12H5V8h14v10z"/>',
  menu: '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>',
  close: '<path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>',
  chevronDown: '<path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/>',
  chevronUp: '<path d="M12 8.6 7.4 13.2 6 11.8l6-6 6 6-1.4 1.4z"/>',
  chevronLeft: '<path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/>',
  chevronRight: '<path d="M8.6 7.4 10 6l6 6-6 6-1.4-1.4L13.2 12z"/>',
  check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/>',
  settings:
    '<path d="M19.1 12.9c0-.3 0-.6-.1-.9l2-1.6c.2-.1.2-.4.1-.6l-1.9-3.3c-.1-.2-.4-.3-.6-.2l-2.4 1c-.5-.4-1-.7-1.6-.9l-.4-2.5c0-.2-.2-.4-.5-.4h-3.8c-.2 0-.4.2-.5.4l-.3 2.5c-.6.2-1.1.5-1.6.9l-2.4-1c-.2-.1-.5 0-.6.2L2.7 8.9c-.1.2-.1.5.1.6l2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6c-.2.1-.2.4-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1 .7 1.6.9l.3 2.5c.1.2.2.4.5.4h3.8c.2 0 .4-.2.5-.4l.3-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1c.2.1.5 0 .6-.2l1.9-3.3c.1-.2.1-.5-.1-.6l-2-1.6zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>',
  help: '<path d="M11 18h2v-2h-2v2zm1-16A10 10 0 1 0 22 12 10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.8-3 5h2c0-2.3 3-2.5 3-5a4 4 0 0 0-4-4z"/>',
  feedback:
    '<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 14H5.2L4 17.2V4h16v12z"/>',
  logout: '<path d="M17 7l-1.4 1.4L18.2 11H8v2h10.2l-2.6 2.6L17 17l5-5zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4V5z"/>',
  moon: '<path d="M12 3a9 9 0 1 0 9 9c0-.5-.1-1-.2-1.4a5.4 5.4 0 0 1-4.3 2.3 5.4 5.4 0 0 1-5.4-5.4c0-1.8.9-3.4 2.3-4.4A9.3 9.3 0 0 0 12 3z"/>',
  sun: '<path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M1.5 12h3M19.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
  keyboard:
    '<path d="M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v-2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>',
  trending: '<path d="M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6z"/>',
  music: '<path d="M12 3v10.6c-.6-.3-1.3-.5-2-.5-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4V7h4V3h-6z"/>',
  code: '<path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
  live: '<path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm5.7-3.7-1.4 1.4a6 6 0 0 1 0 8.6l1.4 1.4a8 8 0 0 0 0-11.4zm-11.4 0a8 8 0 0 0 0 11.4l1.4-1.4a6 6 0 0 1 0-8.6zM20 3l-1.4 1.4a11 11 0 0 1 0 15.2L20 21a13 13 0 0 0 0-18zM4 3a13 13 0 0 0 0 18l1.4-1.4a11 11 0 0 1 0-15.2z"/>',
  fire: '<path d="M13.5 1.5s.9 3.2-1.5 5.7c-2.4 2.5-4.5 4-4.5 7.8a6.5 6.5 0 0 0 13 0c0-2.5-1.2-4.3-2.5-5.7 0 1.7-1 2.8-2 2.8-1.4 0-2.5-1.7-2.5-4 0-2.3 0-4.6 0-6.6z"/>',
  kids: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM12 17.5c-2.3 0-4.3-1.5-5-3.5h10c-.7 2-2.7 3.5-5 3.5z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
  verified:
    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z"/>',
  filter: '<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>',
  trash: '<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
  upload: '<path d="M19.4 10.1A7.5 7.5 0 0 0 12 4a7.5 7.5 0 0 0-7.4 6.1A5 5 0 0 0 6 20h13a4.5 4.5 0 0 0 .4-9.9zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>',
  grid: '<path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>',
  list: '<path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>',
  eye: '<path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  sort: '<path d="M3 6h18v2H3V6zm3 5h12v2H6v-2zm3 5h6v2H9v-2z"/>',
  plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
  arrowBack: '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/>',
  keyboardCmd:
    '<path d="M4 6h16v12H4V6zm2 2v8h12V8H6z"/><path d="M8 10h3v4H8v-4zm5 0h3v4h-3v-4z" opacity=".0"/>',
  sparkle:
    '<path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9zM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/>',
  playlist: '<path d="M22 7H2v2h20V7zm-9 5H2v2h11v-2zM2 17h11v-2H2v2zM22 5v14l-6-3-6 3V5h12z"/>',
  flag: '<path d="M6 3v18h2v-7h8l1.8 2.5L20 14V3H6zm2 2h10v7.7l-2.6 3.6L12.8 12H8V5z"/>',
  volume: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.9-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z"/>',
  mute: '<path d="M4.5 3 3 4.5 7.5 9H3v6h4.5l5.5 5.5v-6.7l4.4 4.4c-.7.5-1.5.9-2.4 1.1v2.1c1.5-.3 2.8-1.1 3.8-2.1l2 2 1.5-1.5L4.5 3zM14 7.9v2.1c.7.5 1.1 1.3 1.1 2s-.4 1.5-1.1 2v2.1c1.8-.4 3.1-1.9 3.1-4.1s-1.3-3.7-3.1-4.1z"/>',
  fullscreen: '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>',
  info: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z"/>',
  location: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/>',
  calendar: '<path d="M7 2v2H4a1 1 0 0 0-1 1v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-3V2h-2v2H9V2H7zM5 9h14v10H5V9z"/>',
  pin: '<path d="M14 2v6l4 4v2H6v-2l4-4V2h4zm-1 18h-2l1-7h1l1 7h-2z"/>',
  chart: '<path d="M4 20h3v-8H4v8zm6.5 0h3V4h-3v16zM17 20h3v-12h-3v12z"/>',
  scissor:
    '<path d="M9.6 6.6a3 3 0 1 0-1.4-1.4 3 3 0 0 0 1.4 1.4zm0 10.8a3 3 0 1 0 1.4 1.4 3 3 0 0 0-1.4-1.4zM20 4l-4.1 4.1L13.3 5.6 12 4.3 8.6 7.7 7.3 6.4 5.9 7.8l6.2 6.2-6.2 6.2 1.4 1.4 6.2-6.2 6.2 6.2 1.4-1.4-6.2-6.2 4.1-4.1z"/>',
  crop: '<path d="M17 1H7a2 2 0 0 0-2 2v10h2V5h10V3h2V1zM5 17v2a2 2 0 0 0 2 2h10v-2H7v-2H5z"/>',
  subtitle:
    '<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4V6h16v12zM6 10h5v2H6v-2zm7 0h5v2h-5v-2zM6 14h8v2H6v-2z"/>',
  musicNoteSmall: '<path d="M12 3v10.6c-.6-.3-1.3-.5-2-.5-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4V7h4V3h-6z"/>',
  miniplayer:
    '<path d="M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H3V5h18v14zM10 8.5v7l6-3.5-6-3.5z"/>',
};

export type IconName = keyof typeof P & string;

export function Icon({
  name,
  size = 24,
  className,
  filled,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  const key = filled && P[`${name}Outline`] ? `${name}Outline` : name;
  return (
    <svg
      className={cx("icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: P[key] ?? P.info! }}
    />
  );
}

export function YTLogo({ compactMode = false }: { compactMode?: boolean }) {
  return (
    <span className="logo" aria-label="CollinsTube home">
      <svg viewBox="0 0 148 20" height={compactMode ? 16 : 20} role="img">
        <rect x="0" y="1" width="28" height="18" rx="5" fill="#ff0000" />
        <path d="M11 5.5v9l7.5-4.5z" fill="#fff" />
        <text
          x="32"
          y="15.5"
          fill="currentColor"
          fontFamily="SF Pro Display, Arial, sans-serif"
          fontSize="17"
          fontWeight="700"
          letterSpacing="-1.2"
        >
          CollinsTube
        </text>
        <text x="124" y="7" fill="currentColor" fontSize="7" fontFamily="SF Pro Display, Arial">
          KE
        </text>
      </svg>
    </span>
  );
}
