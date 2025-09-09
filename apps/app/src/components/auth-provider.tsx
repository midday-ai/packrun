"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@v1/firebase";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icons } from "@v1/ui/icons";

const protectedRoutes = ["/"]; // Add any other protected routes here
const publicRoutes = ["/login"]; // Add any other public routes here

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, loading, error] = useAuthState(auth);
  const pathname = usePathname();
  const router = useRouter();
  const [serverSessionCreated, setServerSessionCreated] = useState(false);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    // Handle server session
    if (user && !serverSessionCreated) {
      user.getIdToken(true).then(async (idToken) => {
        await fetch("/api/auth/session-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        });
        setServerSessionCreated(true);
      });
    } else if (!user && serverSessionCreated) {
      fetch("/api/auth/session-logout", { method: "POST" });
      setServerSessionCreated(false);
    }

    // Handle client-side routing
    const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (!user && isProtectedRoute) {
      router.push("/login");
    }

    if (user && isPublicRoute) {
      router.push("/");
    }
  }, [user, loading, error, pathname, router, serverSessionCreated]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Icons.Spinner className="size-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
