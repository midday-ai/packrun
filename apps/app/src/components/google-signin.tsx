"use client";

import { auth } from "@v1/firebase";
import { Button } from "@v1/ui/button";
import { useSignInWithGoogle } from "react-firebase-hooks/auth";

export function GoogleSignin() {
  const [signInWithGoogle, user, loading, error] = useSignInWithGoogle(auth);

  const handleSignin = () => {
    signInWithGoogle();
  };

  if (error) {
    // You can render some error UI here
    console.error(error);
  }

  if (loading) {
    return (
        <Button variant="outline" className="font-mono" disabled>
            Signing in...
        </Button>
    );
  }

  return (
    <Button onClick={handleSignin} variant="outline" className="font-mono">
      Sign in with Google
    </Button>
  );
}
