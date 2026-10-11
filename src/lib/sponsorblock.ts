/**
 * SponsorBlock — free, public, keyless API (sponsor.ajay.app).
 * Fetches sponsor/skip segments for a video; the Watch player auto-skips them.
 * 404 = no segments for this video (normal). Failures degrade silently.
 */

export type SkipSegment = { start: number; end: number; category: string };

const CATEGORIES = ["sponsor", "selfpromo", "interaction", "intro", "outro", "music_offtopic"];

export async function fetchSkipSegments(videoId: string): Promise<SkipSegment[]> {
  const url =
    `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}` +
    `&categories=${encodeURIComponent(JSON.stringify(CATEGORIES))}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return [];
    if (!res.ok) return [];
    const data = (await res.json()) as { segment?: [number, number]; category?: string }[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((s) => Array.isArray(s.segment) && s.segment.length === 2)
      .map((s) => ({ start: s.segment![0], end: s.segment![1], category: s.category ?? "sponsor" }));
  } catch {
    return [];
  }
}
