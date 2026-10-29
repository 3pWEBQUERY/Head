import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, qs } from '../api';
import type { Me, Overview, Post, Prompt, Room } from '../types';

export function useMe() {
  const q = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: Me | null }>('/api/auth/me').then((r) => r.user),
    staleTime: 5 * 60_000,
  });
  return { me: q.data ?? null, loading: q.isLoading };
}

export function useOverview(enabled: boolean) {
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => api<Overview>('/api/me/overview'),
    enabled,
    staleTime: 30_000,
  });
}

export function useUnread(enabled: boolean) {
  return useQuery({
    queryKey: ['unread'],
    queryFn: () => api<{ unread: number }>('/api/notifications/unread').then((r) => r.unread),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useRooms() {
  return useQuery({ queryKey: ['rooms'], queryFn: () => api<{ rooms: Room[] }>('/api/rooms').then((r) => r.rooms), staleTime: 60_000 });
}

export function usePromptToday() {
  return useQuery({ queryKey: ['prompt', 'today'], queryFn: () => api<{ prompt: Prompt }>('/api/prompts/today').then((r) => r.prompt), staleTime: 5 * 60_000 });
}

export type FeedParams = {
  scope?: 'home' | 'all';
  sort?: 'lesenswert' | 'neu' | 'leise';
  room?: string;
  author?: string;
  prompt?: string;
  kind?: string;
  q?: string;
  saved?: boolean;
  journal?: boolean;
  continues?: number;
};

export function useFeed(params: FeedParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['feed', params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<{ posts: Post[]; hasMore: boolean }>(`/api/posts${qs({ ...params, offset: pageParam, limit: 20 })}`),
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * 20 : undefined),
    enabled,
  });
}

/** Ändert einen Beitrag in allen Caches (Feeds und Einzelansicht). */
export function patchPost(qc: QueryClient, id: number, fn: (p: Post) => Post) {
  qc.setQueriesData<any>({ queryKey: ['feed'] }, (data: any) => {
    if (!data?.pages) return data;
    return { ...data, pages: data.pages.map((pg: any) => ({ ...pg, posts: pg.posts.map((p: Post) => (p.id === id ? fn(p) : p)) })) };
  });
  qc.setQueryData<any>(['post', id], (d: any) => (d ? { ...d, post: fn(d.post) } : d));
}

export function usePostActions() {
  const qc = useQueryClient();
  const react = useMutation({
    mutationFn: ({ post, kind }: { post: Post; kind: string }) =>
      api(`/api/posts/${post.id}/reactions/${kind}`, { method: post.myReactions.includes(kind as any) ? 'DELETE' : 'PUT' }),
    onMutate: ({ post, kind }) => {
      const on = !post.myReactions.includes(kind as any);
      patchPost(qc, post.id, (p) => {
        const reactions = { ...p.reactions, [kind]: Math.max(0, (p.reactions[kind as keyof typeof p.reactions] ?? 0) + (on ? 1 : -1)) };
        if (!reactions[kind as keyof typeof reactions]) delete reactions[kind as keyof typeof reactions];
        return {
          ...p,
          reactions,
          myReactions: on ? [...p.myReactions, kind as any] : p.myReactions.filter((k) => k !== kind),
          counts: { ...p.counts, resonance: p.counts.resonance + (on ? 1 : -1) },
        };
      });
      return { post };
    },
    onError: (_e, _v, ctx) => ctx && patchPost(qc, ctx.post.id, () => ctx.post),
  });
  const bookmark = useMutation({
    mutationFn: (post: Post) => api(`/api/posts/${post.id}/bookmark`, { method: post.bookmarked ? 'DELETE' : 'PUT' }),
    onMutate: (post) => {
      patchPost(qc, post.id, (p) => ({ ...p, bookmarked: !post.bookmarked }));
      return { post };
    },
    onError: (_e, _v, ctx) => ctx && patchPost(qc, ctx.post.id, () => ctx.post),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['feed', { saved: true }] });
    },
  });
  return { react, bookmark };
}
