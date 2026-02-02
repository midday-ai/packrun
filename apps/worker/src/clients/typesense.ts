/**
 * Typesense Client
 *
 * Client for indexing and searching packages in Typesense.
 */

import Typesense from "typesense";
import { config } from "../config";

export const typesenseClient = new Typesense.Client({
  nearestNode: { ...config.typesense.nearestNode },
  nodes: config.typesense.nodes.map((n) => ({ ...n })),
  apiKey: config.typesense.apiKey,
  connectionTimeoutSeconds: 10,
  retryIntervalSeconds: 0.1,
  healthcheckIntervalSeconds: 60,
});

export const packageSchema = {
  name: config.typesense.collectionName,
  fields: [
    // Core fields
    { name: "name", type: "string" as const, facet: true },
    { name: "description", type: "string" as const, optional: true },
    { name: "keywords", type: "string[]" as const, facet: true, optional: true },
    { name: "author", type: "string" as const, facet: true, optional: true },
    { name: "version", type: "string" as const },
    { name: "license", type: "string" as const, facet: true, optional: true },
    { name: "homepage", type: "string" as const, optional: true },
    { name: "repository", type: "string" as const, optional: true },
    { name: "downloads", type: "int64" as const, sort: true },
    { name: "updated", type: "int64" as const, sort: true },
    { name: "created", type: "int64" as const, sort: true },
    { name: "hasTypes", type: "bool" as const, facet: true },
    { name: "isESM", type: "bool" as const, facet: true },
    { name: "isCJS", type: "bool" as const, facet: true },
    { name: "dependencies", type: "int32" as const },
    { name: "maintainers", type: "string[]" as const, optional: true },
    { name: "nodeVersion", type: "string" as const, optional: true },
    { name: "peerDependencies", type: "string" as const, optional: true },
    { name: "directDependencies", type: "string" as const, optional: true },
    { name: "deprecated", type: "bool" as const, facet: true },
    { name: "deprecatedMessage", type: "string" as const, optional: true },
    { name: "maintenanceScore", type: "float" as const, optional: true },
    { name: "vulnerabilities", type: "int32" as const, optional: true },
    { name: "vulnCritical", type: "int32" as const, optional: true },
    { name: "vulnHigh", type: "int32" as const, optional: true },
    { name: "hasInstallScripts", type: "bool" as const, facet: true, optional: true },
    { name: "stars", type: "int32" as const, sort: true, optional: true },
    { name: "dependents", type: "int32" as const, sort: true, optional: true },
    { name: "typesPackage", type: "string" as const, optional: true },
    { name: "funding", type: "string" as const, optional: true },

    // NEW: Fields for search/filter (~10 new fields)
    // Category-based alternative discovery
    { name: "inferredCategory", type: "string" as const, facet: true, optional: true },
    // Module format filtering (esm/cjs/dual/unknown)
    { name: "moduleFormat", type: "string" as const, facet: true, optional: true },
    // CLI vs library filtering
    { name: "hasBin", type: "bool" as const, facet: true, optional: true },
    // License compliance filtering (permissive/copyleft/proprietary/unknown)
    { name: "licenseType", type: "string" as const, facet: true, optional: true },
    // Security filtering - npm attestations present
    { name: "hasProvenance", type: "bool" as const, facet: true, optional: true },
    // Size filtering (bytes)
    { name: "unpackedSize", type: "int64" as const, sort: true, optional: true },
    // Stability filtering (version >= 1.0.0)
    { name: "isStable", type: "bool" as const, facet: true, optional: true },
    // Author discovery - GitHub org/username
    { name: "authorGithub", type: "string" as const, facet: true, optional: true },
  ],
  default_sorting_field: "downloads",
  enable_nested_fields: false,
};

export interface PackageDocument {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  author?: string;
  version: string;
  license?: string;
  homepage?: string;
  repository?: string;
  downloads: number;
  updated: number;
  created: number;
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  dependencies: number;
  maintainers?: string[];
  nodeVersion?: string;
  peerDependencies?: string;
  directDependencies?: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
  maintenanceScore?: number;
  vulnerabilities?: number;
  vulnCritical?: number;
  vulnHigh?: number;
  hasInstallScripts?: boolean;
  stars?: number;
  dependents?: number;
  typesPackage?: string;
  funding?: string;

  /** Inferred category for alternative discovery (e.g., 'http-client', 'validation') */
  inferredCategory?: string;
  /** Module format: 'esm' | 'cjs' | 'dual' | 'unknown' */
  moduleFormat?: string;
  /** Is it a CLI package? */
  hasBin?: boolean;
  /** License type: 'permissive' | 'copyleft' | 'proprietary' | 'unknown' */
  licenseType?: string;
  /** Has npm provenance/attestations? */
  hasProvenance?: boolean;
  /** Unpacked size in bytes */
  unpackedSize?: number;
  /** Is stable (version >= 1.0.0)? */
  isStable?: boolean;
  /** GitHub org/username from repository URL */
  authorGithub?: string;
}

export async function ensureCollection() {
  try {
    const existing = await typesenseClient.collections(config.typesense.collectionName).retrieve();
    console.log(`Collection "${config.typesense.collectionName}" already exists`);

    const existingFieldNames = new Set(existing.fields?.map((f) => f.name) || []);
    const newFields = packageSchema.fields.filter((f) => !existingFieldNames.has(f.name));

    if (newFields.length > 0) {
      console.log(`Adding ${newFields.length} new fields to collection...`);
      for (const field of newFields) {
        try {
          await typesenseClient.collections(config.typesense.collectionName).update({
            fields: [field],
          });
          console.log(`  Added field: ${field.name}`);
        } catch (e) {
          console.log(`  Field ${field.name} may already exist`);
        }
      }
    }
  } catch (error) {
    console.log(`Creating collection "${config.typesense.collectionName}"...`);
    await typesenseClient.collections().create(packageSchema);
    console.log(`Collection created successfully`);
  }
}

export async function upsertPackages(packages: PackageDocument[]) {
  if (packages.length === 0) return;

  const results = await typesenseClient
    .collections(config.typesense.collectionName)
    .documents()
    .import(packages, { action: "upsert" });

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.error(`Failed to upsert ${failed.length} packages:`, failed.slice(0, 5));
  }

  return results;
}

export async function deletePackage(name: string) {
  try {
    await typesenseClient.collections(config.typesense.collectionName).documents(name).delete();
  } catch (error) {
    // Package might not exist, ignore
  }
}

export async function getDocument(name: string): Promise<PackageDocument | null> {
  try {
    const doc = await typesenseClient
      .collections(config.typesense.collectionName)
      .documents(name)
      .retrieve();
    return doc as PackageDocument;
  } catch {
    return null;
  }
}
