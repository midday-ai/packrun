/**
 * Preview script to test OG image generation for a package
 * Run with: bun run apps/web/app/[name]/og-preview.tsx react
 */

import { ImageResponse } from "next/og";

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

async function generateOGImage(packageName: string) {
  const decodedName = packageName;

  // Fetch package data from packrun.dev API for richer stats
  let packageNameDisplay = decodedName;
  let version = "";
  let description = "";
  let downloads = "";
  let downloadsCount = 0;
  let healthScore = 0;
  let healthGrade = "";
  let license = "";
  let stars = 0;
  let vulnerabilities = 0;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.packrun.dev";

  try {
    // Try to fetch from packrun.dev API first for richer data
    const healthRes = await fetch(`${apiUrl}/api/package/${encodeURIComponent(decodedName)}`, {
      headers: { Accept: "application/json" },
    });

    if (healthRes.ok) {
      const healthData = await healthRes.json();
      packageNameDisplay = healthData.name || decodedName;
      version = healthData.version || "";
      description = healthData.description || "";
      healthScore = healthData.health?.score || 0;
      healthGrade = healthData.health?.grade || "";
      downloadsCount = healthData.popularity?.weeklyDownloads || 0;
      downloads = downloadsCount > 0 ? formatDownloads(downloadsCount) : "";
      license = healthData.security?.license?.spdx || "";
      stars = healthData.popularity?.stars || 0;
      vulnerabilities = healthData.security?.vulnerabilities?.total || 0;

      console.log("📦 Package Data:");
      console.log(`  Name: ${packageNameDisplay}`);
      console.log(`  Version: ${version}`);
      console.log(`  Health: ${healthGrade} (${healthScore})`);
      console.log(`  Downloads: ${downloads}/week`);
      console.log(`  Stars: ${stars}`);
      console.log(`  Vulnerabilities: ${vulnerabilities}`);
      console.log(`  Description: ${description.substring(0, 100)}...`);
    } else {
      console.log("⚠️  API fetch failed, using fallback");
    }
  } catch (error) {
    console.error("❌ Error fetching data:", error);
  }

  // Truncate description if too long
  const maxDescLength = 120;
  const truncatedDesc =
    description.length > maxDescLength ? `${description.slice(0, maxDescLength)}...` : description;

  // Build stats array
  const statsItems = [];
  if (healthGrade) {
    statsItems.push({ label: "Health", value: healthGrade, color: getHealthColor(healthGrade) });
  }
  if (version) {
    statsItems.push({ label: "Version", value: `v${version}`, color: "#888" });
  }
  if (downloads) {
    statsItems.push({ label: "Downloads", value: `${downloads}/week`, color: "#888" });
  }
  if (stars > 0) {
    statsItems.push({ label: "Stars", value: formatDownloads(stars), color: "#888" });
  }
  if (vulnerabilities > 0) {
    statsItems.push({
      label: "Vulns",
      value: vulnerabilities.toString(),
      color: vulnerabilities > 0 ? "#ff003c" : "#888",
    });
  }

  console.log("\n🎨 OG Image Stats:");
  statsItems.forEach((stat) => {
    console.log(`  ${stat.label}: ${stat.value} (${stat.color})`);
  });

  return {
    packageName: packageNameDisplay,
    stats: statsItems,
    description: truncatedDesc,
  };
}

// Run if called directly
if (import.meta.main) {
  const packageName = process.argv[2] || "react";
  console.log(`\n🔍 Generating OG image preview for: ${packageName}\n`);
  generateOGImage(packageName)
    .then((data) => {
      console.log("\n✅ Preview data:");
      console.log(JSON.stringify(data, null, 2));
      console.log(`\n🌐 View at: http://localhost:3000/${packageName}`);
      console.log(`📸 OG Image: http://localhost:3000/${packageName}/opengraph-image`);
    })
    .catch(console.error);
}
