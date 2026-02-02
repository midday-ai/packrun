import Typesense from "typesense";
import { config } from "./config";

export const typesenseClient = new Typesense.Client({
  // Use nearest node (SDN) for geo load-balanced routing
  nearestNode: { ...config.typesense.nearestNode },
  // Individual nodes as fallback
  nodes: config.typesense.nodes.map((n) => ({ ...n })),
  apiKey: config.typesense.apiKey,
  connectionTimeoutSeconds: 10,
  retryIntervalSeconds: 0.1,
  healthcheckIntervalSeconds: 60,
});

export const packageSchema = {
  name: config.typesense.collectionName,
  fields: [
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
    // Agent-optimized fields
    { name: "nodeVersion", type: "string" as const, optional: true },
    { name: "peerDependencies", type: "string" as const, optional: true }, // JSON string
    { name: "directDependencies", type: "string" as const, optional: true }, // JSON string
    { name: "deprecated", type: "bool" as const, facet: true },
    { name: "deprecatedMessage", type: "string" as const, optional: true },
    { name: "maintenanceScore", type: "float" as const, optional: true },
    // Security & quality fields
    { name: "vulnerabilities", type: "int32" as const, optional: true },
    { name: "vulnCritical", type: "int32" as const, optional: true },
    { name: "vulnHigh", type: "int32" as const, optional: true },
    { name: "hasInstallScripts", type: "bool" as const, facet: true, optional: true },
    // Popularity & metadata
    { name: "stars", type: "int32" as const, sort: true, optional: true },
    { name: "dependents", type: "int32" as const, sort: true, optional: true },
    { name: "typesPackage", type: "string" as const, optional: true }, // @types/x package name
    { name: "funding", type: "string" as const, optional: true },
  ],
  default_sorting_field: "downloads",
  enable_nested_fields: false,
};

export interface PackageDocument {
  id: string; // package name
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
  // Agent-optimized fields
  nodeVersion?: string;
  peerDependencies?: string; // JSON string of Record<string, string>
  directDependencies?: string; // JSON string of Record<string, string>
  deprecated?: boolean;
  deprecatedMessage?: string;
  maintenanceScore?: number;
  // Security & quality fields
  vulnerabilities?: number;
  vulnCritical?: number;
  vulnHigh?: number;
  hasInstallScripts?: boolean;
  // Popularity & metadata
  stars?: number;
  dependents?: number;
  typesPackage?: string; // @types/x package name if types not included
  funding?: string;
}

export async function ensureCollection() {
  try {
    const existing = await typesenseClient.collections(config.typesense.collectionName).retrieve();
    console.log(`Collection "${config.typesense.collectionName}" already exists`);

    // Check if we need to add new fields
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
