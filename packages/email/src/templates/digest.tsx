/**
 * Daily/Weekly Digest Email Template
 *
 * Matches packrun.dev website design - dark mode, Geist Mono, sharp corners.
 */

import { Hr, Link, Section, Text } from "@react-email/components";
import { colors, Layout } from "../components/layout";

export interface DigestUpdate {
  packageName: string;
  newVersion: string;
  previousVersion?: string;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet?: string;
  vulnerabilitiesFixed?: number;
}

export interface DigestProps {
  updates: DigestUpdate[];
  period: "daily" | "weekly";
  unsubscribeUrl?: string;
}

export function Digest({ updates, period, unsubscribeUrl }: DigestProps) {
  const critical = updates.filter((u) => u.severity === "critical");
  const important = updates.filter((u) => u.severity === "important");
  const info = updates.filter((u) => u.severity === "info");

  const periodText = period === "daily" ? "today" : "this week";
  const previewText = `${updates.length} package ${updates.length === 1 ? "update" : "updates"} ${periodText}`;

  return (
    <Layout previewText={previewText} unsubscribeUrl={unsubscribeUrl}>
      {/* Header */}
      <Section className="mb-5">
        <Text
          className="text-[10px] m-0 mb-1 uppercase tracking-wider"
          style={{ color: colors.subtle }}
        >
          {period.toUpperCase()} DIGEST
        </Text>
        <Text className="text-base font-medium m-0" style={{ color: colors.fg }}>
          {updates.length} {updates.length === 1 ? "update" : "updates"} {periodText}
        </Text>
      </Section>

      {/* Critical Section */}
      {critical.length > 0 && (
        <>
          <Section className="mb-2">
            <Text
              className="text-[11px] m-0 uppercase tracking-wider"
              style={{ color: colors.muted }}
            >
              <span style={{ color: "#ff003c" }}>▪</span> SECURITY ({critical.length})
            </Text>
          </Section>
          {critical.map((update, i) => (
            <UpdateRow key={`critical-${i}`} update={update} />
          ))}
          <Hr className="my-4" style={{ borderColor: colors.border, borderTop: "1px solid" }} />
        </>
      )}

      {/* Important Section */}
      {important.length > 0 && (
        <>
          <Section className="mb-2">
            <Text
              className="text-[11px] m-0 uppercase tracking-wider"
              style={{ color: colors.muted }}
            >
              <span style={{ color: "#ff6700" }}>▪</span> BREAKING ({important.length})
            </Text>
          </Section>
          {important.map((update, i) => (
            <UpdateRow key={`important-${i}`} update={update} />
          ))}
          <Hr className="my-4" style={{ borderColor: colors.border, borderTop: "1px solid" }} />
        </>
      )}

      {/* Info Section */}
      {info.length > 0 && (
        <>
          <Section className="mb-2">
            <Text
              className="text-[11px] m-0 uppercase tracking-wider"
              style={{ color: colors.subtle }}
            >
              <span style={{ color: colors.subtle }}>▪</span> OTHER ({info.length})
            </Text>
          </Section>
          {info.map((update, i) => (
            <UpdateRow key={`info-${i}`} update={update} />
          ))}
        </>
      )}

      {/* Empty State */}
      {updates.length === 0 && (
        <Section className="text-center py-8">
          <Text className="text-xs m-0" style={{ color: colors.muted }}>
            No updates {periodText}. Your packages are up to date.
          </Text>
        </Section>
      )}
    </Layout>
  );
}

function UpdateRow({ update }: { update: DigestUpdate }) {
  const packageUrl = `https://packrun.dev/${encodeURIComponent(update.packageName)}`;
  const versionText = update.previousVersion
    ? `${update.previousVersion} → ${update.newVersion}`
    : update.newVersion;

  return (
    <Section
      className="py-2 px-3 mb-2"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
      }}
    >
      <Text className="text-xs m-0 mb-1">
        <Link href={packageUrl} className="font-medium no-underline" style={{ color: colors.fg }}>
          {update.packageName}
        </Link>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            marginLeft: "8px",
            color: colors.muted,
          }}
        >
          {versionText}
        </span>
      </Text>
      {update.vulnerabilitiesFixed && update.vulnerabilitiesFixed > 0 && (
        <Text className="text-[11px] m-0 mt-1" style={{ color: colors.muted }}>
          Fixes {update.vulnerabilitiesFixed}{" "}
          {update.vulnerabilitiesFixed === 1 ? "vulnerability" : "vulnerabilities"}
        </Text>
      )}
      {update.isBreakingChange && !update.isSecurityUpdate && (
        <Text className="text-[11px] m-0 mt-1" style={{ color: colors.muted }}>
          Major version — check for breaking changes
        </Text>
      )}
      {update.changelogSnippet && (
        <Text
          className="text-[11px] leading-4 m-0 mt-2 pl-2"
          style={{
            color: colors.muted,
            borderLeft: `2px solid ${colors.border}`,
          }}
        >
          {update.changelogSnippet}
        </Text>
      )}
    </Section>
  );
}

// Preview props for react-email dev server
Digest.PreviewProps = {
  updates: [
    {
      packageName: "ai",
      newVersion: "4.1.0",
      previousVersion: "4.0.3",
      severity: "critical",
      isSecurityUpdate: true,
      isBreakingChange: false,
      vulnerabilitiesFixed: 1,
      changelogSnippet: "Security fix for prompt injection vulnerability",
    },
    {
      packageName: "ai",
      newVersion: "4.0.0",
      previousVersion: "3.4.7",
      severity: "important",
      isSecurityUpdate: false,
      isBreakingChange: true,
      changelogSnippet: "New streaming API, deprecated generateText()",
    },
    {
      packageName: "@ai-sdk/openai",
      newVersion: "1.2.0",
      previousVersion: "1.1.0",
      severity: "info",
      isSecurityUpdate: false,
      isBreakingChange: false,
    },
  ],
  period: "daily",
  unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=example",
} satisfies DigestProps;

// Default export for preview
export default Digest;
