# YouTube integration (CollinsTube) — zero-budget notes

## Content source

Official **YouTube Data API v3**, free tier:

| Item | Value |
| --- | --- |
| Daily quota | 10,000 units/day per project (free, no card required) |
| search.list | 100 units/call + separate ~100 queries/day search cap |
| videos.list | 1 unit |
| channels.list | 1 unit |
| playlistItems.list | 1 unit |
| mostPopular (videos.list chart) | 1 unit |

Roughly: ~9,500 cheap metadata reads/day; the search query cap (~100/day) is
the practical limit for discovery.

## Auth

- API key only (no OAuth) → **no private data**: no subscriptions sync,
  no watch history sync, no likes on YouTube's side.
- Key sources (checked in order):
  1. `state.apiKey` saved via **Settings → API key** (stored in
     `localStorage` under `ytclone.state.v1` — user's own key, their machine).
  2. Build-time env: `VITE_YT_API_KEY` (e.g. `.env.local`).
  3. None → the app falls back to the bundled offline catalog and shows an
     inline banner. All existing behavior and the 65-check smoke suite work
     keyless.
- Keys in a browser bundle are visible to anyone — restrict yours in Google
  Cloud (HTTP referrers for the web build). Never commit a key.

## CORS

All Data API calls are made client-side; Google's API sends permissive CORS
headers for key-authenticated GETs, so no proxy is needed.

## What the API does NOT give us

- **Stream URLs / direct mp4 playback** — not part of the public API. Watch
  playback therefore stays on the official IFrame/embedded player on the web.
  Direct leanback viewing is only via `desktop/` launcher (top-level
  youtube.com/tv, not our player).
- **`relatedToVideoId`** — removed in 2023. "Up next"/rail related videos are
  approximated with a relevance search over the title's key words, merged and
  de-duplicated with local-catalog recommendations.
- **Live chat, comments from YouTube** — comments remain local-demos only.

## Ad-free — honest status

- **NOT verified, NOT claimed.** The Data API and IFrame player show whatever
  YouTube decides to show, including ads.
- What *is* implemented: **SponsorBlock** (free, keyless, public API at
  sponsor.ajay.app) — community-marked sponsor/selfpromo/intro/outro segments
  are auto-skipped in the CollinsTube custom player with an `SB` badge and a
  stats line. This skips *creator sponsor plugs*, not YouTube ads.
- TizenTube research: it injects a userscript into the live youtube.com/tv
  page via Chrome DevTools Protocol (TizenBrew), monkey-patching `JSON.parse`
  to strip `adPlacements`/`adSlots`. That technique requires full page
  control (our `desktop/` launcher loads youtube.com/tv top-level, but we do
  not inject scripts — TizenTube is GPL-3.0 and we do not copy its code).

## Categories

`search.list` + `videoCategoryId` uses the numeric guide categories
(10 Music, 15 Sports, 20 Gaming, 22 People & Blogs, 24 Entertainment,
27 Education, 28 Science & Tech, …). Local chip names map through
`CATEGORY_ID_BY_NAME` in `src/lib/ytApi.ts`.

## Files

- `src/lib/ytApi.ts` — Data API client, quota/cost notes, error mapping.
- `src/lib/sponsorblock.ts` — SponsorBlock segment fetcher (silent degrade).
- `src/components/ApiSettingsModal.tsx` — key entry UI + no-key banner.
- `src/store/AppContext.tsx` — `apiKey` persisted in `ytclone.state.v1`.
