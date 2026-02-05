/**
 * README rendering utilities for pre-indexing package READMEs.
 * Shared package used by both sync and web apps.
 */

import emojiRegex from "emoji-regex";
import { marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// =============================================================================
// Shiki Highlighter
// =============================================================================

let highlighter: HighlighterCore | null = null;

async function getShikiHighlighter(): Promise<HighlighterCore> {
  if (!highlighter) {
    highlighter = await createHighlighterCore({
      themes: [import("@shikijs/themes/github-dark"), import("@shikijs/themes/github-light")],
      langs: [
        // Core web languages
        import("@shikijs/langs/javascript"),
        import("@shikijs/langs/typescript"),
        import("@shikijs/langs/json"),
        import("@shikijs/langs/jsonc"),
        import("@shikijs/langs/html"),
        import("@shikijs/langs/css"),
        import("@shikijs/langs/scss"),
        import("@shikijs/langs/less"),
        // Frameworks
        import("@shikijs/langs/vue"),
        import("@shikijs/langs/jsx"),
        import("@shikijs/langs/tsx"),
        import("@shikijs/langs/svelte"),
        // Shell/CLI
        import("@shikijs/langs/bash"),
        import("@shikijs/langs/shell"),
        // Config/Data formats
        import("@shikijs/langs/yaml"),
        import("@shikijs/langs/toml"),
        import("@shikijs/langs/xml"),
        import("@shikijs/langs/markdown"),
        // Other languages
        import("@shikijs/langs/diff"),
        import("@shikijs/langs/sql"),
        import("@shikijs/langs/graphql"),
        import("@shikijs/langs/python"),
        import("@shikijs/langs/rust"),
        import("@shikijs/langs/go"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighter;
}

function highlightCodeSync(shiki: HighlighterCore, code: string, language: string): string {
  const loadedLangs = shiki.getLoadedLanguages();

  if (loadedLangs.includes(language as never)) {
    try {
      let html = shiki.codeToHtml(code, {
        lang: language,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: "dark",
      });
      // Remove inline style from <pre> tag so CSS can control appearance
      html = html.replace(/<pre([^>]*)\s+style="[^"]*"/, "<pre$1");
      return escapeRawGt(html);
    } catch {
      // Fall back to plain
    }
  }

  // Plain code block for unknown languages
  const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre><code class="language-${language}">${escaped}</code></pre>\n`;
}

function escapeRawGt(html: string): string {
  return html.replace(/>([^<]*)/g, (match, textContent) => {
    const escapedText = textContent.replace(/>/g, "&gt;");
    return `>${escapedText}`;
  });
}

// =============================================================================
// Repository Info Parsing
// =============================================================================

export interface RepositoryInfo {
  provider: string;
  owner: string;
  repo: string;
  rawBaseUrl: string;
  directory?: string;
}

export function parseRepositoryInfo(
  repository?: { type?: string; url?: string; directory?: string } | string,
): RepositoryInfo | undefined {
  if (!repository) return undefined;

  let url: string | undefined;
  let directory: string | undefined;

  if (typeof repository === "string") {
    url = repository;
  } else {
    url = repository.url;
    directory = repository.directory;
  }

  if (!url) return undefined;

  // Normalize git URL
  const normalized = url
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");

  // Handle SCP-style URLs: git@host:path
  let parsedUrl: URL;
  try {
    if (!/^https?:\/\//i.test(normalized)) {
      const scp = normalized.match(/^(?:git@)?([^:/]+):(.+)$/i);
      if (scp?.[1] && scp?.[2]) {
        parsedUrl = new URL(`https://${scp[1]}/${scp[2]}`);
      } else {
        return undefined;
      }
    } else {
      parsedUrl = new URL(normalized);
    }
  } catch {
    return undefined;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const parts = parsedUrl.pathname.split("/").filter(Boolean);

  if (parts.length < 2) return undefined;

  const owner = decodeURIComponent(parts[0] ?? "").trim();
  const repo = decodeURIComponent(parts[1] ?? "")
    .trim()
    .replace(/\.git$/i, "");

  if (!owner || !repo) return undefined;

  // Determine provider and raw URL base
  let provider = "github";
  let rawBaseUrl = "";

  if (host === "github.com" || host === "www.github.com") {
    provider = "github";
    rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;
  } else if (host.includes("gitlab")) {
    provider = "gitlab";
    rawBaseUrl = `https://${host}/${owner}/${repo}/-/raw/HEAD`;
  } else if (host === "bitbucket.org") {
    provider = "bitbucket";
    rawBaseUrl = `https://bitbucket.org/${owner}/${repo}/raw/HEAD`;
  } else {
    // Default to GitHub-style for unknown hosts
    rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;
  }

  return {
    provider,
    owner,
    repo,
    rawBaseUrl,
    directory: directory?.replace(/\/$/, ""),
  };
}

// =============================================================================
// HTML Sanitization Config
// =============================================================================

const ALLOWED_TAGS = [
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "strong",
  "em",
  "del",
  "s",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  // Images disabled - agents need text content, not images
  // "img",
  // "picture",
  // "source",
  "details",
  "summary",
  "div",
  "span",
  "sup",
  "sub",
  "kbd",
  "mark",
];

const ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  // Images disabled
  // img: ["src", "alt", "title", "width", "height"],
  // source: ["src", "srcset", "type", "media"],
  th: ["colspan", "rowspan", "align"],
  td: ["colspan", "rowspan", "align"],
  h3: ["id", "data-level"],
  h4: ["id", "data-level"],
  h5: ["id", "data-level"],
  h6: ["id", "data-level"],
  blockquote: ["data-callout"],
  details: ["open"],
  code: ["class"],
  pre: ["class", "style"],
  span: ["class", "style"],
  div: ["class", "style", "align"],
};

// =============================================================================
// URL Resolution
// =============================================================================

function hasProtocol(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) || url.startsWith("//");
}

function resolveUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  if (!url) return url;
  if (url.startsWith("#")) {
    return `#user-content-${url.slice(1)}`;
  }

  if (hasProtocol(url)) {
    try {
      const parsed = new URL(url, "https://example.com");
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return url;
      }
    } catch {
      // Invalid URL, fall through
    }
    if (url.startsWith("//")) {
      return url;
    }
  }

  // Use provider's raw URL base when repository info is available
  if (repoInfo?.rawBaseUrl) {
    let relativePath = url.replace(/^\.\//, "");

    if (repoInfo.directory) {
      const dirParts = repoInfo.directory.split("/").filter(Boolean);
      while (relativePath.startsWith("../")) {
        relativePath = relativePath.slice(3);
        dirParts.pop();
      }
      if (dirParts.length > 0) {
        relativePath = `${dirParts.join("/")}/${relativePath}`;
      }
    }

    return `${repoInfo.rawBaseUrl}/${relativePath}`;
  }

  // Fallback to jsdelivr CDN
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, "")}`;
}

// =============================================================================
// Slug Generation
// =============================================================================

function slugify(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// =============================================================================
// Emoji Stripping
// =============================================================================

const emojiRegexPattern = emojiRegex();

/**
 * Strip emojis from HTML, but preserve code blocks
 */
function stripEmojisFromHtml(html: string): string {
  // Split HTML into parts: code blocks and everything else
  const codeBlockRegex = /<pre[^>]*>[\s\S]*?<\/pre>/gi;
  const codeInlineRegex = /<code[^>]*>[\s\S]*?<\/code>/gi;

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract code blocks and inline code
  let processed = html.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  processed = processed.replace(codeInlineRegex, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // Strip emojis from non-code content
  processed = processed.replace(emojiRegexPattern, "");
  processed = processed.replace(/:([a-z0-9_+-]+):/gi, "");

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, block);
  });

  inlineCodes.forEach((code, i) => {
    processed = processed.replace(`__INLINE_CODE_${i}__`, code);
  });

  return processed;
}

// =============================================================================
// Main README Renderer
// =============================================================================

export interface ReadmeRenderResult {
  html: string;
}

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
): Promise<ReadmeRenderResult> {
  if (!content) return { html: "" };

  const shiki = await getShikiHighlighter();
  const renderer = new marked.Renderer();

  const usedSlugs = new Map<string, number>();
  let lastSemanticLevel = 2;

  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    let semanticLevel: number;
    if (depth === 1) {
      semanticLevel = 3;
    } else {
      const maxAllowed = Math.min(lastSemanticLevel + 1, 6);
      semanticLevel = Math.min(depth + 2, maxAllowed);
    }

    lastSemanticLevel = semanticLevel;
    const text = this.parser.parseInline(tokens);

    let slug = slugify(text);
    if (!slug) slug = "heading";

    const count = usedSlugs.get(slug) ?? 0;
    usedSlugs.set(slug, count + 1);
    const uniqueSlug = count === 0 ? slug : `${slug}-${count}`;
    const id = `user-content-${uniqueSlug}`;

    return `<h${semanticLevel} id="${id}" data-level="${depth}">${text}</h${semanticLevel}>\n`;
  };

  renderer.code = ({ text, lang }: Tokens.Code) => {
    return highlightCodeSync(shiki, text, lang || "text");
  };

  // Images disabled - return empty string
  renderer.image = () => {
    return "";
  };

  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const resolvedHref = resolveUrl(href, packageName, repoInfo);
    const text = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${title}"` : "";

    const isExternal = resolvedHref.startsWith("http://") || resolvedHref.startsWith("https://");
    const relAttr = isExternal ? ' rel="nofollow noreferrer noopener"' : "";
    const targetAttr = isExternal ? ' target="_blank"' : "";

    return `<a href="${resolvedHref}"${titleAttr}${relAttr}${targetAttr}>${text}</a>`;
  };

  renderer.blockquote = function ({ tokens }: Tokens.Blockquote) {
    const body = this.parser.parse(tokens);

    const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i);

    if (calloutMatch?.[1]) {
      const calloutType = calloutMatch[1].toLowerCase();
      const cleanedBody = body.replace(calloutMatch[0], "<p>");
      return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`;
    }

    return `<blockquote>${body}</blockquote>\n`;
  };

  marked.setOptions({ renderer });

  const rawHtml = marked.parse(content) as string;

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.href && hasProtocol(attribs.href)) {
          attribs.rel = "nofollow noreferrer noopener";
          attribs.target = "_blank";
        }
        return { tagName, attribs };
      },
    },
  });

  // Strip emojis from HTML, preserving code blocks
  const cleaned = stripEmojisFromHtml(sanitized);

  return {
    html: cleaned,
  };
}

// =============================================================================
// README Fetching
// =============================================================================

const STANDARD_README_FILENAMES = [
  "README.md",
  "readme.md",
  "Readme.md",
  "README",
  "readme",
  "README.markdown",
  "readme.markdown",
];

const STANDARD_README_PATTERN = /^readme(\.md|\.markdown)?$/i;

export interface PackageMetadata {
  name: string;
  readme?: string;
  readmeFilename?: string;
  repository?: { type?: string; url?: string; directory?: string } | string;
  versions?: {
    [version: string]: {
      readme?: string;
      readmeFilename?: string;
    };
  };
  "dist-tags"?: { latest?: string };
}

async function fetchReadmeFromJsdelivr(
  packageName: string,
  version?: string,
): Promise<string | null> {
  const versionSuffix = version ? `@${version}` : "";

  for (const filename of STANDARD_README_FILENAMES) {
    try {
      const url = `https://cdn.jsdelivr.net/npm/${packageName}${versionSuffix}/${filename}`;
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Try next filename
    }
  }

  return null;
}

function isStandardReadme(filename: string | undefined): boolean {
  return !!filename && STANDARD_README_PATTERN.test(filename);
}

/**
 * Fetch README content from a package, trying packument first then jsDelivr fallback.
 */
export async function fetchReadmeContent(
  metadata: PackageMetadata,
  version?: string,
): Promise<string | null> {
  const NPM_MISSING_README_SENTINEL = "ERROR: No README data found!";

  let readmeContent: string | undefined;
  let readmeFilename: string | undefined;

  // If specific version requested, get from version data
  if (version && metadata.versions?.[version]) {
    const versionData = metadata.versions[version];
    readmeContent = versionData?.readme;
    readmeFilename = versionData?.readmeFilename;
  } else {
    // Use packument-level readme
    readmeContent = metadata.readme;
    readmeFilename = metadata.readmeFilename;
  }

  const hasValidNpmReadme = readmeContent && readmeContent !== NPM_MISSING_README_SENTINEL;

  // If no README in packument, or non-standard filename, try jsDelivr
  if (!hasValidNpmReadme || !isStandardReadme(readmeFilename)) {
    const jsdelivrReadme = await fetchReadmeFromJsdelivr(
      metadata.name,
      version || metadata["dist-tags"]?.latest,
    );
    if (jsdelivrReadme) {
      readmeContent = jsdelivrReadme;
    }
  }

  if (!readmeContent || readmeContent === NPM_MISSING_README_SENTINEL) {
    return null;
  }

  return readmeContent;
}

/**
 * Fetch and render README for a package.
 * Returns rendered HTML or null if no README found.
 */
export async function fetchAndRenderReadme(metadata: PackageMetadata): Promise<string | null> {
  const content = await fetchReadmeContent(metadata);
  if (!content) return null;

  const repoInfo = parseRepositoryInfo(metadata.repository);
  const result = await renderReadmeHtml(content, metadata.name, repoInfo);

  return result.html || null;
}
