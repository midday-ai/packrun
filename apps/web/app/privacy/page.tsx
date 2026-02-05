import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Privacy Policy | packrun.dev",
  description: "Privacy policy for packrun.dev",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <div className="flex-1 container-page" style={{ paddingTop: "3rem", paddingBottom: "6rem" }}>
        <h1 className="text-base font-medium mb-6">Privacy Policy</h1>

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
            <h2 className="text-xs text-foreground mt-6 mb-2">Information We Collect</h2>
            <p>
              packrun.dev collects minimal information to provide our service. When you use our
              website, we may collect:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Usage data (pages visited, search queries)</li>
              <li>Technical data (browser type, device type)</li>
              <li>Account information if you sign in (email, profile data from OAuth provider)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide and improve our services</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Communicate with you about your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Data Storage</h2>
            <p>
              Your data is stored securely using industry-standard practices. We do not sell your
              personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Cookies</h2>
            <p>
              We use essential cookies to maintain your session and preferences. Analytics cookies
              help us understand how visitors use our site.
            </p>
          </section>

          <section>
            <h2 className="text-xs text-foreground mt-6 mb-2">Contact</h2>
            <p>
              For privacy-related questions, contact us at{" "}
              <a href="mailto:hello@packrun.dev" className="text-foreground hover:underline">
                hello@packrun.dev
              </a>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
