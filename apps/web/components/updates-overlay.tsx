"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  getRandomLocation,
  addPackageToStore,
  type PackageUpdate,
} from "@/components/globe-visualization";

interface Stats {
  packagesPerMinute: number;
  totalToday: number;
  recentPackages: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function UpdatesOverlay() {
  const [stats, setStats] = useState<Stats>({
    packagesPerMinute: 0,
    totalToday: 0,
    recentPackages: [],
  });
  const [connected, setConnected] = useState(false);
  const packagesLastMinuteRef = useRef<number[]>([]);

  // Add package - updates store (for globe) and stats (for overlay)
  const addPackage = useCallback((name: string) => {
    const now = Date.now();
    const location = getRandomLocation();

    packagesLastMinuteRef.current.push(now);
    packagesLastMinuteRef.current = packagesLastMinuteRef.current.filter((t) => now - t < 60000);

    const newPackage: PackageUpdate = {
      id: `${name}-${now}-${Math.random()}`,
      name,
      timestamp: now,
      lat: location.lat,
      lng: location.lng,
      opacity: 1,
    };

    // Add to global store - globe reads this via useFrame
    addPackageToStore(newPackage);

    // Update stats
    setStats((prev) => ({
      packagesPerMinute: packagesLastMinuteRef.current.length,
      totalToday: prev.totalToday + 1,
      recentPackages: [name, ...prev.recentPackages.slice(0, 9)],
    }));
  }, []);

  // SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      console.log(`[SSE] Connecting to ${API_URL}/api/updates/stream...`);

      try {
        eventSource = new EventSource(`${API_URL}/api/updates/stream`);
      } catch (e) {
        console.error("[SSE] Failed to create EventSource:", e);
        return;
      }

      eventSource.onopen = () => {
        console.log("[SSE] Connection opened");
      };

      eventSource.addEventListener("connected", () => {
        console.log("[SSE] Stream connected");
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
        console.log("[SSE] Connection lost, reconnecting...");
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

  return (
    <>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 pointer-events-none">
        <Link
          href="/"
          className="text-white hover:text-neutral-300 transition-colors pointer-events-auto"
        >
          <span className="text-lg font-bold">v1</span>
          <span className="text-neutral-500">.run</span>
        </Link>

        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"
              }`}
            />
            <span className="text-xs text-neutral-500">{connected ? "LIVE" : "CONNECTING..."}</span>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-xs text-neutral-600 uppercase tracking-wider">PACKAGES / MIN</div>
            <div className="text-4xl font-bold text-white tabular-nums">
              {stats.packagesPerMinute}
            </div>
          </div>

          <div className="text-right pointer-events-auto">
            <div className="text-xs text-neutral-600 uppercase tracking-wider mb-2">RECENT</div>
            <div className="space-y-0.5">
              {stats.recentPackages.slice(0, 5).map((name, i) => (
                <Link
                  key={`${name}-${i}`}
                  href={`/${encodeURIComponent(name)}`}
                  className="block text-xs text-neutral-500 hover:text-white truncate max-w-[200px] transition-colors"
                  style={{ opacity: 1 - i * 0.15 }}
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-xs text-neutral-700">
          Drag to rotate · Scroll to zoom · Click package to view
        </p>
      </div>
    </>
  );
}
