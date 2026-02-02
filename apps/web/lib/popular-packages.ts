/**
 * Popular npm packages for pre-rendering at build time.
 *
 * These packages will be fully static - zero latency for visitors.
 * Other packages are rendered on-demand and cached via ISR.
 *
 * Source: Top npm packages by weekly downloads (curated list)
 */

export const POPULAR_PACKAGES: string[] = [
  // Core utilities
  "lodash",
  "underscore",
  "ramda",
  "immer",
  "date-fns",
  "dayjs",
  "moment",
  "luxon",
  "uuid",
  "nanoid",

  // React ecosystem
  "react",
  "react-dom",
  "react-router",
  "react-router-dom",
  "react-query",
  "@tanstack/react-query",
  "react-hook-form",
  "react-redux",
  "redux",
  "redux-toolkit",
  "@reduxjs/toolkit",
  "zustand",
  "jotai",
  "recoil",
  "mobx",
  "mobx-react",
  "framer-motion",
  "react-spring",
  "@headlessui/react",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-select",
  "@radix-ui/react-slot",

  // Next.js ecosystem
  "next",
  "next-auth",
  "@next/font",

  // Vue ecosystem
  "vue",
  "vue-router",
  "vuex",
  "pinia",
  "nuxt",

  // Angular
  "@angular/core",
  "@angular/common",
  "@angular/router",
  "@angular/forms",

  // Svelte
  "svelte",
  "@sveltejs/kit",

  // Build tools
  "vite",
  "webpack",
  "esbuild",
  "rollup",
  "parcel",
  "turbo",
  "tsup",
  "unbuild",

  // TypeScript
  "typescript",
  "ts-node",
  "tsx",
  "@types/node",
  "@types/react",
  "@types/react-dom",
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

  // Linting & Formatting
  "eslint",
  "prettier",
  "stylelint",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",

  // CSS & Styling
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

  // HTTP & API
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

  // Server & Backend
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

  // Authentication
  "jsonwebtoken",
  "bcrypt",
  "bcryptjs",
  "passport",
  "passport-local",
  "passport-jwt",
  "@auth/core",
  "lucia",

  // File & Process
  "fs-extra",
  "glob",
  "globby",
  "fast-glob",
  "chokidar",
  "commander",
  "yargs",
  "chalk",
  "ora",
  "inquirer",
  "dotenv",
  "cross-env",
  "concurrently",
  "npm-run-all",

  // Validation & Schema
  "class-validator",
  "class-transformer",
  "io-ts",
  "superstruct",
  "valibot",

  // Logging
  "winston",
  "pino",
  "bunyan",
  "debug",
  "loglevel",

  // Monorepo
  "lerna",
  "nx",
  "turborepo",
  "changesets",
  "@changesets/cli",

  // Documentation
  "typedoc",
  "jsdoc",
  "storybook",
  "@storybook/react",

  // UI Component Libraries
  "@mui/material",
  "@chakra-ui/react",
  "antd",
  "@nextui-org/react",
  "shadcn-ui",
  "lucide-react",
  "react-icons",
  "@heroicons/react",

  // Animation
  "gsap",
  "animejs",
  "lottie-web",
  "three",
  "@react-three/fiber",
  "@react-three/drei",

  // Forms
  "formik",
  "@hookform/resolvers",
  "final-form",
  "react-final-form",

  // Tables & Data
  "@tanstack/react-table",
  "ag-grid-react",
  "react-virtualized",
  "@tanstack/react-virtual",

  // Charts
  "chart.js",
  "react-chartjs-2",
  "recharts",
  "d3",
  "victory",
  "echarts",
  "plotly.js",

  // Maps
  "leaflet",
  "react-leaflet",
  "@react-google-maps/api",
  "mapbox-gl",
  "react-map-gl",

  // Date & Time Pickers
  "react-datepicker",
  "@mui/x-date-pickers",

  // Rich Text
  "quill",
  "react-quill",
  "slate",
  "slate-react",
  "tiptap",
  "@tiptap/react",
  "draft-js",
  "prosemirror",
  "lexical",
  "@lexical/react",

  // Markdown
  "marked",
  "markdown-it",
  "remark",
  "rehype",
  "react-markdown",
  "mdx",
  "@mdx-js/react",

  // Image & Media
  "sharp",
  "jimp",
  "canvas",
  "pdf-lib",
  "pdfkit",
  "exceljs",
  "xlsx",
  "papaparse",

  // Search
  "fuse.js",
  "lunr",
  "flexsearch",
  "minisearch",
  "typesense",
  "meilisearch",
  "@algolia/client-search",
  "algoliasearch",

  // WebSocket & Realtime
  "socket.io",
  "socket.io-client",
  "ws",
  "pusher",
  "pusher-js",
  "@supabase/supabase-js",
  "firebase",
  "@firebase/app",

  // Email
  "nodemailer",
  "@sendgrid/mail",
  "resend",
  "postmark",

  // Payment
  "stripe",
  "@stripe/stripe-js",
  "@stripe/react-stripe-js",

  // Cloud SDKs
  "aws-sdk",
  "@aws-sdk/client-s3",
  "@google-cloud/storage",
  "@azure/storage-blob",

  // AI & ML
  "openai",
  "@anthropic-ai/sdk",
  "langchain",
  "@langchain/core",
  "ai",
  "@vercel/ai",

  // Crypto
  "crypto-js",
  "tweetnacl",
  "ethers",
  "web3",
  "viem",
  "wagmi",

  // Misc popular
  "async",
  "bluebird",
  "rxjs",
  "eventemitter3",
  "mitt",
  "qs",
  "query-string",
  "url-parse",
  "semver",
  "mime-types",
  "content-type",
  "http-errors",
  "statuses",
  "escape-html",
  "sanitize-html",
  "dompurify",
  "isomorphic-dompurify",
  "cheerio",
  "jsdom",
  "linkedom",
  "xml2js",
  "fast-xml-parser",
  "yaml",
  "toml",
  "ini",
  "json5",
  "jsonc-parser",
  "hjson",
];

/**
 * Number of packages to pre-render at build time.
 * Adjust this based on build time constraints.
 */
export const PRERENDER_COUNT = POPULAR_PACKAGES.length;

/**
 * Get packages for generateStaticParams
 */
export function getStaticPackages(): string[] {
  return POPULAR_PACKAGES.slice(0, PRERENDER_COUNT);
}
