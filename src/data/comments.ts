import type { Comment } from "../types";
import { hash } from "../lib/format";

const AUTHORS: { name: string; handle: string }[] = [
  { name: "Maya Okafor", handle: "@mayaokafor" },
  { name: "Dev Patel", handle: "@devpatel" },
  { name: "Sofia Rossi", handle: "@sofiarossi" },
  { name: "Kenji Tanaka", handle: "@kenjitanaka" },
  { name: "Amara Ndlovu", handle: "@amarandlovu" },
  { name: "Lucas Moreau", handle: "@lucasmoreau" },
  { name: "Priya Raman", handle: "@priyaraman" },
  { name: "Tom Whitfield", handle: "@tomwhitfield" },
  { name: "Elena Volkova", handle: "@elenavolkova" },
  { name: "Diego Herrera", handle: "@diegoherrera" },
  { name: "Aisha Bello", handle: "@aishabello" },
  { name: "Noah Lindqvist", handle: "@noahlindqvist" },
  { name: "Chloe Bennett", handle: "@chloebennett" },
  { name: "Ravi Krishnan", handle: "@ravikrishnan" },
  { name: "Fatima Zahra", handle: "@fatimazahra" },
  { name: "Oliver Hughes", handle: "@oliverhughes" },
];

const POSITIVE = [
  "Came for the thumbnail, stayed for the whole thing. Instant subscribe.",
  "The pacing in this is unreal — no wasted seconds anywhere.",
  "I've watched this three times today and I'll probably go for four.",
  "Whoever edited this deserves a raise. The transitions are so clean.",
  "This showed up in my recommendations at exactly the right moment.",
  "The way the sound design builds in the second half is chefs kiss.",
  "Sharing this with everyone I know. It's that good.",
  "Algorithm, thank you for once. More like this please.",
  "I put this on while working and ended up just… watching instead.",
  "The comments are almost as entertaining as the video lol.",
  "Ten years later and this still holds up perfectly.",
  "Underrated. The view count should be ten times what it is.",
  "This is the kind of content I subscribed for.",
  "Rewatched with headphones and it's a completely different experience.",
  "Small channel, huge quality. Keep going, you're onto something.",
  "My evening is now officially this video and a cup of tea.",
  "The detail at 1:12 — nobody talks about that enough.",
  "I sent this to my group chat and now we're all obsessed.",
  "Honestly one of the best things I've seen on here this year.",
  "The confidence to just start with that scene. Brilliant.",
];

const QUESTION = [
  "What's the track playing in the background? It's been stuck in my head all day.",
  "Anyone else watching this way too late at night? No? Just me?",
  "Could you do a part two? I'd genuinely watch an hour of this.",
  "What gear are you using here? The quality looks incredible.",
  "Timestamp for anyone else looking for the good part: 0:47.",
  "How long did this take to put together? The effort really shows.",
];

const CREATOR_REPLY = [
  "Thanks so much — a part two is definitely in the works!",
  "Appreciate it! Gear list is pinned in the description.",
  "Ha, glad you caught that detail. It's my favourite bit too.",
  "Reading every single comment on this one. You're all legends.",
];

export function commentsFor(videoId: string): Comment[] {
  const h = hash(videoId);
  const count = 6 + (h % 5);
  const out: Comment[] = [];
  for (let i = 0; i < count; i++) {
    const a = AUTHORS[(h + i * 7) % AUTHORS.length]!;
    const seed = hash(videoId + i);
    const textPool = seed % 4 === 0 ? QUESTION : POSITIVE;
    const text = textPool[seed % textPool.length]!;
    out.push({
      id: `${videoId}-c${i}`,
      author: a.name,
      handle: a.handle,
      text,
      likes: 4 + (seed % 2400),
      ageDays: seed % Math.max(2, 90),
      replies: seed % 5 === 0 ? 1 + (seed % 24) : 0,
      pinned: i === 0,
      hearted: i === 1,
    });
  }
  const creator = AUTHORS[h % AUTHORS.length]!;
  out.splice(1, 0, {
    id: `${videoId}-reply`,
    author: creator.name,
    handle: creator.handle,
    text: CREATOR_REPLY[h % CREATOR_REPLY.length]!,
    likes: 1200 + (h % 18000),
    ageDays: 1 + (h % 12),
    replies: 3 + (h % 40),
  });
  return out.sort((a, b) => a.ageDays - b.ageDays);
}
