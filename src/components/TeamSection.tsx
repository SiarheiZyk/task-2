import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Trash2, UserPlus, Users } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Member = {
  id: string;
  user_id: string;
  role: "host" | "checker" | string;
  profiles: { name: string | null; avatar_url: string | null } | null;
};

export function TeamSection({
  hostId,
  isOwner,
}: {
  hostId: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"host" | "checker">("checker");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["host-members", hostId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("host_members")
        .select("id, user_id, role, profiles:user_id ( name, avatar_url )")
        .eq("host_id", hostId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });

  const hostCount = (members ?? []).filter((m) => m.role === "host").length;

  const handleRemove = async (m: Member) => {
    if (m.user_id === user?.id) return toast.error("You can't remove yourself");
    if (m.role === "host" && hostCount <= 1)
      return toast.error("Can't remove the last host");
    const { error } = await supabase.from("host_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["host-members", hostId] });
  };

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({ host_id: hostId, role, created_by: user.id })
      .select("token")
      .single();
    setGenerating(false);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const url = `${window.location.origin}/invite/${data.token}`;
    setInviteUrl(url);
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copied");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Team</h2>
        </div>
        {isOwner && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setInviteUrl(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Invite by link
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
              </DialogHeader>
              {!inviteUrl ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select value={role} onValueChange={(v) => setRole(v as "host" | "checker")}>
                      <SelectTrigger className="mt-2 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="host">Host — full control</SelectItem>
                        <SelectItem value="checker">Checker — check-in only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Anyone with the link can join as {role}. The link expires in 7 days.
                  </p>
                  <DialogFooter>
                    <Button onClick={handleGenerate} disabled={generating} className="rounded-xl">
                      <Link2 className="mr-1.5 h-4 w-4" />
                      Generate link
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share this link. It expires{" "}
                    {format(new Date(Date.now() + 7 * 86400_000), "MMM d, yyyy")}.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={inviteUrl} className="rounded-xl font-mono text-xs" />
                    <Button onClick={handleCopy} size="icon" variant="outline" className="rounded-xl">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="m-5 h-24 rounded-xl" />
      ) : (
        <ul className="divide-y divide-border/60">
          {(members ?? []).map((m) => {
            const isSelf = m.user_id === user?.id;
            const isLastHost = m.role === "host" && hostCount <= 1;
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="inline-block h-8 w-8 overflow-hidden rounded-full bg-muted">
                  {m.profiles?.avatar_url ? (
                    <img
                      src={m.profiles.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="block h-full w-full"
                      style={{ background: "var(--gradient-primary)" }}
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.profiles?.name ?? "Unknown"}
                    {isSelf && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                  {m.role}
                </Badge>
                {isOwner && !isSelf && !isLastHost && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
