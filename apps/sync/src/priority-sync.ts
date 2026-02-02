/**
 * Priority Sync Script
 *
 * Syncs packages in priority order:
 * 1. Curated popular packages (instant)
 * 2. Popular packages from npm search (minutes)
 * 3. Long tail via registry scan (hours)
 *
 * Usage:
 *   bun run sync:priority     # Run all phases
 *   bun run sync:phase1       # Curated only (~100 packages)
 *   bun run sync:phase2       # + Popular search results (~5000)
 *   bun run sync:phase3       # + Long tail (millions)
 */

import { config } from "./config";
import { fetchDownloads, fetchPackageMetadata, transformToDocument } from "./npm-client";
import { fetchVulnerabilities } from "./osv-client";
import { ensureCollection, type PackageDocument, upsertPackages } from "./typesense";

// Phase 1: Curated list of most important packages
const PRIORITY_PACKAGES = [
  // Core utilities
  "lodash",
  "underscore",
  "ramda",
  "immer",
  "date-fns",
  "dayjs",
  "moment",
  "uuid",
  "nanoid",
  "async",
  "bluebird",
  "rxjs",
  "eventemitter3",
  // React ecosystem
  "react",
  "react-dom",
  "react-router",
  "react-router-dom",
  "@tanstack/react-query",
  "react-hook-form",
  "react-redux",
  "redux",
  "@reduxjs/toolkit",
  "zustand",
  "jotai",
  "recoil",
  "mobx",
  "framer-motion",
  "@headlessui/react",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  // Next.js
  "next",
  "next-auth",
  "@next/font",
  // Vue
  "vue",
  "vue-router",
  "vuex",
  "pinia",
  "nuxt",
  // Svelte
  "svelte",
  "@sveltejs/kit",
  // Build tools
  "vite",
  "webpack",
  "esbuild",
  "rollup",
  "turbo",
  "tsup",
  "unbuild",
  "parcel",
  // TypeScript
  "typescript",
  "ts-node",
  "tsx",
  "@types/node",
  "@types/react",
  "zod",
  "yup",
  "joi",
  "ajv",
  // Testing
  "jest",
  "vitest",
  "mocha",
  "chai",
  "@testing-library/react",
  "@testing-library/jest-dom",
  "cypress",
  "playwright",
  "@playwright/test",
  "puppeteer",
  // Linting
  "eslint",
  "prettier",
  "stylelint",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",
  // CSS
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "sass",
  "less",
  "styled-components",
  "@emotion/react",
  "@emotion/styled",
  "clsx",
  "classnames",
  "tailwind-merge",
  // HTTP
  "axios",
  "node-fetch",
  "got",
  "ky",
  "superagent",
  "undici",
  "graphql",
  "@apollo/client",
  "urql",
  "swr",
  // Server
  "express",
  "fastify",
  "koa",
  "hono",
  "h3",
  "cors",
  "helmet",
  "body-parser",
  "cookie-parser",
  "morgan",
  // Database
  "prisma",
  "@prisma/client",
  "drizzle-orm",
  "knex",
  "sequelize",
  "typeorm",
  "mongoose",
  "mongodb",
  "pg",
  "mysql2",
  "better-sqlite3",
  "redis",
  "ioredis",
  // Auth
  "jsonwebtoken",
  "bcrypt",
  "bcryptjs",
  "passport",
  "passport-local",
  "passport-jwt",
  // CLI
  "commander",
  "yargs",
  "chalk",
  "ora",
  "inquirer",
  "dotenv",
  "cross-env",
  "concurrently",
  // Misc popular
  "semver",
  "glob",
  "globby",
  "fast-glob",
  "chokidar",
  "fs-extra",
  "cheerio",
  "jsdom",
  "marked",
  "markdown-it",
  "sharp",
  "jimp",
  "xml2js",
  "fast-xml-parser",
  "yaml",
  "csv-parse",
  "papaparse",
  // AI
  "openai",
  "@anthropic-ai/sdk",
  "langchain",
  "@langchain/core",
  "ai",
  // Cloud
  "aws-sdk",
  "@aws-sdk/client-s3",
  "firebase",
  "@supabase/supabase-js",
  // UI Libraries
  "@mui/material",
  "@chakra-ui/react",
  "antd",
  "lucide-react",
  "react-icons",
  // Forms
  "formik",
  "@hookform/resolvers",
  // Charts
  "chart.js",
  "react-chartjs-2",
  "recharts",
  "d3",
  // Animation
  "gsap",
  "animejs",
  "lottie-web",
  "three",
  "@react-three/fiber",
  // Rich text
  "quill",
  "slate",
  "tiptap",
  "@tiptap/react",
  "lexical",
  // Search
  "fuse.js",
  "lunr",
  "flexsearch",
  "minisearch",
  "typesense",
  "meilisearch",
  "algoliasearch",
  // WebSocket
  "socket.io",
  "socket.io-client",
  "ws",
  // Email
  "nodemailer",
  "@sendgrid/mail",
  "resend",
  // Payment
  "stripe",
  "@stripe/stripe-js",
];

// Search terms to find more popular packages
const SEARCH_TERMS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "next",
  "nuxt",
  "typescript",
  "javascript",
  "node",
  "deno",
  "bun",
  "express",
  "fastify",
  "koa",
  "hono",
  "server",
  "api",
  "database",
  "orm",
  "prisma",
  "mongodb",
  "postgres",
  "mysql",
  "redis",
  "auth",
  "jwt",
  "oauth",
  "session",
  "test",
  "jest",
  "vitest",
  "cypress",
  "playwright",
  "lint",
  "eslint",
  "prettier",
  "format",
  "build",
  "vite",
  "webpack",
  "rollup",
  "esbuild",
  "bundler",
  "css",
  "tailwind",
  "sass",
  "styled",
  "emotion",
  "ui",
  "component",
  "button",
  "modal",
  "form",
  "table",
  "state",
  "redux",
  "zustand",
  "mobx",
  "store",
  "router",
  "navigation",
  "routing",
  "http",
  "fetch",
  "axios",
  "request",
  "client",
  "graphql",
  "apollo",
  "query",
  "cli",
  "command",
  "terminal",
  "shell",
  "util",
  "helper",
  "tool",
  "utility",
  "date",
  "time",
  "moment",
  "dayjs",
  "file",
  "fs",
  "path",
  "stream",
  "crypto",
  "hash",
  "encrypt",
  "security",
  "image",
  "sharp",
  "canvas",
  "svg",
  "pdf",
  "document",
  "excel",
  "csv",
  "email",
  "mail",
  "smtp",
  "payment",
  "stripe",
  "checkout",
  "ai",
  "openai",
  "llm",
  "ml",
  "machine learning",
  "websocket",
  "socket",
  "realtime",
  "cache",
  "memory",
  "storage",
  "log",
  "logger",
  "debug",
  "monitor",
  "docker",
  "kubernetes",
  "container",
  "deploy",
  "aws",
  "azure",
  "gcp",
  "cloud",
  "serverless",
  "markdown",
  "parser",
  "compiler",
  "transform",
];

const BATCH_SIZE = 50;

async function syncBatch(names: string[]): Promise<number> {
  const metadataPromises = names.map((name) => fetchPackageMetadata(name));
  const metadataResults = await Promise.all(metadataPromises);

  const validPackages = metadataResults.filter((m): m is NonNullable<typeof m> => m !== null);
  if (validPackages.length === 0) return 0;

  const packageNames = validPackages.map((p) => p.name);
  const downloads = await fetchDownloads(packageNames);

  // Fetch vulnerabilities for each package (in parallel)
  const vulnPromises = validPackages.map(async (metadata) => {
    const version = metadata["dist-tags"]?.latest || "0.0.0";
    return { name: metadata.name, vulns: await fetchVulnerabilities(metadata.name, version) };
  });
  const vulnResults = await Promise.all(vulnPromises);
  const vulnMap = new Map(vulnResults.map((r) => [r.name, r.vulns]));

  const documents: PackageDocument[] = validPackages.map((metadata) => {
    const doc = transformToDocument(metadata, downloads.get(metadata.name) || 0);
    const vulns = vulnMap.get(metadata.name);
    if (vulns) {
      doc.vulnerabilities = vulns.total;
      doc.vulnCritical = vulns.critical;
      doc.vulnHigh = vulns.high;
    }
    return doc;
  });

  await upsertPackages(documents);
  return documents.length;
}

async function phase1_CuratedPackages(): Promise<number> {
  console.log("\n📦 PHASE 1: Syncing curated popular packages...");
  console.log(`   ${PRIORITY_PACKAGES.length} packages to sync\n`);

  let synced = 0;
  const startTime = Date.now();

  for (let i = 0; i < PRIORITY_PACKAGES.length; i += BATCH_SIZE) {
    const batch = PRIORITY_PACKAGES.slice(i, i + BATCH_SIZE);
    const count = await syncBatch(batch);
    synced += count;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✓ ${synced}/${PRIORITY_PACKAGES.length} (${elapsed}s)`);
  }

  console.log(
    `\n   ✅ Phase 1 complete: ${synced} packages in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  );
  return synced;
}

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
    };
  }>;
}

async function fetchPopularFromSearch(term: string, size = 100): Promise<string[]> {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(term)}&size=${size}&popularity=1.0`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as NpmSearchResult;
    return data.objects.map((obj) => obj.package.name);
  } catch {
    return [];
  }
}

async function phase2_PopularFromSearch(): Promise<number> {
  console.log("\n📈 PHASE 2: Syncing popular packages from npm search...");
  console.log(`   Searching ${SEARCH_TERMS.length} terms for top packages\n`);

  const allPackages = new Set<string>(PRIORITY_PACKAGES);
  const startTime = Date.now();

  // Fetch popular packages for each search term
  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i]!;
    const packages = await fetchPopularFromSearch(term, 100);
    packages.forEach((pkg) => allPackages.add(pkg));

    if ((i + 1) % 10 === 0) {
      console.log(
        `   Searched ${i + 1}/${SEARCH_TERMS.length} terms, found ${allPackages.size} unique packages`,
      );
    }

    // Small delay between searches
    await sleep(100);
  }

  console.log(`\n   Found ${allPackages.size} total unique packages`);

  // Filter to only new packages
  const toSync = Array.from(allPackages).filter((pkg) => !PRIORITY_PACKAGES.includes(pkg));
  console.log(`   ${toSync.length} new packages to sync\n`);

  let synced = 0;

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batch = toSync.slice(i, i + BATCH_SIZE);

    try {
      const count = await syncBatch(batch);
      synced += count;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = synced / elapsed;

      if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= toSync.length) {
        console.log(
          `   Progress: ${synced.toLocaleString()}/${toSync.length.toLocaleString()} ` +
            `(${((synced / toSync.length) * 100).toFixed(1)}%) ` +
            `Rate: ${rate.toFixed(1)}/s`,
        );
      }
    } catch (error) {
      console.error(`   Error at batch ${i}:`, error);
    }

    await sleep(50);
  }

  console.log(
    `\n   ✅ Phase 2 complete: ${synced} new packages in ${formatDuration((Date.now() - startTime) / 1000)}`,
  );
  return synced;
}

async function phase3_AllPackages(startFrom = 0): Promise<number> {
  console.log("\n🔄 PHASE 3: Syncing all packages from registry...");
  console.log("   This will take several hours. Press Ctrl+C to pause.\n");

  // Use a different approach: paginated fetch from registry
  console.log("   Fetching package list...");

  // npm registry supports /_all_docs with startkey/endkey for pagination
  let allPackages: string[] = [];
  let startkey = "";

  while (true) {
    const url = startkey
      ? `${config.npm.registryUrl}/-/all?startkey=${encodeURIComponent(JSON.stringify(startkey))}&limit=5000`
      : `${config.npm.registryUrl}/-/all?limit=5000`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Try alternative endpoint
        console.log("   Using CouchDB _all_docs endpoint...");
        break;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const names = Object.keys(data).filter((k) => k !== "_updated");

      if (names.length === 0) break;

      allPackages = allPackages.concat(names);
      startkey = names[names.length - 1]! + "\ufff0";

      console.log(`   Fetched ${allPackages.length.toLocaleString()} packages...`);

      if (names.length < 5000) break; // Last page
    } catch (err) {
      console.error("   Error fetching package list:", err);
      break;
    }
  }

  if (allPackages.length === 0) {
    console.log("   Could not fetch package list. Using registry listing...\n");
    return 0;
  }

  console.log(`\n   Total packages: ${allPackages.length.toLocaleString()}`);

  const toSync = allPackages.slice(startFrom);
  console.log(`   Starting from: ${startFrom.toLocaleString()}`);
  console.log(`   Remaining: ${toSync.length.toLocaleString()}\n`);

  let synced = 0;
  const startTime = Date.now();

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batch = toSync.slice(i, i + BATCH_SIZE);

    try {
      const count = await syncBatch(batch);
      synced += count;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = synced / elapsed;
      const remaining = toSync.length - i - batch.length;
      const eta = remaining / rate;

      if ((i / BATCH_SIZE) % 50 === 0) {
        console.log(
          `   Progress: ${(startFrom + synced).toLocaleString()}/${allPackages.length.toLocaleString()} ` +
            `(${(((startFrom + synced) / allPackages.length) * 100).toFixed(2)}%) ` +
            `Rate: ${rate.toFixed(1)}/s, ETA: ${formatDuration(eta)}`,
        );
      }
    } catch (error) {
      console.error(`   Error at batch ${i}:`, error);
    }

    await sleep(100);
  }

  console.log(
    `\n   ✅ Phase 3 complete: ${synced} packages in ${formatDuration((Date.now() - startTime) / 1000)}`,
  );
  return synced;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const phase = args[0] || "all";

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║           V1.RUN PRIORITY SYNC                      ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  await ensureCollection();

  let totalSynced = 0;
  const startTime = Date.now();

  if (phase === "1" || phase === "all" || phase === "1+2") {
    totalSynced += await phase1_CuratedPackages();
  }

  if (phase === "2" || phase === "all" || phase === "1+2") {
    totalSynced += await phase2_PopularFromSearch();
  }

  if (phase === "3") {
    const startFrom = Number.parseInt(args[1] || "0");
    totalSynced += await phase3_AllPackages(startFrom);
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log(`║  SYNC COMPLETE                                            ║`);
  console.log(
    `║  Total: ${totalSynced.toLocaleString().padEnd(10)} packages                          ║`,
  );
  console.log(
    `║  Time:  ${formatDuration((Date.now() - startTime) / 1000).padEnd(10)}                                   ║`,
  );
  console.log("╚═══════════════════════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
