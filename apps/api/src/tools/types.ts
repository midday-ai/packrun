/**
 * check_types - Check if a package has TypeScript types
 */

import { z } from "zod";
import { getLatestVersion, getPackage } from "../lib/clients/npm";

export const checkTypesSchema = z.object({
  name: z.string().describe("The npm package name to check for TypeScript types"),
});

export type CheckTypesInput = z.infer<typeof checkTypesSchema>;

export interface CheckTypesResult {
  name: string;
  version: string;
  hasTypes: boolean;
  typesPackage: string | null;
  source: "bundled" | "definitely-typed" | "none";
}

export async function checkTypes(input: CheckTypesInput): Promise<CheckTypesResult> {
  const pkg = await getPackage(input.name);

  if (!pkg) {
    throw new Error(`Package '${input.name}' not found`);
  }

  const version = getLatestVersion(pkg);
  const versionData = pkg.versions?.[version];
  const bundledTypes = Boolean(versionData?.types || versionData?.typings);

  // Check if this is itself a @types package
  const isTypesPackage = input.name.startsWith("@types/");

  // Check if @types package exists (we'd need to verify this)
  const typesPackageName = isTypesPackage
    ? null
    : `@types/${input.name.replace("@", "").replace("/", "__")}`;

  let source: "bundled" | "definitely-typed" | "none" = "none";
  let typesPackageExists = false;

  if (bundledTypes || isTypesPackage) {
    source = "bundled";
  } else if (typesPackageName) {
    // Check if @types package exists
    const typesPackage = await getPackage(typesPackageName);
    if (typesPackage) {
      source = "definitely-typed";
      typesPackageExists = true;
    }
  }

  return {
    name: pkg.name,
    version,
    hasTypes: bundledTypes || isTypesPackage || typesPackageExists,
    typesPackage: typesPackageExists ? typesPackageName : null,
    source,
  };
}
