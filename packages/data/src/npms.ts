/**
 * npms.io API Client
 *
 * Fetches quality, popularity, and maintenance scores from npms.io (public API).
 */

const NPMS_API = "https://api.npms.io/v2";

/**
 * npms.io package scores
 */
export interface NpmsScores {
  quality: number;
  popularity: number;
  maintenance: number;
  final: number;
}

interface NpmsResponse {
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

/**
 * Fetch scores from npms.io
 */
export async function fetchNpmsScores(packageName: string): Promise<NpmsScores | null> {
  try {
    const response = await fetch(`${NPMS_API}/package/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "v1.run",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: NpmsResponse = await response.json();

    return {
      quality: Math.round(data.score.detail.quality * 100) / 100,
      popularity: Math.round(data.score.detail.popularity * 100) / 100,
      maintenance: Math.round(data.score.detail.maintenance * 100) / 100,
      final: Math.round(data.score.final * 100) / 100,
    };
  } catch (error) {
    console.error(`[npms.io] Error fetching scores for ${packageName}:`, error);
    return null;
  }
}

/**
 * Batch fetch scores from npms.io
 */
export async function fetchNpmsScoresBatch(
  packageNames: string[],
): Promise<Map<string, NpmsScores>> {
  const results = new Map<string, NpmsScores>();

  // npms.io supports batch requests
  try {
    const response = await fetch(`${NPMS_API}/package/mget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "v1.run",
      },
      body: JSON.stringify(packageNames),
    });

    if (!response.ok) {
      return results;
    }

    const data: Record<string, NpmsResponse> = await response.json();

    for (const [name, pkg] of Object.entries(data)) {
      if (pkg?.score) {
        results.set(name, {
          quality: Math.round(pkg.score.detail.quality * 100) / 100,
          popularity: Math.round(pkg.score.detail.popularity * 100) / 100,
          maintenance: Math.round(pkg.score.detail.maintenance * 100) / 100,
          final: Math.round(pkg.score.final * 100) / 100,
        });
      }
    }
  } catch (error) {
    console.error(`[npms.io] Error fetching batch scores:`, error);
  }

  return results;
}
