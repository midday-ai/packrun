/**
 * Critical Security Alert Email Template
 *
 * Matches packrun.dev website design - dark mode, Geist Mono, sharp corners.
 */

import { Button, Link, Section, Text } from "@react-email/components";
import { colors, Layout } from "../components/layout";

export interface CriticalAlertProps {
  packageName: string;
  newVersion: string;
  previousVersion?: string;
  vulnerabilitiesFixed: number;
  changelogSnippet?: string;
  unsubscribeUrl?: string;
}

export function CriticalAlert({
  packageName,
  newVersion,
  previousVersion,
  vulnerabilitiesFixed,
  changelogSnippet,
  unsubscribeUrl,
}: CriticalAlertProps) {
  const packageUrl = `https://packrun.dev/${encodeURIComponent(packageName)}`;
  const versionText = previousVersion ? `${previousVersion} → ${newVersion}` : newVersion;

  return (
    <Layout
      previewText={`Security update: ${packageName} ${newVersion} fixes ${vulnerabilitiesFixed} vulnerabilities`}
      unsubscribeUrl={unsubscribeUrl}
    >
      {/* Alert Badge */}
      <Section
        className="px-3 py-2 mb-5"
        style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}
      >
        <Text className="text-[10px] tracking-widest m-0 uppercase" style={{ color: colors.muted }}>
          SECURITY UPDATE
        </Text>
      </Section>

      {/* Package Info */}
      <Section className="mb-5">
        <Text className="text-base font-medium m-0 mb-1">
          <Link href={packageUrl} className="no-underline" style={{ color: colors.fg }}>
            {packageName}
          </Link>
        </Text>
        <Text className="text-xs m-0 font-mono" style={{ color: colors.muted }}>
          {versionText}
        </Text>
      </Section>

      {/* Vulnerability Count */}
      <Section
        className="py-2 px-3 mb-5"
        style={{
          borderLeft: `2px solid ${colors.border}`,
          backgroundColor: colors.surface,
        }}
      >
        <Text className="text-xs m-0" style={{ color: colors.muted }}>
          Fixes {vulnerabilitiesFixed} known{" "}
          {vulnerabilitiesFixed === 1 ? "vulnerability" : "vulnerabilities"}
        </Text>
      </Section>

      {/* Changelog Snippet */}
      {changelogSnippet && (
        <Section
          className="py-2 px-3 mb-5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Text
            className="text-[10px] m-0 mb-2 uppercase tracking-wider"
            style={{ color: colors.subtle }}
          >
            RELEASE NOTES
          </Text>
          <Text
            className="text-[11px] leading-4 m-0 whitespace-pre-wrap"
            style={{ color: colors.muted }}
          >
            {changelogSnippet}
          </Text>
        </Section>
      )}

      {/* CTA Button */}
      <Section className="text-center mb-5">
        <Button
          href={packageUrl}
          className="inline-block text-xs font-medium py-2 px-5 no-underline"
          style={{
            backgroundColor: colors.fg,
            color: colors.bg,
            border: `1px solid ${colors.fg}`,
          }}
        >
          View Package Details →
        </Button>
      </Section>

      {/* Recommendation */}
      <Section className="py-2 px-3" style={{ borderTop: `1px solid ${colors.border}` }}>
        <Text className="text-[11px] m-0" style={{ color: colors.subtle }}>
          We recommend updating this package as soon as possible.
        </Text>
      </Section>
    </Layout>
  );
}

// Preview props for react-email dev server
CriticalAlert.PreviewProps = {
  packageName: "lodash",
  newVersion: "4.17.21",
  previousVersion: "4.17.20",
  vulnerabilitiesFixed: 2,
  changelogSnippet:
    "## Security\n- Fixed prototype pollution vulnerability in _.set()\n- Fixed ReDoS vulnerability in _.words()",
  unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=example",
} satisfies CriticalAlertProps;

// Default export for preview
export default CriticalAlert;
