import type { Kind, Mood, Resonance, ResponseMode, Visibility } from '../../shared/constants';

export type Person = { handle: string; name: string; avatar: string | null };

export type Me = Person & { id: string; email: string; bio: string; role: string; joinedAt: string };

export type RoomRef = { slug: string; name: string; color: string };

export type Post = {
  id: number;
  status: 'draft' | 'published';
  kind: Kind;
  title: string;
  body: string;
  truncated: boolean;
  sealed: boolean;
  unlockAt: string | null;
  mood: Mood | null;
  visibility: Visibility;
  anonymous: boolean;
  contentWarning: string | null;
  responseMode: ResponseMode;
  allowContinuation: boolean;
  continues: { id: number; title: string | null; author: string | null } | null;
  promptDay: string | null;
  cover: string | null;
  coverKey?: string | null;
  wordCount: number;
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: Person | null;
  room: RoomRef | null;
  counts: { comments: number; resonance: number; continuations: number };
  reactions: Partial<Record<Resonance, number>>;
  myReactions: Resonance[];
  bookmarked: boolean;
  mine: boolean;
};

export type Comment = {
  id: number;
  parentId: number | null;
  body: string;
  deleted: boolean;
  thanked: boolean;
  createdAt: string;
  editedAt: string | null;
  byAuthor: boolean;
  mine: boolean;
  author: Person | null;
};

export type Room = RoomRef & {
  description: string;
  guidelines: string[];
  official: boolean;
  createdAt: string;
  joined: boolean;
  stats: { members: number; newMembers: number; postsWeek: number; posts: number };
};

export type Profile = Person & {
  bio: string;
  joinedAt: string;
  followers: number;
  following: number;
  followed: boolean;
  followsYou: boolean;
  blocked: boolean;
  self: boolean;
  stats: { posts: number; words: number; streak?: number };
};

export type CalendarDay = { day: string; posts: number; words: number };

export type Overview = {
  rooms: RoomRef[];
  counts: { unread: number; drafts: number; saved: number; journal: number };
  streak: number;
  wroteToday: boolean;
  wordsWeek: number;
  recentDays: CalendarDay[];
};

export type Prompt = { day: string; text: string; index: number; responses?: number; answered?: boolean };

export type Notification = {
  id: number;
  type: 'reaction' | 'comment' | 'reply' | 'follow' | 'continuation' | 'capsule' | 'thanks';
  detail: string | null;
  read: boolean;
  createdAt: string;
  actor: Person | null;
  post: { id: number; title: string; kind: Kind; excerpt: string } | null;
  comment: { id: number; excerpt: string } | null;
};
