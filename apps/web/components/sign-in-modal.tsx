"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signIn } from "@/lib/auth-client";

// GitHub icon
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

interface SignInModalContextValue {
  open: boolean;
  openSignIn: (callbackAction?: string) => void;
  closeSignIn: () => void;
}

const SignInModalContext = createContext<SignInModalContextValue | null>(null);

export function useSignInModal() {
  const context = useContext(SignInModalContext);
  if (!context) {
    throw new Error("useSignInModal must be used within SignInModalProvider");
  }
  return context;
}

interface SignInModalProviderProps {
  children: React.ReactNode;
}

export function SignInModalProvider({ children }: SignInModalProviderProps) {
  const [open, setOpen] = useState(false);
  const [callbackAction, setCallbackAction] = useState<string | undefined>();

  const openSignIn = useCallback((action?: string) => {
    setCallbackAction(action);
    setOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setOpen(false);
    setCallbackAction(undefined);
  }, []);

  const handleSignIn = (provider: "github" | "google") => {
    // Store callback action if provided
    if (callbackAction) {
      localStorage.setItem("packrun.dev:pending-action", callbackAction);
    }
    signIn.social({ provider, callbackURL: window.location.href });
  };

  return (
    <SignInModalContext.Provider value={{ open, openSignIn, closeSignIn }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[340px] sm:w-[380px] border-border bg-background font-mono">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-sm font-bold text-foreground text-center">
              Sign in to continue
            </DialogTitle>
            <DialogDescription className="text-xs text-muted text-center">
              Follow packages, track releases, and get notified about updates
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-3">
            <button
              onClick={() => handleSignIn("github")}
              className="flex items-center justify-center gap-2.5 w-full px-3 py-2.5 border border-border text-foreground hover:bg-surface hover:border-subtle transition-colors"
            >
              <GitHubIcon className="w-4 h-4" />
              <span className="text-xs">Continue with GitHub</span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] text-faint text-center leading-relaxed">
              By signing in, you agree to our{" "}
              <a href="/terms" className="text-muted hover:text-foreground transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-muted hover:text-foreground transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </SignInModalContext.Provider>
  );
}
