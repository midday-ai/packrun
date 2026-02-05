"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { CommandSearchProvider } from "@/components/command-search";
import { MCPToast } from "@/components/mcp-toast";
import { Scanlines } from "@/components/scanlines";
import { SignInModalProvider } from "@/components/sign-in-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/orpc/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={0}>
          <SignInModalProvider>
            <Scanlines />
            <CommandSearchProvider>{children}</CommandSearchProvider>
            <MCPToast />
          </SignInModalProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
