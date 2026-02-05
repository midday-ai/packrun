/**
 * Quick test script to send a real email
 *
 * Usage: RESEND_API_KEY=re_xxx bun run test-send.ts your@email.com
 */

import React from "react";
import { Digest, type DigestUpdate, sendEmail } from "./src";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun run test-send.ts your@email.com");
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is required");
  process.exit(1);
}

const updates: DigestUpdate[] = [
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
];

const emailElement = React.createElement(Digest, {
  updates,
  period: "daily",
  unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=test",
});

console.log(`Sending test email to ${email}...`);

const result = await sendEmail({
  to: email,
  subject: "📦 Test digest: 3 package updates",
  react: emailElement,
});

console.log("Result:", result);
