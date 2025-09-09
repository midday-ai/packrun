"use client";

import { auth } from "@v1/firebase";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useSignOut } from "react-firebase-hooks/auth";

export function SignOut() {
  const [signOut, loading, error] = useSignOut(auth);

  const handleSignOut = () => {
    signOut();
  };

  if (error) {
    console.error(error);
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="font-mono gap-2 flex items-center"
      disabled={loading}
    >
      <Icons.SignOut className="size-4" />
      <span>{loading ? "Signing out..." : "Sign out"}</span>
    </Button>
  );
}
