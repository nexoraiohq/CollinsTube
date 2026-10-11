import type { Notification } from "../types";

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", channel: "Lofi Girl", handle: "@lofigirl", text: "started a livestream: lofi hip hop radio 📚", ageDays: 0, videoId: "jfKfPfyJRdk", unread: true },
  { id: "n2", channel: "3Blue1Brown", handle: "@3blue1brown", text: "uploaded But what is the gradient?", ageDays: 2, videoId: "IHZwWFHWa-w", unread: true },
  { id: "n3", channel: "Ed Sheeran", handle: "@edsheeran", text: "uploaded Perfect", ageDays: 5, videoId: "2Vv-BfVoq4g", unread: true },
  { id: "n4", channel: "JSConf", handle: "@jsconf", text: "replied to your comment: “that's exactly right!”", ageDays: 9, unread: false },
  { id: "n5", channel: "Lofi Girl", handle: "@lofigirl", text: "uploaded synthwave radio 🌌", ageDays: 14, videoId: "4xDzrJKXOOY", unread: false },
  { id: "n6", channel: "Queen Official", handle: "@queenofficial", text: "uploaded Bohemian Rhapsody (Remastered)", ageDays: 21, videoId: "fJ9rUzIMcZQ", unread: false },
];

export const SEARCH_SUGGESTIONS = [
  "lofi hip hop radio",
  "ed sheeran perfect",
  "neural network explained",
  "bohemian rhapsody live",
  "costa rica 4k",
  "event loop javascript",
  "baby shark dance",
  "adele hello",
  "gangnam style",
  "me at the zoo",
  "study beats 1 hour",
  "grad vector calculus",
];

export const EXPLORE_LINKS = [
  { label: "Trending", to: "/feed/trending", icon: "trending" },
  { label: "Music", to: "/results?search_query=music", icon: "music" },
  { label: "Coding", to: "/results?search_query=coding", icon: "code" },
  { label: "Live", to: "/results?search_query=live", icon: "live" },
  { label: "Viral", to: "/results?search_query=viral", icon: "fire" },
  { label: "Kids", to: "/results?search_query=kids", icon: "kids" },
];

export const FOOTER_LINKS = [
  "About",
  "Press",
  "Copyright",
  "Contact us",
  "Creators",
  "Advertise",
  "Developers",
  "Terms",
  "Privacy",
  "Policy & Safety",
  "How YouTube works",
  "Test new features",
];

export const MOCK_FILTERS = [
  { label: "Upload date", options: ["Last hour", "Today", "This week", "This month", "This year"] },
  { label: "Type", options: ["Video", "Channel", "Playlist", "Movie"] },
  { label: "Duration", options: ["Under 4 minutes", "4–20 minutes", "Over 20 minutes"] },
  { label: "Sort by", options: ["Relevance", "Upload date", "View count", "Rating"] },
];
