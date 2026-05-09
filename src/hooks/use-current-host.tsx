import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MyHost = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: "host" | "checker" | string;
};

const STORAGE_KEY = "gather:current-host-id";

export function useMyHosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-hosts-with-role", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyHost[]> => {
      const { data, error } = await supabase
        .from("host_members")
        .select("role, hosts:host_id ( id, name, slug, logo_url )")
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as Array<{ role: string; hosts: MyHost | null }>)
        .filter((r) => r.hosts)
        .map((r) => ({ ...(r.hosts as MyHost), role: r.role }));
    },
  });
}

export function useCurrentHost() {
  const { data: hosts, isLoading } = useMyHosts();
  const [hostId, setHostIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (!hosts || hosts.length === 0) return;
    if (!hostId || !hosts.some((h) => h.id === hostId)) {
      const next = hosts[0].id;
      setHostIdState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
    }
  }, [hosts, hostId]);

  const current = useMemo(
    () => (hosts ?? []).find((h) => h.id === hostId) ?? null,
    [hosts, hostId],
  );

  const setHostId = (id: string) => {
    setHostIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  };

  return { hosts: hosts ?? [], current, hostId, setHostId, isLoading };
}
