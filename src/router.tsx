import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid background refetch flashes on remount/navigation.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Let TanStack Query manage cache freshness (required when integrating with Query).
    defaultPreloadStaleTime: 0,
  });

  // Wraps the router to dehydrate Query state on the server and hydrate it on
  // the client, preventing the "content → skeleton → content" flash caused by
  // an empty client cache after SSR.
  return routerWithQueryClient(router, queryClient);
};
