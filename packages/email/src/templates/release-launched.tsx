/**
 * Release Launched Email Template
 *
 * Sent when an upcoming release ships. Exciting, celebratory tone
 * with clear CTAs to drive traffic back to packrun.dev.
 */

import { Button, Link, Section, Text } from "@react-email/components";
import { colors, Layout } from "../components/layout";

export interface ReleaseLaunchedProps {
  releaseTitle: string;
  packageName?: string;
  releasedVersion: string;
  description?: string;
  websiteUrl?: string;
  unsubscribeUrl?: string;
}

export function ReleaseLaunched({
  releaseTitle,
  packageName,
  releasedVersion,
  description,
  websiteUrl,
  unsubscribeUrl,
}: ReleaseLaunchedProps) {
  const packageUrl = packageName
    ? `https://packrun.dev/${encodeURIComponent(packageName)}`
    : undefined;
  const releasesUrl = "https://packrun.dev/releases";

  return (
    <Layout
      previewText={`${releaseTitle} v${releasedVersion} just shipped! Check out what's new.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      {/* Celebration Badge */}
      <Section
        className="px-3 py-2 mb-5"
        style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}
      >
        <Text className="text-[10px] tracking-widest m-0 uppercase" style={{ color: colors.muted }}>
          🚀 IT'S HERE
        </Text>
      </Section>

      {/* Release Title */}
      <Section className="mb-5">
        <Text className="text-lg font-medium m-0 mb-1" style={{ color: colors.fg }}>
          {releaseTitle}
        </Text>
        <Text className="text-sm m-0 font-mono" style={{ color: colors.muted }}>
          v{releasedVersion}
          {packageName && (
            <>
              {" · "}
              <Link
                href={packageUrl}
                className="no-underline hover:underline"
                style={{ color: colors.muted }}
              >
                {packageName}
              </Link>
            </>
          )}
        </Text>
      </Section>

      {/* Description */}
      {description && (
        <Section
          className="py-3 px-3 mb-5"
          style={{
            borderLeft: `2px solid ${colors.border}`,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            className="text-xs leading-5 m-0 whitespace-pre-wrap"
            style={{ color: colors.muted }}
          >
            {description}
          </Text>
        </Section>
      )}

      {/* Primary CTA */}
      <Section className="text-center mb-4">
        <Button
          href={packageUrl || releasesUrl}
          className="inline-block text-xs font-medium py-2 px-5 no-underline"
          style={{
            backgroundColor: colors.fg,
            color: colors.bg,
            border: `1px solid ${colors.fg}`,
          }}
        >
          {packageName ? "View Package →" : "View Release →"}
        </Button>
      </Section>

      {/* Secondary Links */}
      <Section className="text-center mb-5">
        {websiteUrl && (
          <Link
            href={websiteUrl}
            className="text-xs no-underline mr-4"
            style={{ color: colors.muted }}
          >
            Read Announcement ↗
          </Link>
        )}
        <Link href={releasesUrl} className="text-xs no-underline" style={{ color: colors.muted }}>
          All Releases →
        </Link>
      </Section>

      {/* Footer Note */}
      <Section className="py-2 px-3" style={{ borderTop: `1px solid ${colors.border}` }}>
        <Text className="text-[11px] m-0" style={{ color: colors.subtle }}>
          You followed this release on packrun.dev. Get notified about more upcoming releases!
        </Text>
      </Section>
    </Layout>
  );
}

// Preview props for react-email dev server
ReleaseLaunched.PreviewProps = {
  releaseTitle: "Drizzle ORM v1.0",
  packageName: "drizzle-orm",
  releasedVersion: "1.0.0",
  description:
    "The first stable release of Drizzle ORM! Includes full type-safety, migrations, and support for PostgreSQL, MySQL, and SQLite.",
  websiteUrl: "https://orm.drizzle.team/blog/v1-release",
  unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=example",
} satisfies ReleaseLaunchedProps;

// Default export for preview
export default ReleaseLaunched;
