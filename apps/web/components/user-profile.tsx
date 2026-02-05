"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignInModal } from "@/components/sign-in-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";

export function UserProfile() {
  const { data: session, isPending } = useSession();
  const { openSignIn } = useSignInModal();

  if (isPending) {
    return <div className="w-6 h-6 bg-surface/50 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => openSignIn()}
        className="text-xs text-subtle hover:text-foreground transition-colors"
      >
        Sign in
      </button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || "User"}
              width={24}
              height={24}
              className="border border-border"
              unoptimized
              loading="eager"
            />
          ) : (
            <div className="w-6 h-6 bg-surface border border-border flex items-center justify-center text-xs text-muted">
              {session.user.name?.charAt(0) || "?"}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px] bg-background border-border">
        <DropdownMenuLabel className="font-normal px-2 py-1.5">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-foreground">{session.user.name}</p>
            <p className="text-[10px] text-muted truncate">{session.user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          asChild
          className="text-xs text-muted hover:text-foreground hover:bg-surface cursor-pointer"
        >
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-xs text-muted hover:text-foreground hover:bg-surface cursor-pointer"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
