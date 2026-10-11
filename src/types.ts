export type Video = {
  id: string;
  title: string;
  channel: string;
  handle: string;
  verified?: boolean;
  views: number;
  ageDays: number;
  duration: number;
  description: string;
  tags: string[];
  category: string;
  likes: number;
  live?: boolean;
  scheduled?: boolean;
  imported?: boolean;
  avatar?: string;
};

export type Channel = {
  handle: string;
  name: string;
  subscribers: number;
  videos: number;
  description: string;
  joined: string;
  location: string;
  totalViews: number;
  bannerFrom: string;
  bannerTo: string;
  avatar?: string;
  banner?: string;
  links?: { label: string; url: string }[];
};

export type Comment = {
  id: string;
  author: string;
  handle: string;
  text: string;
  likes: number;
  ageDays: number;
  replies?: number;
  pinned?: boolean;
  hearted?: boolean;
};

export type Upload = {
  id: string;
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  progress: number;
  createdAt: number;
  thumbnailColor: [string, string];
  duration: number;
  tags: string;
};

export type Notification = {
  id: string;
  channel: string;
  handle: string;
  text: string;
  ageDays: number;
  videoId?: string;
  unread: boolean;
};

export type Toast = {
  id: number;
  message: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
};

export type Theme = "dark" | "light";
