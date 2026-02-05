# packrun.dev

**The npm registry for AI agents**

Automated package comparisons. Real-time scoring. 50+ categories. MCP server for Cursor & Claude.

## Features

- **Automated Comparisons** - 50+ categories with formula-based scoring
- **Real-time Metrics** - Downloads, bundle size, maintenance, all live
- **Alternative Discovery** - Find what to use instead of any package
- **MCP Server** - Native integration with AI coding assistants
- **Sub-50ms Search** - Powered by Typesense Cloud

## How Scoring Works

Packages are scored automatically (0-100) based on:

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Downloads | 20% | Weekly downloads + trend direction |
| Bundle Size | 20% | Smaller gzip = higher score |
| Freshness | 25% | Recent commits and releases |
| Community | 10% | Stars, contributors |
| Quality | 25% | TypeScript, ESM, security, tree-shaking |

## Project Structure

```
packrun.dev/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── sync/         # Data sync worker
│   └── mcp-server/   # MCP server for AI agents
├── packages/
│   ├── decisions/    # Scoring, categories, comparison engine
│   ├── agent-utils/  # Conflict detection
│   └── ui/           # Shared components
└── turbo.json
```

## MCP Server

For AI coding assistants (Cursor, Claude, etc.):

**Endpoint**: `https://mcp.packrun.dev/mcp`

**Configuration** (for Cursor, Claude Desktop, etc.):
```json
{
  "mcpServers": {
    "packrun": {
      "url": "https://mcp.packrun.dev/mcp"
    }
  }
}
```

**Tools:**

| Tool | Description |
|------|-------------|
| `search_packages` | Search npm packages |
| `get_package` | Get package metadata |
| `get_package_health` | Check maintenance status |
| `compare_packages` | Compare packages with scoring |
| `find_alternatives` | Find alternatives to any package |
| `get_comparison_category` | Get category comparison (e.g., "date-library") |
| `list_comparison_categories` | List all 50+ categories |
| `validate_install` | Check compatibility before installing |

## API

### Compare Packages

```bash
# Compare specific packages
GET /api/compare?packages=axios,got,ky

# Get category comparison
GET /api/compare?category=date-library

# Find alternatives for a package
GET /api/compare?package=moment

# List all categories
GET /api/compare?list=categories
```

### Response Example

```json
{
  "category": "date-library",
  "recommendation": "date-fns",
  "smallestBundle": "dayjs",
  "mostPopular": "moment",
  "packages": [
    {
      "name": "date-fns",
      "score": 82,
      "badges": ["TypeScript", "ESM", "Trending Up"],
      "metrics": {
        "weeklyDownloads": 20000000,
        "downloadTrend": "growing",
        "bundleSizeKb": "13.2kb",
        "lastCommitDays": 2,
        "hasTypes": true
      }
    },
    ...
  ]
}
```

## Categories

50+ categories including:

- **HTTP clients**: axios, got, ky, node-fetch
- **Date libraries**: moment, date-fns, dayjs, luxon
- **Validation**: zod, yup, joi, ajv, valibot
- **State management**: redux, zustand, jotai, recoil
- **ORM**: prisma, drizzle, typeorm, sequelize
- **Testing**: vitest, jest, mocha, ava
- **Bundlers**: vite, esbuild, webpack, rollup
- **Logging**: pino, winston, bunyan
- And 40+ more...

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Typesense Cloud](https://cloud.typesense.org) account
- Redis instance

### Installation

```bash
git clone https://github.com/your-org/packrun.dev
cd packrun.dev
bun install
```

### Development

```bash
bun run dev:web    # Web app on :3000
bun run dev:sync   # Sync worker
```

### Environment Variables

```bash
# Typesense
TYPESENSE_HOST=xxx.typesense.net
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_API_KEY=xxx

# Optional: GitHub token for higher rate limits
GITHUB_TOKEN=xxx
```

## License

MIT
