# CollinsTube TV — desktop launcher

Zero-budget desktop wrapper: **no Electron, no paid tools, no installs.**
It opens the *real* YouTube leanback ("TV") interface top-level in a TV-shaped
Chrome or Edge window.

## Usage

- Double-click `collinstube-tv.cmd`
- or run `powershell -NoProfile -ExecutionPolicy Bypass -file collinstube-tv.ps1`

To point the launcher at a local build instead of youtube.com/tv:

```powershell
$env:COLLINSTUBE_URL = 'http://localhost:5173'
.\desktop\collinstube-tv.ps1
```

> Use port **5173** (Vite dev) or a preview bound to it — the built-in YouTube
> API key is referrer-locked to that origin, so live content loads there.

## How it works

- Finds an existing Chrome/Edge installation (free).
- Launches it with `--app=<url>` (chromeless window), a 1280x720 window, and a
  Smart-TV `User-Agent` string, using a dedicated profile in `desktop/tv-profile`
  so it never touches your normal browser profile.

## Honest limitations

- **Ad-free playback is NOT provided.** This launcher only changes the
  window/UA. YouTube's own advertising is server-side and applies here too.
  The in-app SponsorBlock auto-skip (Watch page) skips *community-marked*
  sponsor segments in the CollinsTube player — it is not an ad blocker.
- Direct (non-iframe) playback inside the *CollinsTube web app itself* is not
  possible: YouTube's Data API grants no stream URLs, and cross-origin
  embedding restrictions apply. The leanback page loaded top-level in this
  window IS the real YouTube player — that is the "direct viewing" path.
- TizenTube-style ad/branding removal (in-page monkey-patching of youtube.com)
  is **out of scope here**: TizenTube is GPL-3.0 and targets Samsung/Tizen
  runtimes via CDP injection; we study the technique but do not copy code.
