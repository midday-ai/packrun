"use client";

import { useEffect, useState } from "react";

export function Spinner({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  });

  return <span className={className ?? "text-muted"}>{frames[frame]}</span>;
}
