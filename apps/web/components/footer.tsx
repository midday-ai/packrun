"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useCommandSearch } from "@/components/command-search";
import { useSignInModal } from "@/components/sign-in-modal";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { setOpen: openSearch } = useCommandSearch();
  const { openSignIn } = useSignInModal();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <footer className="border-t border-border pt-2">
      {/* Main Footer Content */}
      <div className="container-page py-8 md:py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 md:gap-10">
          {/* Logo Column */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
              <Image
                src="/logo.svg"
                alt="Packrun"
                width={32}
                height={22}
                className="brightness-0 dark:brightness-100"
              />
            </Link>
            <p className="text-subtle text-xs mt-3 leading-relaxed">
              MCP-first npm registry.
              <br />
              Security signals and package
              <br />
              health for AI agents.
            </p>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="label mb-3">Product</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => openSearch(true)}
                  className="text-muted text-xs hover:text-foreground transition-colors"
                >
                  Search
                </button>
              </li>
              <li>
                <Link
                  href="/mcp"
                  className="text-muted text-xs hover:text-foreground transition-colors"
                >
                  MCP Server
                </Link>
              </li>
              <li>
                <a
                  href="https://api.packrun.dev/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted text-xs hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  API
                  <span className="text-subtle">↗</span>
                </a>
              </li>
              <li>
                <Link
                  href="/updates"
                  className="text-muted text-xs hover:text-foreground transition-colors"
                >
                  Live Updates
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="label mb-3">Resources</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => openSignIn()}
                  className="text-muted text-xs hover:text-foreground transition-colors"
                >
                  Sign in
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/midday-ai/packrun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted text-xs hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  GitHub
                  <span className="text-subtle">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="label mb-3">Company</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://midday.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted text-xs hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  Midday
                  <span className="text-subtle">↗</span>
                </a>
              </li>
            </ul>

            {/* Social Icons */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://github.com/midday-ai/packrun"
                target="_blank"
                rel="noopener noreferrer"
                className="text-subtle hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <GitHubIcon />
              </a>
              <a
                href="https://x.com/middayai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-subtle hover:text-foreground transition-colors"
                aria-label="X (Twitter)"
              >
                <XIcon />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border">
        <div className="container-page py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-subtle">© {new Date().getFullYear()} packrun.dev</p>

          <div className="flex items-center gap-6">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="text-subtle hover:text-foreground transition-colors uppercase tracking-wider"
                aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? "Light" : "Dark"}
              </button>
            )}
            <span className="text-faint">·</span>
            <Link href="/terms" className="text-subtle hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-subtle hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
