import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Terms of Service | v1.run",
  description: "Terms of service for v1.run",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <div className="flex-1 container-page" style={{ paddingTop: "3rem", paddingBottom: "6rem" }}>
        <h1 className="text-base font-medium mb-6">Terms of Service</h1>

        <div className="max-w-2xl space-y-4 text-xs text-muted">
          <p className="text-subtle">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Acceptance of Terms</h2>
            <p>
              By accessing and using v1.run, you agree to be bound by these Terms of Service. If you
              do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Description of Service</h2>
            <p>
              v1.run provides an npm package registry interface with MCP (Model Context Protocol)
              integration, security signals, and package health information for developers and AI
              agents.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Use of Service</h2>
            <p>
              You agree to use v1.run only for lawful purposes and in accordance with these terms.
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use the service in any way that violates applicable laws</li>
              <li>Attempt to interfere with or disrupt the service</li>
              <li>Access the service through automated means at excessive rates</li>
              <li>Reverse engineer or attempt to extract source code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">API Usage</h2>
            <p>
              Our API is provided for legitimate use by developers and AI agents. We reserve the
              right to rate limit or restrict access to prevent abuse.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Data Accuracy</h2>
            <p>
              While we strive to provide accurate package information, v1.run aggregates data from
              third-party sources (npm, GitHub, OSV). We make no guarantees about the accuracy or
              completeness of this data.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Limitation of Liability</h2>
            <p>
              v1.run is provided "as is" without warranties of any kind. We are not liable for any
              damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href="mailto:hello@v1.run" className="text-foreground hover:underline">
                hello@v1.run
              </a>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
