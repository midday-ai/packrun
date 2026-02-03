/**
 * Cache Invalidation
 *
 * Purges Cloudflare edge cache and revalidates Next.js ISR pages
 * when packages are updated via npm changes.
 */

const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API_DOMAIN = process.env.API_DOMAIN || "https://api.v1.run";
const WEB_REVALIDATE_URL = process.env.WEB_REVALIDATE_URL;
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

// Log missing config once at startup
const cfConfigured = Boolean(CF_ZONE_ID && CF_API_TOKEN);
const isrConfigured = Boolean(WEB_REVALIDATE_URL && REVALIDATE_SECRET);

if (!cfConfigured) {
  console.log("[Cache] Cloudflare credentials not configured, cache purge disabled");
}
if (!isrConfigured) {
  console.log("[Cache] ISR revalidation not configured, ISR disabled");
}

/**
 * Purge all API cache entries for a package from Cloudflare edge
 */
export async function purgeCloudflareCache(packageName: string): Promise<boolean> {
  if (!cfConfigured) {
    return false;
  }

  const encodedName = encodeURIComponent(packageName);
  const urls = [
    `${API_DOMAIN}/api/package/${encodedName}`,
    `${API_DOMAIN}/api/package/${encodedName}/version`,
    `${API_DOMAIN}/api/package/${encodedName}/vulnerabilities`,
    `${API_DOMAIN}/api/package/${encodedName}/alternatives`,
    `${API_DOMAIN}/api/package/${encodedName}/deprecated`,
    `${API_DOMAIN}/api/package/${encodedName}/types`,
  ];

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: urls }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Cache] Cloudflare purge failed for ${packageName}: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Cache] Cloudflare purge error for ${packageName}:`, error);
    return false;
  }
}

/**
 * Revalidate ISR pages for a package in Next.js
 */
export async function revalidateISR(packageName: string): Promise<boolean> {
  if (!isrConfigured) {
    return false;
  }

  try {
    const response = await fetch(WEB_REVALIDATE_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        packageName,
        secret: REVALIDATE_SECRET,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Cache] ISR revalidation failed for ${packageName}: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Cache] ISR revalidation error for ${packageName}:`, error);
    return false;
  }
}

/**
 * Invalidate all caches for a package (Cloudflare + ISR)
 */
export async function invalidatePackageCache(packageName: string): Promise<void> {
  const [cfResult, isrResult] = await Promise.all([
    purgeCloudflareCache(packageName),
    revalidateISR(packageName),
  ]);

  if (cfResult || isrResult) {
    console.log(
      `[Cache] Invalidated ${packageName} - CF: ${cfResult ? "✓" : "✗"}, ISR: ${isrResult ? "✓" : "✗"}`,
    );
  }
}
