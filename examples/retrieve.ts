import {
  CKBFS,
  NetworkType,
  ProtocolVersion,
  ProtocolVersionType,
  CKBFSDataType,
  CKBFSData,
  decodeWitnessContent,
  decodeMultipleWitnessContents,
  extractFileFromWitnesses,
  decodeFileFromWitnessData,
  saveFileFromWitnessData,
  getFileContentFromChain,
  saveFileFromChain,
  getFileContentFromChainByTypeId,
  saveFileFromChainByTypeId,
  decodeFileFromChainByTypeId,
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
  parseIdentifier,
  IdentifierType,
} from "../src/index";
import { Script, ClientPublicTestnet, Transaction, ccc } from "@ckb-ccc/core";

// Replace with your actual private key (optional for this example)
const privateKey = process.env.CKB_PRIVATE_KEY || "your-private-key-here";

// Parse command line arguments for transaction hash
const txHashArg = process.argv.find((arg) => arg.startsWith("--txhash="));
const targetTxHash = txHashArg
  ? txHashArg.split("=")[1]
  : process.env.TARGET_TX_HASH ||
    "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
function ensureHexPrefix(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return `0x${value}` as `0x${string}`;
}

// Initialize CKB client for testnet
const client = new ClientPublicTestnet();

/**
 * Example of retrieving and decoding file content using traditional blockchain method
 */
async function traditionalRetrieveExample() {
  console.log("=== Traditional Blockchain Retrieval Method ===");

  try {
    // Get transaction from blockchain
    const txWithStatus = await client.getTransaction(targetTxHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${targetTxHash} not found`);
    }

    const tx = Transaction.from(txWithStatus.transaction);
    console.log(`Transaction found with ${tx.outputs.length} outputs`);

    // Find CKBFS cell (first output with type script)
    const ckbfsCellIndex = 0;
    const output = tx.outputs[ckbfsCellIndex];
    if (!output || !output.type) {
      throw new Error("No CKBFS cell found in the transaction");
    }

    // Get and parse output data
    const outputData = tx.outputsData[ckbfsCellIndex];
    if (!outputData) {
      throw new Error("Output data not found");
    }

    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    // Try both protocol versions for unpacking
    let ckbfsData: CKBFSDataType;
    let version: ProtocolVersionType;

    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
      version = ProtocolVersion.V2;
    } catch (error) {
      console.log("Failed to unpack as V2, trying V1...");
      try {
        ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
        version = ProtocolVersion.V1;
      } catch (v1Error) {
        throw new Error(
          `Failed to unpack CKBFS data with both versions: V2(${error}), V1(${v1Error})`,
        );
      }
    }

    console.log(`Successfully unpacked CKBFS data using ${version}:`);
    console.log(`- Filename: ${ckbfsData.filename}`);
    console.log(`- Content Type: ${ckbfsData.contentType}`);
    console.log(`- Checksum: ${ckbfsData.checksum}`);
    console.log(`- Backlinks: ${ckbfsData.backLinks?.length || 0}`);

    // Retrieve complete file content using traditional method
    const outPoint = { txHash: targetTxHash, index: ckbfsCellIndex };
    const content = await getFileContentFromChain(client, outPoint, ckbfsData);

    // Save file using traditional method
    const savedPath = saveFileFromChain(
      content,
      ckbfsData,
      `./traditional_${ckbfsData.filename}`,
    );

    console.log(`Traditional method completed. File saved to: ${savedPath}`);
    console.log(`File size: ${content.length} bytes`);

    return { ckbfsData, tx, content };
  } catch (error) {
    console.error("Traditional retrieval failed:", error);
    throw error;
  }
}

/**
 * Example of decoding file content directly from witnesses (new method)
 */
async function directWitnessDecodingExample() {
  console.log("\n=== Direct Witness Decoding Method (New) ===");

  try {
    // Get transaction from blockchain
    const txWithStatus = await client.getTransaction(targetTxHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${targetTxHash} not found`);
    }

    const tx = Transaction.from(txWithStatus.transaction);

    // Get CKBFS data to know which witnesses contain content
    const outputData = tx.outputsData[0];
    if (!outputData) {
      throw new Error("Output data not found");
    }

    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    let ckbfsData: CKBFSDataType;
    let version: ProtocolVersionType;

    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
      version = ProtocolVersion.V2;
    } catch (error) {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
      version = ProtocolVersion.V1;
    }

    console.log(`Using protocol ${version} for witness decoding`);

    // Get witness indexes from CKBFS data
    const indexes =
      ckbfsData.indexes ||
      (ckbfsData.index !== undefined ? [ckbfsData.index] : []);
    console.log(`Content witness indexes: ${indexes.join(", ")}`);

    // Example 1: Decode individual witnesses
    console.log("\n--- Example 1: Decode Individual Witnesses ---");
    for (const idx of indexes) {
      if (idx < tx.witnesses.length) {
        const decoded = decodeWitnessContent(tx.witnesses[idx]);
        if (decoded) {
          console.log(
            `Witness ${idx}: ${decoded.content.length} bytes, valid: ${decoded.isValid}`,
          );
        } else {
          console.log(`Witness ${idx}: Not a valid CKBFS witness`);
        }
      }
    }

    // Example 2: Decode multiple witnesses at once
    console.log("\n--- Example 2: Decode Multiple Witnesses ---");
    const relevantWitnesses = indexes
      .map((idx) => tx.witnesses[idx])
      .filter(Boolean);
    const combinedContent = decodeMultipleWitnessContents(
      relevantWitnesses,
      true,
    );
    console.log(
      `Combined content from ${relevantWitnesses.length} witnesses: ${combinedContent.length} bytes`,
    );

    // Example 3: Extract file using witness indexes
    console.log("\n--- Example 3: Extract File Using Indexes ---");
    const extractedContent = extractFileFromWitnesses(tx.witnesses, indexes);
    console.log(`Extracted content: ${extractedContent.length} bytes`);

    // Example 4: High-level decode with metadata
    console.log("\n--- Example 4: High-level Decode with Metadata ---");
    const decodedFile = decodeFileFromWitnessData({
      witnesses: tx.witnesses,
      indexes: indexes,
      filename: ckbfsData.filename,
      contentType: ckbfsData.contentType,
    });

    console.log(`Decoded file:`);
    console.log(`- Filename: ${decodedFile.filename}`);
    console.log(`- Content Type: ${decodedFile.contentType}`);
    console.log(`- Size: ${decodedFile.size} bytes`);

    // Example 5: Save file directly from witness data
    console.log("\n--- Example 5: Save File from Witness Data ---");
    const savedPath = saveFileFromWitnessData(
      {
        witnesses: tx.witnesses,
        indexes: indexes,
        filename: ckbfsData.filename,
        contentType: ckbfsData.contentType,
      },
      `./direct_${ckbfsData.filename}`,
    );

    console.log(
      `Direct witness decoding completed. File saved to: ${savedPath}`,
    );

    return { decodedFile, extractedContent };
  } catch (error) {
    console.error("Direct witness decoding failed:", error);
    throw error;
  }
}

/**
 * Example of handling backlinks with direct witness decoding
 */
async function backlinksDecodingExample() {
  console.log("\n=== Backlinks Decoding Example ===");

  try {
    // Get main transaction
    const txWithStatus = await client.getTransaction(targetTxHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${targetTxHash} not found`);
    }

    const tx = Transaction.from(txWithStatus.transaction);
    const outputData = tx.outputsData[0];
    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    let ckbfsData: CKBFSDataType;
    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
    } catch (error) {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
    }

    console.log(`Found ${ckbfsData.backLinks?.length || 0} backlinks`);

    if (ckbfsData.backLinks && ckbfsData.backLinks.length > 0) {
      // Process each backlink
      for (let i = 0; i < ckbfsData.backLinks.length; i++) {
        const backlink = ckbfsData.backLinks[i];
        console.log(`\nProcessing backlink ${i + 1}:`);
        console.log(`- Transaction: ${backlink.txHash}`);
        console.log(`- Checksum: ${backlink.checksum}`);

        try {
          // Get backlink transaction
          const backTxWithStatus = await client.getTransaction(backlink.txHash);
          if (backTxWithStatus && backTxWithStatus.transaction) {
            const backTx = Transaction.from(backTxWithStatus.transaction);

            // Get backlink indexes
            const backIndexes =
              backlink.indexes ||
              (backlink.index !== undefined ? [backlink.index] : []);
            console.log(`- Witness indexes: ${backIndexes.join(", ")}`);

            // Decode content from backlink witnesses
            const backlinkContent = extractFileFromWitnesses(
              backTx.witnesses,
              backIndexes,
            );
            console.log(`- Content size: ${backlinkContent.length} bytes`);

            // Save backlink content
            const backlinkPath = `./backlink_${i + 1}_content.bin`;
            require("fs").writeFileSync(backlinkPath, backlinkContent);
            console.log(`- Saved to: ${backlinkPath}`);
          }
        } catch (error) {
          console.warn(`Failed to process backlink ${i + 1}: ${error}`);
        }
      }
    } else {
      console.log("No backlinks found in this file");
    }
  } catch (error) {
    console.error("Backlinks decoding failed:", error);
    throw error;
  }
}

/**
 * Example of retrieving files using generic identifiers (new method)
 */
async function genericIdentifierRetrievalExample() {
  console.log("\n=== Generic Identifier Retrieval Example ===");

  try {
    // Get transaction to extract TypeID from it
    const txWithStatus = await client.getTransaction(targetTxHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${targetTxHash} not found`);
    }

    const tx = Transaction.from(txWithStatus.transaction);

    // Find CKBFS cell (first output with type script)
    const ckbfsCellIndex = 0;
    const output = tx.outputs[ckbfsCellIndex];
    if (!output || !output.type) {
      throw new Error("No CKBFS cell found in the transaction");
    }

    // Extract TypeID from the type script args
    const typeId = output.type.args;
    console.log(`Extracted TypeID: ${typeId}`);

    if (!typeId || typeId === "0x") {
      console.log(
        "No TypeID found in this transaction, skipping identifier examples",
      );
      return;
    }

    // Create different identifier formats for demonstration
    const identifiers = [
      typeId, // Pure TypeID hex string
      `ckbfs://${typeId.slice(2)}`, // CKBFS URI with TypeID
      `ckbfs://${targetTxHash.slice(2)}i${ckbfsCellIndex}`, // CKBFS URI with outPoint
    ];

    console.log("\nTesting different identifier formats:");
    identifiers.forEach((id, index) => {
      const parsed = parseIdentifier(id);
      console.log(`${index + 1}. ${id}`);
      console.log(`   Type: ${parsed.type}`);
      if (parsed.typeId) console.log(`   TypeID: ${parsed.typeId}`);
      if (parsed.txHash)
        console.log(`   TxHash: ${parsed.txHash}, Index: ${parsed.index}`);
    });

    // Example 1: Get file content using generic identifier (traditional method with backlinks)
    console.log(
      "\n--- Example 1: Get File Content by Generic Identifier (Traditional) ---",
    );

    // Test with TypeID format
    const fileData = await getFileContentFromChainByIdentifier(
      client,
      identifiers[0],
      {
        network: "testnet",
        version: ProtocolVersion.V2,
        useTypeID: false,
      },
    );

    if (fileData) {
      console.log(`Retrieved file: ${fileData.filename}`);
      console.log(`Content type: ${fileData.contentType}`);
      console.log(`Size: ${fileData.size} bytes`);
      console.log(`Checksum: ${fileData.checksum}`);
      console.log(`Backlinks: ${fileData.backLinks.length}`);
      console.log(`Parsed identifier type: ${fileData.parsedId.type}`);
    } else {
      console.log("File not found by identifier");
      return;
    }

    // Example 2: Test all identifier formats
    console.log("\n--- Example 2: Test All Identifier Formats ---");
    for (let i = 0; i < identifiers.length; i++) {
      const identifier = identifiers[i];
      console.log(`\nTesting identifier ${i + 1}: ${identifier}`);

      try {
        const testData = await getFileContentFromChainByIdentifier(
          client,
          identifier,
          {
            network: "testnet",
            version: ProtocolVersion.V2,
            useTypeID: false,
          },
        );

        if (testData) {
          console.log(
            `✓ Success: ${testData.filename} (${testData.size} bytes)`,
          );
          console.log(`  Parsed as: ${testData.parsedId.type}`);
        } else {
          console.log(`✗ Failed: File not found`);
        }
      } catch (error) {
        console.log(`✗ Error: ${error}`);
      }
    }

    // Example 3: Save file using CKBFS URI format
    console.log("\n--- Example 3: Save File using CKBFS URI ---");
    const savedPath = await saveFileFromChainByIdentifier(
      client,
      identifiers[1], // Use CKBFS URI format
      `./identifier_${fileData.filename}`,
      {
        network: "testnet",
        version: ProtocolVersion.V2,
        useTypeID: false,
      },
    );

    if (savedPath) {
      console.log(`File saved via identifier to: ${savedPath}`);
    }

    // Example 4: Decode file using outPoint format with direct witness method
    console.log(
      "\n--- Example 4: Decode File using OutPoint Format (Direct Witness) ---",
    );
    const decodedData = await decodeFileFromChainByIdentifier(
      client,
      identifiers[2],
      {
        network: "testnet",
        version: ProtocolVersion.V2,
        useTypeID: false,
      },
    );

    if (decodedData) {
      console.log(`Decoded file: ${decodedData.filename}`);
      console.log(`Content type: ${decodedData.contentType}`);
      console.log(`Size: ${decodedData.size} bytes`);
      console.log(`Checksum: ${decodedData.checksum}`);
      console.log(`Parsed identifier type: ${decodedData.parsedId.type}`);

      // Verify content matches
      const contentMatches =
        Buffer.compare(fileData.content, decodedData.content) === 0;
      console.log(
        `Content verification: ${contentMatches ? "PASSED" : "FAILED"}`,
      );
    }

    console.log("\nGeneric identifier retrieval completed successfully!");
    return { fileData, decodedData, identifiers };
  } catch (error) {
    console.error("Generic identifier retrieval failed:", error);
    throw error;
  }
}

/**
 * Performance comparison between traditional and direct methods
 */
async function performanceComparisonExample() {
  console.log("\n=== Performance Comparison ===");

  try {
    // Traditional method timing
    const traditionalStart = Date.now();
    const traditionalResult = await traditionalRetrieveExample();
    const traditionalTime = Date.now() - traditionalStart;

    // Direct method timing
    const directStart = Date.now();
    const directResult = await directWitnessDecodingExample();
    const directTime = Date.now() - directStart;

    console.log("\n--- Performance Results ---");
    console.log(`Traditional method: ${traditionalTime}ms`);
    console.log(`Direct witness method: ${directTime}ms`);
    console.log(
      `Performance improvement: ${(((traditionalTime - directTime) / traditionalTime) * 100).toFixed(1)}%`,
    );

    // Verify content matches
    const contentMatches =
      Buffer.compare(
        traditionalResult.content,
        directResult.extractedContent,
      ) === 0;
    console.log(
      `Content verification: ${contentMatches ? "PASSED" : "FAILED"}`,
    );
  } catch (error) {
    console.error("Performance comparison failed:", error);
  }
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log("Running CKBFS retrieve and witness decoding examples...");
  console.log("=========================================================");
  console.log(`Target transaction: ${targetTxHash}`);

  // Validate transaction hash
  if (
    targetTxHash ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    console.error(
      "Please provide a valid transaction hash by setting the TARGET_TX_HASH environment variable or using --txhash=0x... argument",
    );
    console.log("\nExample usage:");
    console.log("  npm run example:retrieve -- --txhash=0x123456...");
    console.log("  TARGET_TX_HASH=0x123456... npm run example:retrieve");
    process.exit(1);
  }

  try {
    // Run traditional method
    await traditionalRetrieveExample();

    // Run new direct witness decoding methods
    await directWitnessDecodingExample();

    // Handle backlinks if present
    await backlinksDecodingExample();

    // Run generic identifier-based retrieval examples
    await genericIdentifierRetrievalExample();

    console.log("\n=== Summary ===");
    console.log("All examples completed successfully!");
    console.log("\nKey advantages of direct witness decoding:");
    console.log("- No need for recursive blockchain queries");
    console.log("- Faster performance for simple cases");
    console.log("- More control over witness processing");
    console.log("- Useful for offline processing with cached data");
    console.log("\nTraditional method advantages:");
    console.log("- Automatic backlink following");
    console.log("- Complete file reconstruction");
    console.log("- Built-in error handling for complex cases");
    console.log("\nGeneric identifier method advantages:");
    console.log("- Flexible input formats (TypeID, CKBFS URIs, outPoint)");
    console.log("- Simple interface - works with any identifier format");
    console.log("- No need to know specific format beforehand");
    console.log("- Automatic format detection and parsing");
    console.log("- Works with both traditional and direct witness decoding");

    process.exit(0);
  } catch (error) {
    console.error("Examples failed:", error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
