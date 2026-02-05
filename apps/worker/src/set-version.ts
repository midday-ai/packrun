/**
 * Set Package Version in Typesense
 *
 * Utility to manually set a package's version for testing notifications.
 *
 * Usage: bun run src/set-version.ts ai 5.0.0
 */

import { typesenseClient } from "./clients";
import { config } from "./config";

async function main() {
  const packageName = process.argv[2];
  const version = process.argv[3];

  if (!packageName || !version) {
    console.error("Usage: bun run src/set-version.ts <package-name> <version>");
    console.error("Example: bun run src/set-version.ts ai 5.0.0");
    process.exit(1);
  }

  console.log(`Setting ${packageName} version to ${version} in Typesense...`);

  try {
    const collection = typesenseClient.collections(config.typesense.collectionName);
    await collection.documents(packageName).update({ version });

    console.log(`✅ Done! ${packageName} version is now ${version}`);
  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  }
}

main();
