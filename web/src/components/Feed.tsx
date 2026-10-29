import { useEffect, useRef, type ReactNode } from 'react';
import { useFeed, type FeedParams } from '../lib/queries';
import { Empty, Skeletons } from './bits';
import { PostItem } from './PostItem';

export function Feed({ params, empty, showRoom = true, enabled = true }: { params: FeedParams; empty?: ReactNode; showRoom?: boolean; enabled?: boolean }) {
  const q = useFeed(params, enabled);
  const sentinel = useRef<HTMLDivElement>(null);
  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !q.hasNextPage) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  if (q.isLoading) return <Skeletons n={4} />;
  if (q.isError) return <Empty title="Konnte nicht geladen werden">{(q.error as Error).message}</Empty>;
  if (!posts.length) return <>{empty ?? <Empty title="Hier ist es noch still">Sei die erste Stimme.</Empty>}</>;

  return (
    <div role="feed" aria-busy={q.isFetching}>
      {posts.map((p) => <PostItem key={p.id} post={p} showRoom={showRoom} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <Skeletons n={1} />}
    </div>
  );
}
