"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSignInModal } from "@/components/sign-in-modal";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

export interface Release {
  id: string;
  packageName: string | null;
  title: string;
  description: string | null;
  targetVersion: string;
  status: string;
  logoUrl: string | null;
  expectedDate: string | null;
  followerCount?: number;
}

interface ReleaseCardProps {
  release: Release;
  showFollowButton?: boolean;
}

export function ReleaseCard({ release, showFollowButton = true }: ReleaseCardProps) {
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
      queryClient.invalidateQueries({
        queryKey: orpc.releases.list.queryOptions({ input: {} }).queryKey,
      });
    },
  });

  const unfollowMutation = useMutation({
    ...orpc.releases.unfollow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.releases.list.queryOptions({ input: {} }).queryKey,
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
    <div className="border border-border p-4 hover:border-subtle transition-colors flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {release.logoUrl && (
          // Using img instead of next/image - logo URLs are external and domains can't be preconfigured
          <img src={release.logoUrl} alt="" className="w-8 h-8 rounded shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-foreground truncate">{release.title}</h3>
          <div className="text-xs text-subtle">v{release.targetVersion}</div>
        </div>
      </div>

      {/* Package link */}
      {release.packageName && (
        <Link
          href={`/${encodeURIComponent(release.packageName)}`}
          className="text-xs text-muted hover:text-foreground transition-colors mb-2"
        >
          {release.packageName}
        </Link>
      )}

      {/* Description */}
      {release.description && (
        <p className="text-xs text-muted line-clamp-2 flex-1">{release.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="text-[10px] text-subtle">
          {release.expectedDate && (
            <span>{new Date(release.expectedDate).toLocaleDateString()}</span>
          )}
          {release.followerCount !== undefined && release.followerCount > 0 && (
            <span className="ml-2">{release.followerCount} following</span>
          )}
        </div>

        {showFollowButton && (
          <button
            onClick={handleFollowClick}
            disabled={isPending}
            className={`text-xs px-2.5 py-1 border transition-colors ${
              isFollowing
                ? "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
                : "border-border text-subtle hover:text-foreground hover:border-foreground"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>
    </div>
  );
}
