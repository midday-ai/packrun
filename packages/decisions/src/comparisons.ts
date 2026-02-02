/**
 * Curated package comparisons
 */

import type { ComparisonCategory, PackageComparison } from "./schema";

/**
 * Comparison categories
 */
export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  {
    id: "date-libraries",
    name: "Date Libraries",
    description: "Libraries for date/time manipulation",
    packages: ["moment", "date-fns", "dayjs", "luxon"],
  },
  {
    id: "http-clients",
    name: "HTTP Clients",
    description: "Libraries for making HTTP requests",
    packages: ["axios", "got", "ky", "node-fetch", "undici"],
  },
  {
    id: "state-management",
    name: "State Management",
    description: "React state management solutions",
    packages: ["redux", "zustand", "jotai", "recoil", "mobx"],
  },
  {
    id: "validation",
    name: "Validation Libraries",
    description: "Schema validation and parsing",
    packages: ["zod", "yup", "joi", "ajv", "valibot"],
  },
  {
    id: "orm",
    name: "ORMs & Query Builders",
    description: "Database ORMs and query builders",
    packages: ["prisma", "drizzle-orm", "typeorm", "sequelize", "knex"],
  },
  {
    id: "testing",
    name: "Testing Frameworks",
    description: "JavaScript testing frameworks",
    packages: ["vitest", "jest", "mocha", "ava"],
  },
  {
    id: "css-in-js",
    name: "CSS-in-JS",
    description: "CSS-in-JS and styling solutions",
    packages: ["tailwindcss", "styled-components", "emotion", "@vanilla-extract/css"],
  },
  {
    id: "bundlers",
    name: "Bundlers",
    description: "JavaScript bundlers and build tools",
    packages: ["vite", "esbuild", "webpack", "rollup", "parcel"],
  },
];

/**
 * Curated comparisons with recommendations
 */
export const CURATED_COMPARISONS: PackageComparison[] = [
  {
    category: "date-libraries",
    categoryName: "Date Libraries",
    packages: ["moment", "date-fns", "dayjs", "luxon"],
    recommendation: "date-fns",
    reasoning:
      "Tree-shakeable, TypeScript-first, actively maintained. dayjs is a good alternative if bundle size is critical.",
    comparison: {
      bundleSize: { moment: "72kb", "date-fns": "13kb (tree-shaken)", dayjs: "2kb", luxon: "23kb" },
      typescript: {
        moment: "external",
        "date-fns": "built-in",
        dayjs: "built-in",
        luxon: "built-in",
      },
      maintenance: { moment: "frozen", "date-fns": "active", dayjs: "active", luxon: "active" },
      treeShaking: { moment: false, "date-fns": true, dayjs: false, luxon: false },
      immutable: { moment: false, "date-fns": true, dayjs: true, luxon: true },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "http-clients",
    categoryName: "HTTP Clients",
    packages: ["axios", "got", "ky", "node-fetch", "undici"],
    recommendation: "ky",
    reasoning:
      "Modern, tiny, TypeScript-first, works in browser and Node. Use got for Node-only with advanced features, axios if you need interceptors.",
    comparison: {
      bundleSize: {
        axios: "14kb",
        got: "48kb",
        ky: "3kb",
        "node-fetch": "8kb",
        undici: "Node built-in",
      },
      typescript: {
        axios: "built-in",
        got: "built-in",
        ky: "built-in",
        "node-fetch": "external",
        undici: "built-in",
      },
      browser: { axios: true, got: false, ky: true, "node-fetch": false, undici: false },
      node: { axios: true, got: true, ky: true, "node-fetch": true, undici: true },
      maintenance: {
        axios: "active",
        got: "active",
        ky: "active",
        "node-fetch": "stable",
        undici: "active",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "state-management",
    categoryName: "State Management",
    packages: ["redux", "zustand", "jotai", "recoil", "mobx"],
    recommendation: "zustand",
    reasoning:
      "Simple API, tiny bundle, no boilerplate. Use jotai for atomic state, Redux Toolkit if you need devtools/middleware ecosystem.",
    comparison: {
      bundleSize: {
        redux: "4kb (+toolkit)",
        zustand: "1kb",
        jotai: "3kb",
        recoil: "20kb",
        mobx: "16kb",
      },
      typescript: {
        redux: "built-in",
        zustand: "built-in",
        jotai: "built-in",
        recoil: "built-in",
        mobx: "built-in",
      },
      boilerplate: {
        redux: "high",
        zustand: "minimal",
        jotai: "minimal",
        recoil: "medium",
        mobx: "low",
      },
      devtools: { redux: true, zustand: true, jotai: true, recoil: true, mobx: true },
      maintenance: {
        redux: "active",
        zustand: "active",
        jotai: "active",
        recoil: "stable",
        mobx: "active",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "validation",
    categoryName: "Validation Libraries",
    packages: ["zod", "yup", "joi", "ajv", "valibot"],
    recommendation: "zod",
    reasoning:
      "TypeScript-first with excellent type inference. Use valibot if bundle size is critical, ajv for JSON Schema validation.",
    comparison: {
      bundleSize: { zod: "12kb", yup: "15kb", joi: "35kb", ajv: "32kb", valibot: "1kb" },
      typescript: {
        zod: "built-in",
        yup: "built-in",
        joi: "external",
        ajv: "built-in",
        valibot: "built-in",
      },
      typeInference: {
        zod: "excellent",
        yup: "good",
        joi: "none",
        ajv: "good",
        valibot: "excellent",
      },
      browser: { zod: true, yup: true, joi: false, ajv: true, valibot: true },
      maintenance: {
        zod: "active",
        yup: "stable",
        joi: "stable",
        ajv: "active",
        valibot: "active",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "orm",
    categoryName: "ORMs & Query Builders",
    packages: ["prisma", "drizzle-orm", "typeorm", "sequelize", "knex"],
    recommendation: "drizzle-orm",
    reasoning:
      "SQL-like syntax, excellent TypeScript, lightweight, no code generation. Use Prisma if you prefer schema-first with migrations UI.",
    comparison: {
      typescript: {
        prisma: "generated",
        "drizzle-orm": "built-in",
        typeorm: "decorators",
        sequelize: "external",
        knex: "built-in",
      },
      bundleSize: {
        prisma: "large (engine)",
        "drizzle-orm": "35kb",
        typeorm: "120kb",
        sequelize: "85kb",
        knex: "25kb",
      },
      performance: {
        prisma: "medium",
        "drizzle-orm": "fast",
        typeorm: "slow",
        sequelize: "medium",
        knex: "fast",
      },
      migrations: {
        prisma: "built-in",
        "drizzle-orm": "built-in",
        typeorm: "built-in",
        sequelize: "built-in",
        knex: "built-in",
      },
      maintenance: {
        prisma: "active",
        "drizzle-orm": "active",
        typeorm: "stable",
        sequelize: "stable",
        knex: "stable",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "testing",
    categoryName: "Testing Frameworks",
    packages: ["vitest", "jest", "mocha", "ava"],
    recommendation: "vitest",
    reasoning:
      "Fast, native ESM, Vite-powered, Jest-compatible API. Use Jest if you need the mature ecosystem or are on a non-Vite project.",
    comparison: {
      speed: { vitest: "fast", jest: "medium", mocha: "medium", ava: "fast" },
      typescript: {
        vitest: "built-in",
        jest: "config needed",
        mocha: "config needed",
        ava: "built-in",
      },
      esm: { vitest: "native", jest: "experimental", mocha: "native", ava: "native" },
      watchMode: { vitest: "excellent", jest: "good", mocha: "basic", ava: "good" },
      maintenance: { vitest: "active", jest: "active", mocha: "stable", ava: "stable" },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "css-in-js",
    categoryName: "CSS-in-JS",
    packages: ["tailwindcss", "styled-components", "emotion", "@vanilla-extract/css"],
    recommendation: "tailwindcss",
    reasoning:
      "Utility-first, zero runtime, excellent DX with IDE support. Use vanilla-extract for type-safe CSS-in-TS with zero runtime.",
    comparison: {
      runtime: {
        tailwindcss: "none",
        "styled-components": "yes",
        emotion: "yes",
        "@vanilla-extract/css": "none",
      },
      bundleSize: {
        tailwindcss: "purged",
        "styled-components": "16kb",
        emotion: "11kb",
        "@vanilla-extract/css": "0kb",
      },
      typescript: {
        tailwindcss: "plugin",
        "styled-components": "external",
        emotion: "built-in",
        "@vanilla-extract/css": "built-in",
      },
      ssr: {
        tailwindcss: "native",
        "styled-components": "setup needed",
        emotion: "setup needed",
        "@vanilla-extract/css": "native",
      },
      maintenance: {
        tailwindcss: "active",
        "styled-components": "stable",
        emotion: "stable",
        "@vanilla-extract/css": "active",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
  {
    category: "bundlers",
    categoryName: "Bundlers",
    packages: ["vite", "esbuild", "webpack", "rollup", "parcel"],
    recommendation: "vite",
    reasoning:
      "Fast dev server, optimized production builds, excellent DX. Use esbuild directly for library bundling, webpack only for legacy projects.",
    comparison: {
      devSpeed: {
        vite: "instant",
        esbuild: "instant",
        webpack: "slow",
        rollup: "medium",
        parcel: "medium",
      },
      buildSpeed: {
        vite: "fast",
        esbuild: "fastest",
        webpack: "slow",
        rollup: "medium",
        parcel: "medium",
      },
      config: {
        vite: "minimal",
        esbuild: "minimal",
        webpack: "complex",
        rollup: "medium",
        parcel: "zero",
      },
      plugins: {
        vite: "growing",
        esbuild: "limited",
        webpack: "extensive",
        rollup: "extensive",
        parcel: "limited",
      },
      maintenance: {
        vite: "active",
        esbuild: "active",
        webpack: "active",
        rollup: "active",
        parcel: "stable",
      },
    },
    updatedAt: new Date("2024-01-15"),
  },
];

/**
 * Get comparison by category
 */
export function getComparison(category: string): PackageComparison | undefined {
  return CURATED_COMPARISONS.find((c) => c.category === category);
}

/**
 * Get comparison containing a specific package
 */
export function getComparisonForPackage(packageName: string): PackageComparison | undefined {
  return CURATED_COMPARISONS.find((c) => c.packages.includes(packageName));
}

/**
 * Get all category IDs
 */
export function getCategories(): ComparisonCategory[] {
  return COMPARISON_CATEGORIES;
}

/**
 * Compare specific packages (may be from different categories)
 */
export function comparePackages(packages: string[]): PackageComparison | null {
  // First, try to find an existing comparison that contains all packages
  const existing = CURATED_COMPARISONS.find((c) => packages.every((p) => c.packages.includes(p)));

  if (existing) {
    // Filter to only requested packages
    return {
      ...existing,
      packages,
      comparison: Object.fromEntries(
        Object.entries(existing.comparison).map(([key, value]) => [
          key,
          value
            ? Object.fromEntries(Object.entries(value).filter(([pkg]) => packages.includes(pkg)))
            : undefined,
        ]),
      ),
    };
  }

  return null;
}

/**
 * Package alternatives mapping (deprecated/old → modern alternatives)
 */
export const PACKAGE_ALTERNATIVES: Record<
  string,
  { alternatives: string[]; recommended: string; reason: string }
> = {
  // Deprecated/old packages
  moment: {
    alternatives: ["date-fns", "dayjs", "luxon"],
    recommended: "date-fns",
    reason: "moment is in maintenance mode and has a large bundle size",
  },
  request: {
    alternatives: ["got", "axios", "ky", "node-fetch"],
    recommended: "got",
    reason: "request is deprecated",
  },
  "node-sass": {
    alternatives: ["sass", "dart-sass"],
    recommended: "sass",
    reason: "node-sass is deprecated, use dart-sass (sass package)",
  },
  tslint: {
    alternatives: ["eslint", "@typescript-eslint/eslint-plugin"],
    recommended: "eslint",
    reason: "tslint is deprecated in favor of ESLint with TypeScript support",
  },
  enzyme: {
    alternatives: ["@testing-library/react", "vitest"],
    recommended: "@testing-library/react",
    reason: "enzyme is not maintained for React 18+",
  },
  "create-react-app": {
    alternatives: ["vite", "next", "remix"],
    recommended: "vite",
    reason: "CRA is no longer recommended by React team",
  },
  lodash: {
    alternatives: ["es-toolkit", "radash", "remeda"],
    recommended: "es-toolkit",
    reason: "Modern alternatives with better tree-shaking and TypeScript support",
  },
  underscore: {
    alternatives: ["lodash", "es-toolkit", "radash"],
    recommended: "es-toolkit",
    reason: "underscore is largely superseded by modern alternatives",
  },
};

/**
 * Get alternatives for a package
 */
export function getAlternatives(
  packageName: string,
): { alternatives: string[]; recommended: string; reason: string } | undefined {
  return PACKAGE_ALTERNATIVES[packageName];
}
