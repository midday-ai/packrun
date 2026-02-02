/**
 * Category keyword mappings for alternative discovery
 */

export interface CategoryDefinition {
  id: string;
  name: string;
  keywords: string[];
  minMatches: number; // How many keywords must match
}

/**
 * 50+ seed category definitions with keywords
 * These are the manually curated, high-quality categories.
 * Dynamic categories discovered via keyword analysis are stored in Redis.
 */
export const SEED_CATEGORIES: CategoryDefinition[] = [
  // HTTP & Networking
  {
    id: "http-client",
    name: "HTTP Clients",
    keywords: ["http", "request", "fetch", "ajax", "rest-client", "api-client", "axios", "got"],
    minMatches: 2,
  },
  {
    id: "websocket",
    name: "WebSocket Libraries",
    keywords: ["websocket", "ws", "socket", "realtime", "socket.io"],
    minMatches: 1,
  },
  {
    id: "graphql-client",
    name: "GraphQL Clients",
    keywords: ["graphql", "gql", "apollo", "urql", "relay"],
    minMatches: 1,
  },

  // Data & Validation
  {
    id: "date-library",
    name: "Date Libraries",
    keywords: ["date", "time", "moment", "datetime", "calendar", "timezone", "dayjs", "luxon"],
    minMatches: 2,
  },
  {
    id: "validation",
    name: "Validation Libraries",
    keywords: ["validation", "schema", "validator", "validate", "zod", "yup", "joi"],
    minMatches: 1,
  },
  {
    id: "uuid",
    name: "ID Generators",
    keywords: ["uuid", "id", "nanoid", "cuid", "ulid", "unique-id"],
    minMatches: 1,
  },
  {
    id: "json",
    name: "JSON Utilities",
    keywords: ["json", "json5", "jsonc", "json-parser", "superjson"],
    minMatches: 1,
  },

  // Database & ORM
  {
    id: "orm",
    name: "ORMs & Query Builders",
    keywords: [
      "orm",
      "database",
      "sql",
      "query-builder",
      "prisma",
      "sequelize",
      "typeorm",
      "drizzle",
    ],
    minMatches: 2,
  },
  {
    id: "redis-client",
    name: "Redis Clients",
    keywords: ["redis", "ioredis", "cache"],
    minMatches: 1,
  },
  {
    id: "mongodb",
    name: "MongoDB Clients",
    keywords: ["mongodb", "mongoose", "mongo"],
    minMatches: 1,
  },

  // State Management
  {
    id: "state-management",
    name: "State Management",
    keywords: [
      "state",
      "store",
      "redux",
      "flux",
      "state-management",
      "zustand",
      "jotai",
      "recoil",
      "mobx",
    ],
    minMatches: 2,
  },

  // Testing
  {
    id: "testing",
    name: "Testing Frameworks",
    keywords: ["test", "testing", "jest", "mocha", "vitest", "spec", "assertion", "unit-test"],
    minMatches: 2,
  },
  {
    id: "e2e-testing",
    name: "E2E Testing",
    keywords: ["e2e", "playwright", "cypress", "puppeteer", "selenium", "browser-testing"],
    minMatches: 1,
  },
  {
    id: "mocking",
    name: "Mocking Libraries",
    keywords: ["mock", "stub", "spy", "faker", "msw", "nock"],
    minMatches: 1,
  },

  // Build Tools
  {
    id: "bundler",
    name: "Bundlers",
    keywords: ["bundler", "build-tool", "webpack", "rollup", "esbuild", "vite", "parcel"],
    minMatches: 1,
  },
  {
    id: "transpiler",
    name: "Transpilers",
    keywords: ["transpiler", "babel", "swc", "typescript", "compiler"],
    minMatches: 1,
  },
  {
    id: "linter",
    name: "Linters",
    keywords: ["linter", "eslint", "tslint", "lint", "prettier", "formatter"],
    minMatches: 1,
  },

  // Styling
  {
    id: "css-in-js",
    name: "CSS-in-JS",
    keywords: ["css-in-js", "styled-components", "emotion", "styling", "css", "jss"],
    minMatches: 2,
  },
  {
    id: "css-framework",
    name: "CSS Frameworks",
    keywords: ["tailwind", "bootstrap", "bulma", "css-framework", "ui-kit"],
    minMatches: 1,
  },

  // Logging & Monitoring
  {
    id: "logging",
    name: "Logging Libraries",
    keywords: ["logger", "logging", "log", "debug", "pino", "winston", "bunyan"],
    minMatches: 1,
  },
  {
    id: "error-tracking",
    name: "Error Tracking",
    keywords: ["error", "sentry", "bugsnag", "rollbar", "error-tracking"],
    minMatches: 1,
  },

  // CLI & Terminal
  {
    id: "cli",
    name: "CLI Frameworks",
    keywords: ["cli", "command-line", "terminal", "argv", "commander", "yargs", "oclif"],
    minMatches: 2,
  },
  {
    id: "terminal-ui",
    name: "Terminal UI",
    keywords: ["terminal", "chalk", "ora", "inquirer", "prompts", "readline"],
    minMatches: 1,
  },

  // File & System
  {
    id: "file-system",
    name: "File System Utilities",
    keywords: ["file", "fs", "filesystem", "glob", "fs-extra", "chokidar"],
    minMatches: 2,
  },
  {
    id: "path",
    name: "Path Utilities",
    keywords: ["path", "url", "resolve", "pathname"],
    minMatches: 1,
  },

  // Parsing
  {
    id: "markdown",
    name: "Markdown Parsers",
    keywords: ["markdown", "md", "remark", "marked", "mdx", "commonmark"],
    minMatches: 1,
  },
  {
    id: "yaml",
    name: "YAML Parsers",
    keywords: ["yaml", "yml", "js-yaml"],
    minMatches: 1,
  },
  {
    id: "csv",
    name: "CSV Parsers",
    keywords: ["csv", "tsv", "spreadsheet", "papaparse"],
    minMatches: 1,
  },
  {
    id: "xml",
    name: "XML Parsers",
    keywords: ["xml", "sax", "dom-parser", "xmldom", "fast-xml-parser"],
    minMatches: 1,
  },
  {
    id: "html-parser",
    name: "HTML Parsers",
    keywords: ["html", "cheerio", "jsdom", "htmlparser", "scraper"],
    minMatches: 1,
  },

  // Image & Media
  {
    id: "image",
    name: "Image Processing",
    keywords: ["image", "sharp", "jimp", "resize", "thumbnail", "canvas"],
    minMatches: 1,
  },
  {
    id: "pdf",
    name: "PDF Libraries",
    keywords: ["pdf", "pdfkit", "pdf-lib", "jspdf", "document"],
    minMatches: 1,
  },

  // Security & Crypto
  {
    id: "crypto",
    name: "Cryptography",
    keywords: ["crypto", "encryption", "hash", "bcrypt", "argon", "cipher"],
    minMatches: 1,
  },
  {
    id: "auth",
    name: "Authentication",
    keywords: ["auth", "authentication", "jwt", "oauth", "passport", "session"],
    minMatches: 1,
  },

  // Email & Messaging
  {
    id: "email",
    name: "Email Libraries",
    keywords: ["email", "mail", "smtp", "nodemailer", "sendgrid"],
    minMatches: 1,
  },
  {
    id: "queue",
    name: "Job Queues",
    keywords: ["queue", "job", "worker", "bull", "bee-queue", "agenda"],
    minMatches: 1,
  },

  // Compression & Encoding
  {
    id: "compression",
    name: "Compression",
    keywords: ["compression", "gzip", "zip", "tar", "archiver", "zlib"],
    minMatches: 1,
  },
  {
    id: "encoding",
    name: "Encoding/Decoding",
    keywords: ["base64", "encoding", "decode", "encode", "buffer"],
    minMatches: 1,
  },

  // Utilities
  {
    id: "lodash-like",
    name: "Utility Libraries",
    keywords: ["lodash", "underscore", "ramda", "utility", "helper", "toolkit"],
    minMatches: 1,
  },
  {
    id: "string",
    name: "String Utilities",
    keywords: ["string", "slugify", "truncate", "case", "camelcase", "change-case"],
    minMatches: 1,
  },
  {
    id: "number",
    name: "Number/Math Libraries",
    keywords: ["number", "decimal", "big", "math", "bignumber", "decimal.js"],
    minMatches: 1,
  },
  {
    id: "color",
    name: "Color Libraries",
    keywords: ["color", "colour", "hex", "rgb", "hsl", "tinycolor"],
    minMatches: 1,
  },

  // Async & Concurrency
  {
    id: "promise",
    name: "Promise/Async Utilities",
    keywords: ["promise", "async", "await", "bluebird", "p-limit", "p-queue"],
    minMatches: 1,
  },
  {
    id: "stream",
    name: "Stream Utilities",
    keywords: ["stream", "pipe", "readable", "writable", "through2"],
    minMatches: 1,
  },
  {
    id: "event",
    name: "Event Emitters",
    keywords: ["event", "emitter", "pubsub", "eventemitter", "mitt"],
    minMatches: 1,
  },

  // React Ecosystem
  {
    id: "react-form",
    name: "React Form Libraries",
    keywords: ["form", "formik", "react-hook-form", "final-form", "react-form"],
    minMatches: 1,
  },
  {
    id: "react-table",
    name: "React Table/Grid",
    keywords: ["table", "datagrid", "grid", "tanstack-table", "react-table", "ag-grid"],
    minMatches: 1,
  },
  {
    id: "react-query",
    name: "Data Fetching (React)",
    keywords: ["react-query", "swr", "tanstack", "data-fetching", "query"],
    minMatches: 1,
  },
  {
    id: "react-router",
    name: "React Routing",
    keywords: ["router", "routing", "react-router", "navigation", "wouter"],
    minMatches: 1,
  },
  {
    id: "react-animation",
    name: "React Animation",
    keywords: ["animation", "animate", "motion", "framer", "spring", "react-spring"],
    minMatches: 1,
  },

  // UI Components
  {
    id: "ui-components",
    name: "UI Component Libraries",
    keywords: ["ui", "components", "material-ui", "chakra", "ant-design", "radix"],
    minMatches: 2,
  },
  {
    id: "modal",
    name: "Modal/Dialog",
    keywords: ["modal", "dialog", "popup", "overlay", "lightbox"],
    minMatches: 1,
  },
  {
    id: "notification",
    name: "Notifications/Toasts",
    keywords: ["notification", "toast", "alert", "snackbar", "toastify"],
    minMatches: 1,
  },
  {
    id: "carousel",
    name: "Carousels/Sliders",
    keywords: ["carousel", "slider", "swiper", "slick", "slideshow"],
    minMatches: 1,
  },
  {
    id: "rich-text",
    name: "Rich Text Editors",
    keywords: ["rich-text", "wysiwyg", "editor", "contenteditable", "quill", "tiptap", "slate"],
    minMatches: 1,
  },
  {
    id: "code-highlight",
    name: "Code Highlighting",
    keywords: ["syntax", "highlight", "prism", "shiki", "highlightjs", "code-block"],
    minMatches: 1,
  },
  {
    id: "chart",
    name: "Charts & Visualization",
    keywords: ["chart", "graph", "visualization", "d3", "recharts", "chartjs"],
    minMatches: 1,
  },
  {
    id: "icons",
    name: "Icon Libraries",
    keywords: ["icons", "icon", "lucide", "heroicons", "feather", "fontawesome"],
    minMatches: 1,
  },

  // i18n
  {
    id: "i18n",
    name: "Internationalization",
    keywords: ["i18n", "internationalization", "translation", "locale", "intl", "react-intl"],
    minMatches: 1,
  },

  // Environment & Config
  {
    id: "config",
    name: "Configuration",
    keywords: ["config", "env", "dotenv", "configuration", "settings", "rc"],
    minMatches: 1,
  },
  {
    id: "env-validation",
    name: "Environment Validation",
    keywords: ["env", "environment", "t3-env", "envalid"],
    minMatches: 1,
  },
];

// Backward compatibility alias
export const CATEGORIES = SEED_CATEGORIES;

/**
 * Get category by ID from seed categories
 */
export function getCategory(id: string): CategoryDefinition | undefined {
  return SEED_CATEGORIES.find((c) => c.id === id);
}

/**
 * Get human-readable name for a category
 */
export function getCategoryName(id: string): string {
  return getCategory(id)?.name || id;
}

/**
 * Infer category from package keywords using seed categories
 */
export function inferCategory(keywords: string[]): string | null {
  if (!keywords || keywords.length === 0) return null;

  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  // Find the best matching category
  let bestMatch: { category: string; score: number } | null = null;

  for (const category of SEED_CATEGORIES) {
    let matchCount = 0;

    for (const catKeyword of category.keywords) {
      if (
        lowerKeywords.some(
          (k) => k === catKeyword || k.includes(catKeyword) || catKeyword.includes(k),
        )
      ) {
        matchCount++;
      }
    }

    if (matchCount >= category.minMatches) {
      const score = matchCount / category.keywords.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { category: category.id, score };
      }
    }
  }

  return bestMatch?.category || null;
}

/**
 * Get all seed category IDs
 */
export function getAllCategoryIds(): string[] {
  return SEED_CATEGORIES.map((c) => c.id);
}
