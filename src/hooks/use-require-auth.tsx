import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (!loading && !user) {
      const redirect_to = location.pathname + location.searchStr;
      navigate({
        to: "/sign-in",
        search: { redirect_to },
        replace: true,
      });
    }
  }, [loading, user, navigate, location.pathname, location.searchStr]);

  return { user, loading };
}
