import type { Video } from "../types";

/**
 * Unified client-side search index: titles, descriptions, hashtags, tags,
 * categories and channels — with multi-token AND matching (OR fallback) and
 * field-weighted relevance scoring.
 */

export type SearchToken = { raw: string; term: string; tag: boolean };

export const parseTokens = (q: string): SearchToken[] =>
  q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => (raw.startsWith("#") ? { raw, term: raw.slice(1), tag: true } : { raw, term: raw, tag: false }));

/** Every #hashtag mentioned in a description or tag list, lowercased without the #. */
export const hashtagsOf = (v: Video): string[] => {
  const fromDesc = v.description.match(/#[a-z0-9_]+/gi)?.map((h) => h.slice(1).toLowerCase()) ?? [];
  return [...new Set([...v.tags.map((t) => t.toLowerCase()), ...fromDesc])];
};

const haystackOf = (v: Video): string =>
  `${v.title} ${v.description} ${v.tags.join(" ")} ${v.category} ${v.channel} ${v.handle}`.toLowerCase();

const scoreVideo = (v: Video, q: string, tokens: SearchToken[], hay: string): number => {
  const title = v.title.toLowerCase();
  const desc = v.description.toLowerCase();
  const tags = hashtagsOf(v);
  let s = 0;

  if (q && title.includes(q)) s += 50;
  if (v.handle.toLowerCase() === q || v.channel.toLowerCase() === q) s += 30;

  for (const t of tokens) {
    if (title.includes(t.term)) s += 8;
    if (tags.includes(t.term)) s += t.tag ? 10 : 6;
    if (v.category.toLowerCase() === t.term) s += 5;
    if (v.channel.toLowerCase().includes(t.term) || v.handle.toLowerCase().includes(t.term)) s += 5;
    if (desc.includes(t.term)) s += 3;
    if (v.tags.some((tag) => tag.toLowerCase().includes(t.term))) s += 2;
    if (!hay.includes(t.term)) s -= 100; // token not present anywhere → disqualify
  }

  // Relevance tiebreakers: popularity, then freshness.
  s += Math.min(6, Math.log10(Math.max(1, v.views)) - 5);
  s += Math.max(0, 3 - v.ageDays / 1500);
  return s;
};

export function searchVideos(list: Video[], q: string): Video[] {
  const query = q.trim().toLowerCase();
  const tokens = parseTokens(query);
  if (!tokens.length) return list;

  const scored = list
    .map((v) => {
      const hay = haystackOf(v);
      // AND semantics: every token must appear somewhere; OR fallback below.
      const allHit = tokens.every((t) => hay.includes(t.term));
      if (!allHit) return null;
      const s = scoreVideo(v, query, tokens, hay);
      return s > 0 ? { v, s } : null;
    })
    .filter((x): x is { v: Video; s: number } => x !== null);

  if (!scored.length) {
    // OR fallback keeps the results page useful for partial/loose queries.
    return list
      .map((v) => {
        const hay = haystackOf(v);
        if (!tokens.some((t) => hay.includes(t.term))) return null;
        return { v, s: scoreVideo(v, query, tokens, hay) };
      })
      .filter((x): x is { v: Video; s: number } => x !== null)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.v);
  }

  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.v);
}

/** Distinct tags across the catalog, most common first — used for # suggestions. */
export const allTags = (list: Video[]): { tag: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const v of list) for (const t of hashtagsOf(v)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
};

export type Suggestion = { text: string; kind: "history" | "title" | "channel" | "tag" | "category" };

export function suggestFor(list: Video[], history: string[], q: string, limit = 8): Suggestion[] {
  const term = q.trim().toLowerCase();
  if (!term) return history.slice(0, limit).map((text) => ({ text, kind: "history" as const }));

  const out: Suggestion[] = [];
  const push = (text: string, kind: Suggestion["kind"]) => {
    if (text && !out.some((s) => s.text.toLowerCase() === text.toLowerCase())) out.push({ text, kind });
  };

  history.filter((s) => s.toLowerCase().includes(term)).forEach((s) => push(s, "history"));
  if (!term.startsWith("#")) {
    allTags(list)
      .filter((t) => t.tag.includes(term.replace(/^#/, "")))
      .slice(0, 3)
      .forEach((t) => push(`#${t.tag}`, "tag"));
  } else {
    allTags(list)
      .filter((t) => t.tag.includes(term.slice(1)))
      .slice(0, 5)
      .forEach((t) => push(`#${t.tag}`, "tag"));
  }
  list.filter((v) => v.title.toLowerCase().includes(term)).slice(0, 3).forEach((v) => push(v.title.toLowerCase(), "title"));
  list.filter((v) => v.channel.toLowerCase().includes(term)).slice(0, 2).forEach((v) => push(v.channel, "channel"));
  list.filter((v) => v.category.toLowerCase().includes(term)).slice(0, 1).forEach((v) => push(v.category.toLowerCase(), "category"));

  return out.slice(0, limit);
}
