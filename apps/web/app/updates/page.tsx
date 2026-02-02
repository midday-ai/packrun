"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface PackageEvent {
  id: string;
  name: string;
  timestamp: number;
}

interface Stats {
  packagesPerMinute: number;
  totalSession: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const MAX_VISIBLE = 40;

export default function UpdatesPage() {
  const [packages, setPackages] = useState<PackageEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ packagesPerMinute: 0, totalSession: 0 });
  const [connected, setConnected] = useState(false);
  const packagesLastMinuteRef = useRef<number[]>([]);

  const addPackage = useCallback((name: string) => {
    const now = Date.now();

    packagesLastMinuteRef.current.push(now);
    packagesLastMinuteRef.current = packagesLastMinuteRef.current.filter((t) => now - t < 60000);

    const newPkg: PackageEvent = {
      id: `${name}-${now}-${Math.random()}`,
      name,
      timestamp: now,
    };

    setPackages((prev) => [newPkg, ...prev].slice(0, MAX_VISIBLE));
    setStats((prev) => ({
      packagesPerMinute: packagesLastMinuteRef.current.length,
      totalSession: prev.totalSession + 1,
    }));
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      eventSource = new EventSource(`${API_URL}/api/updates/stream`);

      eventSource.addEventListener("connected", () => {
        setConnected(true);
      });

      eventSource.addEventListener("package", (event) => {
        try {
          const data = JSON.parse(event.data);
          addPackage(data.name);
        } catch (e) {
          console.error("[SSE] Parse error:", e);
        }
      });

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        eventSource = null;
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [addPackage]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false });
  };

  return (
    <div className="crt-screen">
      {/* Animated scanlines */}
      <div className="scanlines" />

      {/* Screen flicker */}
      <div className="screen-flicker" />

      {/* Vignette */}
      <div className="vignette" />

      {/* Content */}
      <div className="crt-content">
        {/* Header */}
        <header className="crt-header">
          <div className="flex items-center justify-between">
            <Link href="/" className="crt-link">
              [v1.run]
            </Link>

            <div className="flex items-center gap-6 text-xs">
              <span>PKG/MIN: {stats.packagesPerMinute}</span>
              <span>TOTAL: {stats.totalSession}</span>
              <span className={connected ? "blink" : ""}>
                {connected ? "● ONLINE" : "○ CONNECTING"}
              </span>
            </div>
          </div>
        </header>

        {/* Terminal */}
        <main className="crt-terminal">
          <div className="terminal-frame">
            {/* Title bar */}
            <div className="terminal-titlebar">
              <span className="terminal-title">
                NPM LIVE FEED — STREAMING FROM REGISTRY.NPMJS.ORG
              </span>
            </div>

            {/* Content area */}
            <div className="terminal-body">
              {packages.length === 0 ? (
                <div className="terminal-line waiting">
                  &gt; WAITING FOR INCOMING PACKAGES...<span className="cursor">█</span>
                </div>
              ) : (
                packages.map((pkg, index) => (
                  <div
                    key={pkg.id}
                    className="terminal-line"
                    style={{
                      opacity: Math.max(0.25, 1 - index * 0.02),
                    }}
                  >
                    <span className="time">[{formatTime(pkg.timestamp)}]</span>
                    <span className="prompt"> &gt; </span>
                    <span className="cmd">PUBLISH </span>
                    <Link href={`/${encodeURIComponent(pkg.name)}`} className="package-name">
                      {pkg.name}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="crt-footer">
          <span>
            BUFFER: {packages.length}/{MAX_VISIBLE}
          </span>
          <span>PRESS ANY KEY TO EXIT</span>
        </footer>
      </div>

      <style jsx global>{`
        .crt-screen {
          min-height: 100vh;
          background: #0a0a0a;
          color: #ffffff;
          font-family: var(--font-mono), 'Courier New', monospace;
          position: relative;
          overflow: hidden;
        }

        /* Animated scanlines moving down */
        .scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 100;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0) 0px,
            rgba(0, 0, 0, 0) 1px,
            rgba(0, 0, 0, 0.3) 1px,
            rgba(0, 0, 0, 0.3) 2px
          );
          animation: scanlines 8s linear infinite;
        }

        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }

        /* Subtle flicker effect */
        .screen-flicker {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 99;
          background: transparent;
          animation: flicker 0.15s infinite;
        }

        @keyframes flicker {
          0% { opacity: 0.97; }
          50% { opacity: 1; }
          100% { opacity: 0.98; }
        }

        /* Vignette - darker edges */
        .vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 98;
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.6) 100%
          );
        }

        /* Content styling */
        .crt-content {
          position: relative;
          z-index: 10;
          padding: 20px 40px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          text-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
        }

        .crt-header {
          padding: 10px 0;
          border-bottom: 1px solid #333;
          flex-shrink: 0;
        }

        .crt-link {
          color: #fff;
          text-decoration: none;
        }

        .crt-link:hover {
          text-decoration: underline;
        }

        .crt-terminal {
          font-size: 14px;
          line-height: 1.6;
          letter-spacing: 0.5px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          margin-top: 20px;
        }

        .terminal-frame {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          border: 1px solid #444;
        }

        .terminal-titlebar {
          padding: 8px 16px;
          border-bottom: 1px solid #444;
          text-align: center;
          flex-shrink: 0;
        }

        .terminal-title {
          color: #666;
          font-size: 12px;
          letter-spacing: 1px;
        }

        .terminal-body {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: none;
          padding: 12px 16px;
          min-height: 0;
        }

        .terminal-body::-webkit-scrollbar {
          display: none;
        }

        .terminal-line {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 2px 0;
        }

        .terminal-line.waiting {
          color: #666;
        }

        .terminal-line .time {
          color: #555;
        }

        .terminal-line .prompt {
          color: #666;
        }

        .terminal-line .cmd {
          color: #777;
        }

        .terminal-line .package-name {
          color: #fff;
          text-decoration: none;
        }

        .terminal-line .package-name:hover {
          color: #fff;
          text-decoration: underline;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.9);
        }

        .cursor {
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .blink {
          animation: blink 1s step-end infinite;
        }

        .crt-footer {
          padding: 10px 0;
          border-top: 1px solid #333;
          display: flex;
          justify-content: space-between;
          color: #444;
          font-size: 12px;
          flex-shrink: 0;
          margin-top: auto;
        }

        /* Phosphor glow on text */
        .crt-content * {
          text-shadow: 
            0 0 1px rgba(255, 255, 255, 0.3),
            0 0 2px rgba(255, 255, 255, 0.1);
        }

        /* New line animation */
        .terminal-line:first-child {
          animation: newLine 0.3s ease-out;
        }

        @keyframes newLine {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
