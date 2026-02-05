"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

// =============================================================================
// Components
// =============================================================================

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <span className="text-[#ff003c] text-[8px]" title="Critical">
        ▪
      </span>
    );
  }
  if (severity === "important") {
    return (
      <span className="text-[#ff6700] text-[8px]" title="Important">
        ▪
      </span>
    );
  }
  return (
    <span className="text-muted text-[8px]" title="Update">
      ▪
    </span>
  );
}

interface NotificationItemProps {
  notification: {
    id: string;
    packageName: string;
    newVersion: string;
    previousVersion?: string | null;
    severity: string;
    isSecurityUpdate: boolean;
    isBreakingChange: boolean;
    changelogSnippet?: string | null;
    vulnerabilitiesFixed?: number | null;
    read: boolean;
    createdAt: string;
  };
  onRead: () => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <DropdownMenuItem asChild className="cursor-pointer px-3 py-2" onClick={onRead}>
      <Link href={`/${encodeURIComponent(notification.packageName)}`} className="block w-full">
        <div className="flex items-start gap-2">
          <SeverityIcon severity={notification.severity} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs truncate">{notification.packageName}</span>
              <span className="text-[10px] text-muted shrink-0">
                {notification.previousVersion ? (
                  <>
                    {notification.previousVersion} → {notification.newVersion}
                  </>
                ) : (
                  notification.newVersion
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {notification.isSecurityUpdate && (
                <span className="text-[10px] text-muted">security</span>
              )}
              {notification.isBreakingChange && (
                <span className="text-[10px] text-muted">breaking</span>
              )}
              <span className="text-[10px] text-muted">{timeAgo}</span>
            </div>
          </div>
        </div>
      </Link>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread count (poll every 30 seconds)
  const { data: unreadCount } = useQuery({
    ...orpc.notifications.unreadCount.queryOptions(),
    enabled: !!session?.user,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch recent notifications when dropdown opens
  const { data: notificationsData, isLoading } = useQuery({
    ...orpc.notifications.list.queryOptions({ input: { limit: 10 } }),
    enabled: !!session?.user && isOpen,
    staleTime: 10000,
  });
  const notifications = notificationsData?.notifications;

  // Mutation: mark single notification as read
  const markReadMutation = useMutation({
    ...orpc.notifications.markAsRead.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.notifications.list.queryOptions({ input: { limit: 10 } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.notifications.unreadCount.queryOptions().queryKey,
      });
    },
  });

  // Mutation: mark all as read
  const markAllReadMutation = useMutation({
    ...orpc.notifications.markAllAsRead.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.notifications.list.queryOptions({ input: { limit: 10 } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.notifications.unreadCount.queryOptions().queryKey,
      });
    },
  });

  // Don't render while session is loading
  if (sessionPending) {
    return null;
  }

  // Don't render if not logged in
  if (!session?.user) {
    return null;
  }

  const totalUnread = unreadCount?.total || 0;
  const hasCritical = (unreadCount?.critical || 0) > 0;

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative focus:outline-none text-subtle hover:text-foreground transition-colors"
          aria-label={`Notifications${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
        >
          {/* Bell icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>

          {/* Badge */}
          {totalUnread > 0 && (
            <span
              className={`absolute -top-0.5 -right-1 text-[6px] ${
                hasCritical ? "text-[#ff003c]" : "text-muted"
              }`}
            >
              ▪
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[400px] overflow-y-auto bg-background border-border"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium">Notifications</span>
          {totalUnread > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                markAllReadMutation.mutate({});
              }}
              className="text-[10px] text-muted hover:text-foreground transition-colors"
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        {isLoading ? (
          <div className="px-3 py-4 text-center text-xs text-muted">Loading...</div>
        ) : !notifications?.length ? (
          <div className="px-3 py-4 text-center text-xs text-muted">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={() => {
                if (!notification.read) {
                  markReadMutation.mutate({ id: notification.id });
                }
              }}
            />
          ))
        )}

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          asChild
          className="text-xs text-center justify-center text-muted hover:text-foreground cursor-pointer"
        >
          <Link href="/profile?tab=notifications">View all & settings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
