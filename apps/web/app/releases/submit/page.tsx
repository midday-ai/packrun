"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

interface PackageSearchResult {
  name: string;
  version: string;
  description?: string;
}

export default function SubmitReleasePage() {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();

  // Form state
  const [step, setStep] = useState(1);
  const [packageSearch, setPackageSearch] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<PackageSearchResult | null>(null);
  const [targetVersion, setTargetVersion] = useState("");
  const [versionMatchType, setVersionMatchType] = useState<"exact" | "major">("exact");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Package search
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    ...orpc.search.packages.queryOptions({
      input: { q: packageSearch, limit: 5 },
    }),
    enabled: packageSearch.length >= 2,
  });

  // Create release mutation
  const createMutation = useMutation({
    ...orpc.releases.create.mutationOptions(),
    onSuccess: () => {
      router.push("/releases");
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Handle package selection
  const handleSelectPackage = (pkg: PackageSearchResult) => {
    setSelectedPackage(pkg);
    setPackageSearch("");
    setTitle(`${pkg.name} v`);
    setStep(2);
  };

  // Validate version
  const validateVersion = (version: string): boolean => {
    if (!selectedPackage) return false;

    // Basic semver pattern check
    const semverPattern = /^\d+(\.\d+)?(\.\d+)?$/;
    const majorPattern = /^\d+\.x$/;

    if (!semverPattern.test(version) && !majorPattern.test(version)) {
      setErrors((prev) => ({ ...prev, version: "Invalid version format (e.g., 1.0.0 or 1.x)" }));
      return false;
    }

    // Check if version is greater than current (simple comparison)
    const currentParts = selectedPackage.version.split(".").map(Number);
    const targetParts = version.replace(".x", ".0").split(".").map(Number);

    // Compare major.minor.patch
    for (let i = 0; i < 3; i++) {
      const current = currentParts[i] || 0;
      const target = targetParts[i] || 0;
      if (target > current) {
        setErrors((prev) => ({ ...prev, version: "" }));
        return true;
      }
      if (target < current) {
        setErrors((prev) => ({
          ...prev,
          version: `Version must be greater than current (${selectedPackage.version})`,
        }));
        return false;
      }
    }

    setErrors((prev) => ({
      ...prev,
      version: `Version must be greater than current (${selectedPackage.version})`,
    }));
    return false;
  };

  // Handle version change
  const handleVersionChange = (value: string) => {
    setTargetVersion(value);
    if (value) {
      validateVersion(value);
      // Update title
      setTitle(`${selectedPackage?.name} v${value}`);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPackage || !targetVersion || !title) {
      return;
    }

    if (!validateVersion(targetVersion)) {
      return;
    }

    createMutation.mutate({
      packageName: selectedPackage.name,
      title,
      description: description || undefined,
      targetVersion,
      versionMatchType,
      websiteUrl: websiteUrl || undefined,
      expectedDate: expectedDate || undefined,
    });
  };

  // Show loading while checking session
  if (sessionPending) {
    return (
      <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
        <Header />
        <div className="container-page py-8 flex-1 flex items-center justify-center">
          <div className="w-8 h-8 bg-surface/50 animate-pulse" />
        </div>
        <Footer />
      </main>
    );
  }

  // Require authentication
  if (!session?.user) {
    return (
      <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
        <Header />
        <div className="container-page py-8 flex-1 flex flex-col items-center justify-center">
          <p className="text-muted mb-4">Sign in to submit an upcoming release</p>
          <Link
            href="/releases"
            className="text-sm text-subtle hover:text-foreground transition-colors"
          >
            ← Back to releases
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      <Header />

      <div className="container-page py-8 flex-1">
        <div className="max-w-xl mx-auto">
          {/* Back link */}
          <Link
            href="/releases"
            className="text-xs text-subtle hover:text-foreground transition-colors"
          >
            ← Back to releases
          </Link>

          <h1 className="text-2xl font-bold mt-4 mb-2">Submit Upcoming Release</h1>
          <p className="text-sm text-muted mb-8">
            Share an upcoming release so others can follow and get notified when it ships.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Select Package */}
            <section className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">
                1. Select Package
              </h2>

              {selectedPackage ? (
                <div className="border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedPackage.name}</p>
                      <p className="text-xs text-muted">
                        Current version: {selectedPackage.version}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPackage(null);
                        setStep(1);
                        setTargetVersion("");
                        setTitle("");
                      }}
                      className="text-xs text-subtle hover:text-foreground transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="package-search"
                    type="text"
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                    placeholder="Search for a package..."
                    className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground"
                  />

                  {/* Search results dropdown */}
                  {packageSearch.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background z-10">
                      {searchLoading ? (
                        <div className="px-4 py-3 text-sm text-muted">Searching...</div>
                      ) : searchResults?.hits && searchResults.hits.length > 0 ? (
                        searchResults.hits.map((pkg) => (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() =>
                              handleSelectPackage({
                                name: pkg.name,
                                version: pkg.version,
                                description: pkg.description || undefined,
                              })
                            }
                            className="w-full text-left px-4 py-3 hover:bg-surface transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{pkg.name}</span>
                              <span className="text-xs text-muted">v{pkg.version}</span>
                            </div>
                            {pkg.description && (
                              <p className="text-xs text-muted truncate mt-1">{pkg.description}</p>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-muted">No packages found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Version Details */}
            {step >= 2 && selectedPackage && (
              <section className="mb-8">
                <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">
                  2. Version Details
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="target-version" className="text-xs text-subtle block mb-2">
                      Target Version
                    </label>
                    <input
                      id="target-version"
                      type="text"
                      value={targetVersion}
                      onChange={(e) => handleVersionChange(e.target.value)}
                      placeholder="e.g., 1.0.0 or 2.x"
                      className={`w-full bg-transparent border px-4 py-3 text-sm focus:outline-none ${
                        errors.version ? "border-red-500" : "border-border focus:border-foreground"
                      }`}
                    />
                    {errors.version && (
                      <p className="text-xs text-red-500 mt-1">{errors.version}</p>
                    )}
                    <p className="text-xs text-subtle mt-1">
                      Current version: {selectedPackage.version}
                    </p>
                  </div>

                  <fieldset>
                    <legend className="text-xs text-subtle block mb-2">Match Type</legend>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="matchType"
                          value="exact"
                          checked={versionMatchType === "exact"}
                          onChange={() => setVersionMatchType("exact")}
                          className="accent-foreground"
                        />
                        <span>Exact version</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="matchType"
                          value="major"
                          checked={versionMatchType === "major"}
                          onChange={() => setVersionMatchType("major")}
                          className="accent-foreground"
                        />
                        <span>Any in major (e.g., 1.x)</span>
                      </label>
                    </div>
                  </fieldset>
                </div>
              </section>
            )}

            {/* Step 3: Details */}
            {step >= 2 && targetVersion && !errors.version && (
              <section className="mb-8">
                <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">3. Details</h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="release-title" className="text-xs text-subtle block mb-2">
                      Title
                    </label>
                    <input
                      id="release-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Drizzle v1.0"
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="release-description" className="text-xs text-subtle block mb-2">
                      Description <span className="text-faint">(optional)</span>
                    </label>
                    <textarea
                      id="release-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's exciting about this release?"
                      rows={3}
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="release-url" className="text-xs text-subtle block mb-2">
                      Announcement URL <span className="text-faint">(optional)</span>
                    </label>
                    <input
                      id="release-url"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground"
                    />
                  </div>

                  <div>
                    <label htmlFor="release-date" className="text-xs text-subtle block mb-2">
                      Expected Date <span className="text-faint">(optional)</span>
                    </label>
                    <input
                      id="release-date"
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Submit */}
            {step >= 2 && targetVersion && !errors.version && title && (
              <div className="flex items-center justify-between">
                {errors.submit && <p className="text-xs text-red-500">{errors.submit}</p>}
                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-foreground text-background text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit Release"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      <Footer />
    </main>
  );
}
