/** Wrap TanStack refetch for RefreshControl's void return type. */
export function onRefresh(refetch: () => Promise<unknown>) {
  return () => {
    void refetch();
  };
}
