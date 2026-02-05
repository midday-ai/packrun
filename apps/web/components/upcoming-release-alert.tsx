"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSignInModal } from "@/components/sign-in-modal";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

interface Release {
  id: string;
  title: string;
  targetVersion: string;
  packageName: string | null;
}

interface UpcomingReleaseAlertProps {
  release: Release;
}

export function UpcomingReleaseAlert({ release }: UpcomingReleaseAlertProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { openSignIn } = useSignInModal();

  const { data: followData } = useQuery({
    ...orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }),
    enabled: !!session?.user,
  });
  const isFollowing = followData?.isFollowing ?? false;

  const followMutation = useMutation({
    ...orpc.releases.follow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }).queryKey,
      });
    },
  });

  const unfollowMutation = useMutation({
    ...orpc.releases.unfollow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }).queryKey,
      });
    },
  });

  const handleFollowClick = () => {
    if (!session?.user) {
      openSignIn(`follow-release:${release.id}`);
      return;
    }

    if (isFollowing) {
      unfollowMutation.mutate({ id: release.id });
    } else {
      followMutation.mutate({ id: release.id });
    }
  };

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <div className="border border-border bg-surface p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-foreground shrink-0">
          <span className="text-[#ff6700]">▪</span>
          upcoming
        </span>
        <Link
          href="/releases/upcoming"
          className="text-sm text-muted hover:text-foreground transition-colors truncate"
        >
          {release.title}
          <span className="text-subtle ml-2">v{release.targetVersion}</span>
        </Link>
      </div>
      <button
        onClick={handleFollowClick}
        disabled={isPending}
        className={`text-xs px-2.5 py-1 border transition-colors shrink-0 ${
          isFollowing
            ? "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
            : "border-border text-subtle hover:text-foreground hover:border-foreground"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
