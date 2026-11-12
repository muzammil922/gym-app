import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Paginated } from '@/src/api/types';

type Fetcher<T> = (args: {
  page: number;
  pageSize: number;
  q?: string;
}) => Promise<Paginated<T>>;

export function useInfiniteList<T>(opts: {
  queryKey: unknown[];
  fetchPage: Fetcher<T>;
  pageSize?: number;
  q?: string;
  enabled?: boolean;
}) {
  const pageSize = opts.pageSize ?? 10;
  const query = useInfiniteQuery({
    queryKey: [...opts.queryKey, opts.q ?? '', pageSize],
    initialPageParam: 1,
    enabled: opts.enabled ?? true,
    queryFn: ({ pageParam }) =>
      opts.fetchPage({
        page: pageParam,
        pageSize,
        q: opts.q || undefined,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return { ...query, items, loadMore, pageSize };
}
