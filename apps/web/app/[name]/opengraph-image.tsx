import { ImageResponse } from "next/og";

export const alt = "v1.run - npm package";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Load Geist Mono font from unpkg CDN (TTF format required by Satori)
const geistMonoRegular = fetch(
  "https://unpkg.com/geist@1.3.1/dist/fonts/geist-mono/GeistMono-Regular.ttf",
).then((res) => res.arrayBuffer());

const geistMonoBold = fetch(
  "https://unpkg.com/geist@1.3.1/dist/fonts/geist-mono/GeistMono-Bold.ttf",
).then((res) => res.arrayBuffer());

interface Props {
  params: Promise<{ name: string }>;
}

// Helper to format downloads
function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Helper to get health grade color
function getHealthColor(grade: string): string {
  const colors: Record<string, string> = {
    A: "#0fff50",
    B: "#39ff14",
    C: "#dfff00",
    D: "#ff6700",
    F: "#ff003c",
  };
  return colors[grade] || "#888";
}

export default async function OGImage({ params }: Props) {
  const [fontRegular, fontBold] = await Promise.all([geistMonoRegular, geistMonoBold]);

  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  // Fetch package data from v1.run API for richer stats
  let packageName = decodedName;
  let version = "";
  let description = "";
  let downloads = "";
  let downloadsCount = 0;
  let healthScore = 0;
  let healthGrade = "";
  let license = "";
  let stars = 0;
  let vulnerabilities = 0;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.v1.run";

  try {
    // Try to fetch from v1.run API first for richer data
    const healthRes = await fetch(`${apiUrl}/api/package/${encodeURIComponent(decodedName)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (healthRes.ok) {
      const healthData = await healthRes.json();
      packageName = healthData.name || decodedName;
      version = healthData.version || "";
      description = healthData.description || "";
      healthScore = healthData.health?.score || 0;
      healthGrade = healthData.health?.grade || "";
      downloadsCount = healthData.popularity?.weeklyDownloads || 0;
      downloads = downloadsCount > 0 ? formatDownloads(downloadsCount) : "";
      license = healthData.security?.license?.spdx || "";
      stars = healthData.popularity?.stars || 0;
      vulnerabilities = healthData.security?.vulnerabilities?.total || 0;
    } else {
      // Fallback to npm registry
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(decodedName)}`, {
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        const latestVersion = data["dist-tags"]?.latest;
        if (latestVersion) {
          const versionData = data.versions?.[latestVersion];
          packageName = versionData?.name || decodedName;
          version = latestVersion;
          description = versionData?.description || "";
          license = typeof versionData?.license === "string" ? versionData.license : "";
        }
      }

      // Fetch downloads
      const downloadsRes = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(decodedName)}`,
      );
      if (downloadsRes.ok) {
        const downloadsData = await downloadsRes.json();
        downloadsCount = downloadsData.downloads || 0;
        downloads = downloadsCount > 0 ? formatDownloads(downloadsCount) : "";
      }
    }
  } catch {
    // Use defaults if fetch fails
  }

  // Ensure packageName is always a string
  const packageNameDisplay = packageName || decodedName || "package";

  // Truncate description if too long
  const maxDescLength = 120;
  const truncatedDesc =
    description && description.length > maxDescLength
      ? `${description.slice(0, maxDescLength)}...`
      : description || "";

  // Build stats as individual variables to avoid .map() iteration issues
  const stat1: { label: string; value: string; color: string } | null =
    healthGrade && typeof healthGrade === "string" && healthGrade.length > 0
      ? { label: "Health", value: String(healthGrade), color: getHealthColor(healthGrade) }
      : null;

  const stat2: { label: string; value: string; color: string } | null =
    version && typeof version === "string" && version.length > 0
      ? { label: "Version", value: `v${String(version)}`, color: "#888" }
      : null;

  const stat3: { label: string; value: string; color: string } | null =
    downloads && typeof downloads === "string" && downloads.length > 0
      ? { label: "Downloads", value: `${String(downloads)}/week`, color: "#888" }
      : null;

  const stat4: { label: string; value: string; color: string } | null =
    stars && typeof stars === "number" && stars > 0
      ? { label: "Stars", value: formatDownloads(stars), color: "#888" }
      : vulnerabilities && typeof vulnerabilities === "number" && vulnerabilities > 0
        ? { label: "Vulns", value: String(vulnerabilities), color: "#ff003c" }
        : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#050505",
        fontFamily: "Geist Mono",
        padding: 32,
        position: "relative",
      }}
    >
      {/* Scanlines overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "linear-gradient(transparent 50%, rgba(255, 255, 255, 0.04) 50%)",
          backgroundSize: "100% 2px",
        }}
      />

      {/* Content container */}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          position: "relative",
          paddingBottom: 40,
        }}
      >
        {/* Top bar with logo left, domain right */}
        <div
          style={{
            display: "flex",
            height: 64,
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 32,
            paddingRight: 32,
          }}
        >
          {/* Logo on left */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="64" height="45" viewBox="0 0 129 91" fill="none">
              <path
                d="M4.99974 21.1816H15.0906V51.4543H4.99974V21.1816ZM45.3634 21.1816H55.4543V51.4543H45.3634V21.1816ZM25.1816 71.6361H15.0906V51.4543H25.1816V71.6361ZM25.1816 71.6361H35.2725V81.7271H25.1816V71.6361ZM35.2725 51.4543H45.3634V71.6361H35.2725V51.4543ZM93.6373 21.1816H73.4555V11.0907H93.6373V0.999776H103.728V71.6361H123.91V81.7271H73.4555V71.6361H93.6373V21.1816Z"
                fill="white"
              />
            </svg>
          </div>
          {/* Domain on right */}
          <div style={{ display: "flex", color: "#666", fontSize: 32 }}>v1.run</div>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          {/* Package name */}
          <div
            style={{
              display: "flex",
              fontSize:
                packageNameDisplay.length > 30 ? 56 : packageNameDisplay.length > 20 ? 72 : 88,
              fontWeight: 700,
              color: "#fff",
              textAlign: "center",
            }}
          >
            {packageNameDisplay}
          </div>

          {/* Description */}
          {truncatedDesc.length > 0 ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: "#888",
                maxWidth: 900,
                textAlign: "center",
                marginTop: 24,
                lineHeight: 1.5
              }}
            >
              {truncatedDesc}
            </div>
          ) : null}
        </div>

        {/* Bottom stats bar */}
        <div
          style={{
            display: "flex",
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          {/* Stats cells */}
          {stat1 !== null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 20,
                paddingLeft: 32,
                paddingRight: 32,
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#555", letterSpacing: 1 }}>
                {stat1.label.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 700,
                  color: stat1.color,
                  marginTop: 4,
                }}
              >
                {stat1.value}
              </div>
            </div>
          ) : null}
          {stat2 !== null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 20,
                paddingLeft: 32,
                paddingRight: 32,
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#555", letterSpacing: 1 }}>
                {stat2.label.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                {stat2.value}
              </div>
            </div>
          ) : null}
          {stat3 !== null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 20,
                paddingLeft: 32,
                paddingRight: 32,
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#555", letterSpacing: 1 }}>
                {stat3.label.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#fff",
                  marginTop: 4,
                }}
              >
                {stat3.value}
              </div>
            </div>
          ) : null}
          {stat4 !== null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 20,
                paddingLeft: 32,
                paddingRight: 32,
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#555", letterSpacing: 1 }}>
                {stat4.label.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 600,
                  color: stat4.color,
                  marginTop: 4,
                }}
              >
                {stat4.value}
              </div>
            </div>
          ) : null}
          {/* Spacer */}
          <div style={{ display: "flex", flex: 1 }} />
          {/* URL on right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: 20,
              paddingLeft: 32,
              paddingRight: 32,
              color: "#444",
              fontSize: 24,
            }}
          >
            {`v1.run/${packageNameDisplay}`}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist Mono",
          data: fontRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Geist Mono",
          data: fontBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
