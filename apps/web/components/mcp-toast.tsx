"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "packrun.dev:mcp-toast-dismissed";
const CURSOR_DEEPLINK =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=packrun&config=eyJ1cmwiOiJodHRwczovL2FwaS5wYWNrcnVuLmRldi9tY3AifQ==";

const MESSAGE =
  "Give your AI agent fast, accurate npm packages — vulnerabilities, and health signals.";

export function MCPToast() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [glitchClass, setGlitchClass] = useState("");
  const [isGlitchingIn, setIsGlitchingIn] = useState(true);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      // Glitch-in animation lasts ~400ms
      setTimeout(() => setIsGlitchingIn(false), 400);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Random shake after glitch-in completes
  useEffect(() => {
    if (!visible || isGlitchingIn) return;

    const spikeInterval = setInterval(() => {
      if (Math.random() < 0.12) {
        setGlitchClass("glitch-shake");
        setTimeout(() => setGlitchClass(""), 80);
      }
    }, 700);

    return () => clearInterval(spikeInterval);
  }, [visible, isGlitchingIn]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!mounted || !visible) return null;

  return (
    <div className={`font-mono crt-toast ${isGlitchingIn ? "glitch-in" : ""} ${glitchClass}`}>
      <style jsx global>{`
        /* CRT Toast container - Dark mode */
        html.dark .crt-toast {
          --crt-color: #a3a3a3;
          --crt-color-dim: #737373;
          --crt-color-glow: rgba(163, 163, 163, 0.4);
          --crt-bg: #0a0a0a;
        }
        
        /* CRT Toast container - Light mode */
        html.light .crt-toast {
          --crt-color: #3a3a3a;
          --crt-color-dim: #6b6b6b;
          --crt-color-glow: rgba(58, 58, 58, 0.25);
          --crt-bg: #f5f0e6;
        }
        
        /* Glitch-in animation */
        @keyframes glitchIn {
          0% {
            opacity: 0;
            transform: translate(0, 0);
            clip-path: inset(0 0 100% 0);
          }
          10% {
            opacity: 1;
            clip-path: inset(40% 0 40% 0);
            transform: translate(-5px, 0);
          }
          15% {
            clip-path: inset(80% 0 5% 0);
            transform: translate(5px, 0);
          }
          20% {
            clip-path: inset(10% 0 70% 0);
            transform: translate(-3px, 0);
          }
          25% {
            clip-path: inset(60% 0 20% 0);
            transform: translate(3px, 0);
          }
          30% {
            clip-path: inset(30% 0 50% 0);
            transform: translate(-2px, 0);
          }
          35% {
            clip-path: inset(70% 0 10% 0);
            transform: translate(2px, 0);
          }
          40% {
            clip-path: inset(20% 0 60% 0);
            transform: translate(-1px, 0);
          }
          50% {
            clip-path: inset(0 0 0 0);
            transform: translate(0, 0);
          }
          55% {
            clip-path: inset(50% 0 30% 0);
            transform: translate(2px, 0);
          }
          60% {
            clip-path: inset(0 0 0 0);
            transform: translate(0, 0);
          }
          100% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
            transform: translate(0, 0);
          }
        }
        
        @keyframes rgbSplit {
          0%, 100% {
            text-shadow: 
              0 0 2px var(--crt-color),
              0 0 6px var(--crt-color-glow);
          }
          10% {
            text-shadow: 
              -2px 0 var(--crt-color-glow),
              2px 0 var(--crt-color-glow),
              0 0 6px var(--crt-color-glow);
          }
          20% {
            text-shadow: 
              1px 0 var(--crt-color-glow),
              -1px 0 var(--crt-color-glow),
              0 0 6px var(--crt-color-glow);
          }
          30% {
            text-shadow: 
              -1px 0 var(--crt-color-glow),
              1px 0 var(--crt-color-glow),
              0 0 6px var(--crt-color-glow);
          }
          50% {
            text-shadow: 
              0 0 2px var(--crt-color),
              0 0 6px var(--crt-color-glow);
          }
        }
        
        .glitch-in {
          animation: glitchIn 0.4s steps(1) forwards;
        }
        
        .glitch-in .crt-text,
        .glitch-in .crt-text-dim {
          animation: rgbSplit 0.4s steps(1) forwards;
        }
        
        /* Subtle shake after glitch-in */
        @keyframes microShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-0.3px, 0.2px); }
          50% { transform: translate(0.3px, -0.2px); }
          75% { transform: translate(-0.2px, -0.3px); }
        }
        
        .crt-toast:not(.glitch-in) {
          animation: microShake 0.15s steps(2) infinite;
        }
        
        .crt-toast:hover {
          animation: none !important;
        }
        
        /* Hard shake */
        @keyframes hardShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-1.5px, 0.5px); }
          50% { transform: translate(1.5px, -0.5px); }
          75% { transform: translate(-1px, -0.5px); }
        }
        
        .glitch-shake:not(.glitch-in) {
          animation: hardShake 0.08s linear !important;
        }
        
        .crt-toast:hover.glitch-shake {
          animation: none !important;
        }
        
        /* CRT screen effect */
        .crt-toast-screen {
          background: var(--crt-bg);
          border: 1px solid var(--crt-color-dim);
          position: relative;
          overflow: hidden;
        }
        
        html.dark .crt-toast-screen {
          box-shadow: 
            0 0 10px rgba(163, 163, 163, 0.1),
            inset 0 0 30px rgba(0, 0, 0, 0.5);
        }
        
        html.light .crt-toast-screen {
          box-shadow: 
            0 0 10px rgba(58, 58, 58, 0.12),
            inset 0 0 30px rgba(0, 0, 0, 0.08),
            0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        /* Scanlines */
        html.dark .crt-toast-screen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 6px,
            rgba(0, 0, 0, 0.15) 6px,
            rgba(0, 0, 0, 0.15) 7px
          );
          pointer-events: none;
          z-index: 10;
        }
        
        html.light .crt-toast-screen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 6px,
            rgba(0, 0, 0, 0.05) 6px,
            rgba(0, 0, 0, 0.05) 7px
          );
          pointer-events: none;
          z-index: 10;
        }
        
        /* Screen glow/vignette */
        html.dark .crt-toast-screen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0, 0, 0, 0.4) 100%
          );
          pointer-events: none;
          z-index: 11;
        }
        
        html.light .crt-toast-screen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0, 0, 0, 0.15) 100%
          );
          pointer-events: none;
          z-index: 11;
        }
        
        /* Phosphor text glow */
        .crt-text {
          color: var(--crt-color);
          text-shadow: 
            0 0 2px var(--crt-color),
            0 0 6px var(--crt-color-glow);
        }
        
        .crt-text-dim {
          color: var(--crt-color-dim);
        }
        
        html.dark .crt-text-dim {
          text-shadow: 0 0 4px rgba(163, 163, 163, 0.2);
        }
        
        html.light .crt-text-dim {
          text-shadow: 0 0 1px rgba(58, 58, 58, 0.2);
        }
        
        /* Moving scanline */
        @keyframes scanline {
          0% { top: -5%; }
          100% { top: 105%; }
        }
        
        .crt-scanline {
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          animation: scanline 3s linear infinite;
          pointer-events: none;
          z-index: 5;
        }
        
        html.dark .crt-scanline {
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
        }
        
        html.light .crt-scanline {
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 0, 0, 0.06),
            transparent
          );
        }
        
        /* Button styles */
        .crt-button {
          background: transparent;
          border: 1px solid var(--crt-color-dim);
          color: var(--crt-color);
          text-shadow: 0 0 4px var(--crt-color-glow);
          transition: all 0.15s;
        }
        
        html.dark .crt-button:hover {
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 8px rgba(163, 163, 163, 0.2);
        }
        
        html.light .crt-button:hover {
          background: rgba(0, 0, 0, 0.06);
          box-shadow: 0 0 8px rgba(58, 58, 58, 0.2);
          border-color: var(--crt-color);
        }
      `}</style>

      <div className="crt-toast-screen p-4 max-w-[340px]">
        {/* Moving scanline */}
        <div className="crt-scanline" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative z-20">
          <span className="text-xs crt-text-dim tracking-wide">packrun.dev/mcp</span>
          <button
            onClick={handleDismiss}
            className="crt-text-dim hover:crt-text transition-colors text-sm leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="relative z-20 mb-4">
          <p className="text-xs crt-text font-light leading-relaxed">{MESSAGE}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 relative z-20">
          <Link
            href={CURSOR_DEEPLINK}
            onClick={handleDismiss}
            className="crt-button inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 130 145"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="currentColor"
                d="M 60.66 0.00 L 64.42 0.00 C 82.67 10.62 100.99 21.12 119.25 31.72 C 121.24 33.01 123.54 34.18 124.72 36.34 C 125.34 39.17 125.06 42.10 125.11 44.98 C 125.07 63.63 125.08 82.28 125.11 100.93 C 125.07 102.84 125.14 104.79 124.73 106.68 C 123.53 108.54 121.50 109.62 119.68 110.77 C 104.03 119.72 88.45 128.80 72.85 137.83 C 69.53 139.68 66.36 141.91 62.74 143.17 C 60.51 142.85 58.57 141.57 56.62 140.54 C 40.81 131.22 24.82 122.22 9.00 112.92 C 5.85 111.16 2.79 109.23 0.00 106.93 L 0.00 36.10 C 3.83 32.32 8.81 30.12 13.34 27.33 C 29.10 18.19 44.82 8.98 60.66 0.00 M 5.62 38.04 C 8.28 40.64 11.88 41.83 14.96 43.80 C 30.60 53.06 46.50 61.89 62.05 71.30 C 62.86 75.82 62.50 80.43 62.55 85.00 C 62.57 100.64 62.51 116.29 62.54 131.93 C 62.54 133.69 62.72 135.44 63.01 137.17 C 64.18 135.60 65.29 133.98 66.24 132.27 C 83.07 103.08 99.93 73.92 116.65 44.67 C 117.89 42.62 118.84 40.42 119.57 38.14 C 113.41 37.65 107.23 37.91 101.06 37.87 C 73.71 37.85 46.35 37.85 18.99 37.87 C 14.54 38.02 10.07 37.53 5.62 38.04 Z"
              />
            </svg>
            INSTALL
          </Link>
          <Link
            href="/mcp"
            onClick={handleDismiss}
            className="text-xs crt-text-dim hover:crt-text transition-colors"
          >
            [INFO]
          </Link>
        </div>
      </div>
    </div>
  );
}
