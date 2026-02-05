"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { signOut, useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

// =============================================================================
// Toggle Component
// =============================================================================

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-foreground" : "bg-surface"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// =============================================================================
// Notification Preferences Section
// =============================================================================

function NotificationPreferencesSection() {
  const queryClient = useQueryClient();

  const { data: preferencesData, isLoading: prefsLoading } = useQuery({
    ...orpc.notifications.getPreferences.queryOptions(),
  });
  const preferences = preferencesData?.preferences;

  const updatePrefsMutation = useMutation({
    ...orpc.notifications.updatePreferences.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.notifications.getPreferences.queryOptions().queryKey,
      });
    },
  });

  if (prefsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* What to notify about */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          What to notify
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">All updates</span>
            <Toggle
              checked={preferences?.notifyAllUpdates ?? false}
              onChange={(checked) => updatePrefsMutation.mutate({ notifyAllUpdates: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Major versions only</span>
            <Toggle
              checked={preferences?.notifyMajorOnly ?? true}
              onChange={(checked) => updatePrefsMutation.mutate({ notifyMajorOnly: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Security updates only</span>
            <Toggle
              checked={preferences?.notifySecurityOnly ?? true}
              onChange={(checked) => updatePrefsMutation.mutate({ notifySecurityOnly: checked })}
            />
          </div>
        </div>
      </div>

      {/* In-app notifications */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          In-app notifications
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show notification bell</span>
          <Toggle
            checked={preferences?.inAppEnabled ?? true}
            onChange={(checked) => updatePrefsMutation.mutate({ inAppEnabled: checked })}
          />
        </div>
      </div>

      {/* Email notifications */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          Email notifications
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Immediate alerts for security updates</span>
            <Toggle
              checked={preferences?.emailImmediateCritical ?? true}
              onChange={(checked) =>
                updatePrefsMutation.mutate({ emailImmediateCritical: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Email digest</span>
            <Toggle
              checked={preferences?.emailDigestEnabled ?? false}
              onChange={(checked) => updatePrefsMutation.mutate({ emailDigestEnabled: checked })}
            />
          </div>
          {preferences?.emailDigestEnabled && (
            <div className="ml-4 flex items-center justify-between">
              <span className="text-sm">Frequency</span>
              <select
                value={preferences.emailDigestFrequency || "daily"}
                onChange={(e) =>
                  updatePrefsMutation.mutate({
                    emailDigestFrequency: e.target.value as "daily" | "weekly",
                  })
                }
                className="bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Profile Page
// =============================================================================

function ProfileContent() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">("profile");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "notifications") {
      setActiveTab("notifications");
    }
  }, [searchParams]);

  // Fetch followed packages
  const { data: followingData, isLoading: followingLoading } = useQuery({
    ...orpc.following.list.queryOptions(),
    enabled: !!session?.user,
  });
  const following = followingData?.following ?? [];

  // Unfollow mutation
  const unfollowMutation = useMutation({
    ...orpc.following.unfollow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.following.list.queryOptions().queryKey,
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    ...orpc.following.deleteAccount.mutationOptions(),
    onSuccess: () => {
      signOut();
    },
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 bg-surface/50 animate-pulse" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted">You need to be signed in to view your profile.</p>
        <Link href="/" className="text-sm text-subtle hover:text-foreground transition-colors">
          Go home
        </Link>
      </div>
    );
  }

  const handleDeleteAccount = () => {
    if (deleteConfirmText === "delete my account") {
      deleteAccountMutation.mutate({});
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      <Header />

      <div className="container-page py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">Profile</h1>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-2 text-sm transition-colors ${
              activeTab === "profile"
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-2 text-sm transition-colors ${
              activeTab === "notifications"
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Notifications
          </button>
        </div>

        {activeTab === "profile" ? (
          <>
            {/* User Info */}
            <section className="border border-border p-6 mb-6">
              <div className="flex items-center gap-4">
                {session.user.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={64}
                    height={64}
                    className="border border-border"
                    unoptimized
                    loading="eager"
                  />
                )}
                <div>
                  <p className="font-medium">{session.user.name}</p>
                  <p className="text-sm text-muted">{session.user.email}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-subtle">Connected via GitHub</p>
              </div>
            </section>

            {/* Following */}
            <section className="border border-border p-6 mb-6">
              <h2 className="text-sm font-medium mb-4">Following</h2>
              {followingLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-surface/50 animate-pulse" />
                  ))}
                </div>
              ) : following.length === 0 ? (
                <p className="text-sm text-muted">
                  Not following any packages yet. Browse packages and click Follow to get notified
                  about updates.
                </p>
              ) : (
                <ul className="space-y-2">
                  {following.map((pkg) => (
                    <li key={pkg} className="flex items-center justify-between group">
                      <Link
                        href={`/${encodeURIComponent(pkg)}`}
                        className="text-sm text-muted hover:text-foreground transition-colors"
                      >
                        {pkg}
                      </Link>
                      <button
                        onClick={() => unfollowMutation.mutate({ name: pkg })}
                        disabled={unfollowMutation.isPending}
                        className="text-xs text-subtle hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        unfollow
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Account Settings */}
            <section className="border border-border p-6">
              <h2 className="text-sm font-medium mb-4">Account</h2>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-subtle hover:text-red-500 transition-colors"
                >
                  Delete account
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    This will permanently delete your account and all your data. This action cannot
                    be undone.
                  </p>
                  <div>
                    <label htmlFor="delete-confirm" className="text-xs text-subtle block mb-2">
                      Type "delete my account" to confirm:
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                      placeholder="delete my account"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={
                        deleteConfirmText !== "delete my account" || deleteAccountMutation.isPending
                      }
                      className="text-xs px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleteAccountMutation.isPending ? "Deleting..." : "Delete my account"}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                      className="text-xs text-subtle hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="border border-border p-6">
            <h2 className="text-sm font-medium mb-6">Notification Settings</h2>
            <NotificationPreferencesSection />
          </section>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 bg-surface/50 animate-pulse" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
