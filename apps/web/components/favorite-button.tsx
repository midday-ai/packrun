"use client";

import { useSession, signIn } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const PENDING_FAVORITE_KEY = "packrun.dev:pending-favorite";

interface FavoriteButtonProps {
  packageName: string;
}

async function checkFavorite(packageName: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/favorites/check/${encodeURIComponent(packageName)}`, {
    credentials: "include",
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.isFavorite;
}

async function addFavorite(packageName: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(packageName)}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to add favorite");
}

async function removeFavorite(packageName: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(packageName)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

export function FavoriteButton({ packageName }: FavoriteButtonProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();

  // Check if this package is favorited
  const { data: isFavorite = false } = useQuery({
    queryKey: ["favorite", packageName],
    queryFn: () => checkFavorite(packageName),
    enabled: !!session?.user,
  });

  // Add favorite mutation
  const addMutation = useMutation({
    mutationFn: () => addFavorite(packageName),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["favorite", packageName] });
      const previous = queryClient.getQueryData(["favorite", packageName]);
      queryClient.setQueryData(["favorite", packageName], true);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["favorite", packageName], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite", packageName] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Remove favorite mutation
  const removeMutation = useMutation({
    mutationFn: () => removeFavorite(packageName),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["favorite", packageName] });
      const previous = queryClient.getQueryData(["favorite", packageName]);
      queryClient.setQueryData(["favorite", packageName], false);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["favorite", packageName], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite", packageName] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Auto-favorite after login - check localStorage for pending favorite
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user) return;
    if (addMutation.isPending || addMutation.isSuccess) return;

    const pendingFavorite = localStorage.getItem(PENDING_FAVORITE_KEY);

    if (pendingFavorite === packageName) {
      localStorage.removeItem(PENDING_FAVORITE_KEY);
      addMutation.mutate();
    }
  }, [session?.user, packageName, addMutation]);

  const isPending = addMutation.isPending || removeMutation.isPending;

  // Show loading state while session loads
  if (sessionPending) {
    return <span className="text-xl text-faint">☆</span>;
  }

  // Not logged in - show star that prompts sign in
  if (!session?.user) {
    const handleSignIn = () => {
      localStorage.setItem(PENDING_FAVORITE_KEY, packageName);
      signIn.social({ provider: "github", callbackURL: window.location.href });
    };

    return (
      <button
        onClick={handleSignIn}
        className="text-xl text-faint hover:text-subtle transition-colors"
        title="Sign in to save favorites"
      >
        ☆
      </button>
    );
  }

  const handleToggle = () => {
    if (isFavorite) {
      removeMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xl transition-colors ${
        isFavorite ? "text-yellow-500 hover:text-yellow-400" : "text-subtle hover:text-foreground"
      }`}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}
