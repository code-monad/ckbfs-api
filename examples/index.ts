import { CKBFS, NetworkType, ProtocolVersion } from "../src/index";

/**
 * Main CKBFS Examples
 *
 * This file serves as the entry point for running all CKBFS SDK examples.
 *
 * To run all examples:
 *   npm run example
 *
 * To run specific examples:
 *   npm run example:publish
 *   npm run example:append -- --txhash=0x123456...
 */

console.log("CKBFS SDK Examples");
console.log("=================");
console.log("");
console.log("Available examples:");
console.log("1. Publish File Example - npm run example:publish");
console.log(
  "2. Append File Example  - npm run example:append -- --txhash=0x123456...",
);
console.log(
  "3. Retrieve File Example - npm run example:retrieve -- --txhash=0x123456...",
);
console.log("");
console.log("Run all examples with: npm run example");
console.log("");
console.log(
  "Note: For the append and retrieve examples, you need to provide a transaction hash",
);
console.log("of a previously published file using the --txhash parameter or");
console.log(
  "by setting the PUBLISH_TX_HASH/TARGET_TX_HASH environment variable.",
);
console.log("");

// Check if we should run all examples
const runAll = process.argv.includes("--all");

if (runAll) {
  console.log(
    "Running all examples is not recommended. Please run specific examples instead.",
  );
  console.log("");
  console.log("For example:");
  console.log("  npm run example:publish");
  console.log("  npm run example:append -- --txhash=0x123456...");
  console.log("  npm run example:retrieve -- --txhash=0x123456...");
  process.exit(1);
}

// Default behavior - just show instructions
console.log("For more information, see the README.md file.");
