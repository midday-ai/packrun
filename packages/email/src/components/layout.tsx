/**
 * Shared email layout component
 *
 * Matches packrun.dev website design:
 * - Dark mode (#050505 background)
 * - Geist Mono font
 * - Zero border radius
 * - Border-based separators
 */

import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type { ReactNode } from "react";

export interface LayoutProps {
  previewText: string;
  children: ReactNode;
  unsubscribeUrl?: string;
}

// packrun.dev color palette
const colors = {
  bg: "#050505",
  fg: "#ffffff",
  border: "#1a1a1a",
  muted: "#888888",
  subtle: "#666666",
  surface: "#0a0a0a",
};

export function Layout({ previewText, children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html>
      <Head>
        {/* Geist Mono from Google Fonts */}
        <Font
          fontFamily="Geist Mono"
          fallbackFontFamily="monospace"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                packrun: colors,
              },
              fontFamily: {
                mono: ["Geist Mono", "ui-monospace", "SF Mono", "monospace"],
              },
              borderRadius: {
                DEFAULT: "0",
                sm: "0",
                md: "0",
                lg: "0",
              },
            },
          },
        }}
      >
        <Body
          className="font-mono m-0 p-0"
          style={{
            backgroundColor: colors.bg,
            backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(255, 255, 255, 0.03) 1px, rgba(255, 255, 255, 0.03) 2px)`,
          }}
        >
          <Container className="mx-auto my-10 max-w-[600px]">
            {/* Header */}
            <Section className="px-5 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <Row>
                <Column>
                  <Link href="https://packrun.dev" className="no-underline">
                    <Img
                      src="https://packrun.dev/logo.svg"
                      alt="packrun.dev"
                      width="32"
                      height="23"
                      style={{ display: "block" }}
                    />
                  </Link>
                </Column>
                <Column align="right">
                  <Link
                    href="https://packrun.dev"
                    className="text-[11px] no-underline"
                    style={{ color: colors.subtle }}
                  >
                    packrun.dev
                  </Link>
                </Column>
              </Row>
            </Section>

            {/* Content */}
            <Section className="p-5">{children}</Section>

            {/* Footer */}
            <Section className="pt-8 pb-8 px-5" style={{ borderTop: `1px solid ${colors.border}` }}>
              <Text className="text-[10px] leading-4 m-0 mb-1" style={{ color: colors.subtle }}>
                You're receiving this because you follow packages on{" "}
                <Link
                  href="https://packrun.dev"
                  className="underline"
                  style={{ color: colors.subtle }}
                >
                  packrun.dev
                </Link>
                .
              </Text>
              <Text className="text-[10px] leading-4 m-0" style={{ color: colors.subtle }}>
                {unsubscribeUrl && (
                  <>
                    <Link
                      href={unsubscribeUrl}
                      className="underline"
                      style={{ color: colors.subtle }}
                    >
                      Unsubscribe
                    </Link>
                    {" · "}
                  </>
                )}
                <Link
                  href="https://packrun.dev/profile?tab=notifications"
                  className="underline"
                  style={{ color: colors.subtle }}
                >
                  Manage preferences
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Export colors for use in other templates
export { colors };
