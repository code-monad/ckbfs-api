import fs from "fs";
import path from "path";
import { ProtocolVersion } from "./constants";
import { extractCKBFSV3WitnessContent } from "./witness";

/**
 * Utility functions for file operations
 */

/**
 * Reads a file from the file system
 * @param filePath The path to the file to read
 * @returns Buffer containing the file contents
 */
export function readFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

/**
 * Reads a file as text from the file system
 * @param filePath The path to the file to read
 * @returns String containing the file contents
 */
export function readFileAsText(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Reads a file as Uint8Array from the file system
 * @param filePath The path to the file to read
 * @returns Uint8Array containing the file contents
 */
export function readFileAsUint8Array(filePath: string): Uint8Array {
  const buffer = fs.readFileSync(filePath);
  return new Uint8Array(buffer);
}

/**
 * Writes data to a file in the file system
 * @param filePath The path to write the file to
 * @param data The data to write to the file
 */
export function writeFile(filePath: string, data: Buffer | string): void {
  // Ensure the directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, data);
}

/**
 * Gets the MIME content type based on file extension
 * @param filePath The path to the file
 * @returns The MIME content type for the file
 */
export function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  const mimeTypes: { [key: string]: string } = {
    ".txt": "text/plain",
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

/**
 * Splits a file into chunks of a specific size
 * @param filePath The path to the file to split
 * @param chunkSize The maximum size of each chunk in bytes
 * @returns Array of Uint8Array chunks
 */
export function splitFileIntoChunks(
  filePath: string,
  chunkSize: number,
): Uint8Array[] {
  const fileBuffer = fs.readFileSync(filePath);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < fileBuffer.length; i += chunkSize) {
    chunks.push(new Uint8Array(fileBuffer.slice(i, i + chunkSize)));
  }

  return chunks;
}

/**
 * Combines chunks into a single file
 * @param chunks Array of chunks to combine
 * @param outputPath The path to write the combined file to
 */
export function combineChunksToFile(
  chunks: Uint8Array[],
  outputPath: string,
): void {
  const combinedBuffer = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
  );
  writeFile(outputPath, combinedBuffer);
}

/**
 * Utility function to safely decode buffer to string
 * @param buffer The buffer to decode
 * @returns Decoded string or placeholder on error
 */
function safelyDecode(buffer: any): string {
  if (!buffer) return "[Unknown]";
  try {
    if (buffer instanceof Uint8Array) {
      return new TextDecoder().decode(buffer);
    } else if (typeof buffer === "string") {
      return buffer;
    } else {
      return `[Buffer: ${buffer.toString()}]`;
    }
  } catch (e) {
    return "[Decode Error]";
  }
}

/**
 * Retrieves complete file content from the blockchain by following backlinks
 * @param client The CKB client to use for blockchain queries
 * @param outPoint The output point of the latest CKBFS cell
 * @param ckbfsData The data from the latest CKBFS cell
 * @returns Promise resolving to the complete file content
 */
export async function getFileContentFromChain(
  client: any,
  outPoint: { txHash: string; index: number },
  ckbfsData: any,
): Promise<Uint8Array> {
  console.log(`Retrieving file: ${safelyDecode(ckbfsData.filename)}`);
  console.log(`Content type: ${safelyDecode(ckbfsData.contentType)}`);

  // Prepare to collect all content pieces
  const contentPieces: Uint8Array[] = [];
  let currentData = ckbfsData;
  let currentOutPoint = outPoint;

  // Process the current transaction first
  const tx = await client.getTransaction(currentOutPoint.txHash);
  if (!tx || !tx.transaction) {
    throw new Error(`Transaction ${currentOutPoint.txHash} not found`);
  }

  // Get content from witnesses
  const indexes =
    currentData.indexes ||
    (currentData.index !== undefined ? [currentData.index] : []);
  if (indexes.length > 0) {
    // Get content from each witness index
    for (const idx of indexes) {
      if (idx >= tx.transaction.witnesses.length) {
        console.warn(`Witness index ${idx} out of range`);
        continue;
      }

      const witnessHex = tx.transaction.witnesses[idx];
      const witness = Buffer.from(witnessHex.slice(2), "hex"); // Remove 0x prefix

      // Extract content (skip CKBFS header + version byte)
      if (witness.length >= 6 && witness.slice(0, 5).toString() === "CKBFS") {
        const content = witness.slice(6);
        contentPieces.unshift(content); // Add to beginning of array (we're going backwards)
      } else {
        console.warn(`Witness at index ${idx} is not a valid CKBFS witness`);
      }
    }
  }

  // Follow backlinks recursively
  if (currentData.backLinks && currentData.backLinks.length > 0) {
    // Process each backlink, from most recent to oldest
    for (let i = currentData.backLinks.length - 1; i >= 0; i--) {
      const backlink = currentData.backLinks[i];

      // Get the transaction for this backlink
      const backTx = await client.getTransaction(backlink.txHash);
      if (!backTx || !backTx.transaction) {
        console.warn(`Backlink transaction ${backlink.txHash} not found`);
        continue;
      }

      // Get content from backlink witnesses
      const backIndexes =
        backlink.indexes ||
        (backlink.index !== undefined ? [backlink.index] : []);
      if (backIndexes.length > 0) {
        // Get content from each witness index
        for (const idx of backIndexes) {
          if (idx >= backTx.transaction.witnesses.length) {
            console.warn(`Backlink witness index ${idx} out of range`);
            continue;
          }

          const witnessHex = backTx.transaction.witnesses[idx];
          const witness = Buffer.from(witnessHex.slice(2), "hex"); // Remove 0x prefix

          // Extract content (skip CKBFS header + version byte)
          if (
            witness.length >= 6 &&
            witness.slice(0, 5).toString() === "CKBFS"
          ) {
            const content = witness.slice(6);
            contentPieces.unshift(content); // Add to beginning of array (we're going backwards)
          } else {
            console.warn(
              `Backlink witness at index ${idx} is not a valid CKBFS witness`,
            );
          }
        }
      }
    }
  }

  // Combine all content pieces
  return Buffer.concat(contentPieces);
}

/**
 * Saves file content retrieved from blockchain to disk
 * @param content The file content to save
 * @param ckbfsData The CKBFS cell data containing file metadata
 * @param outputPath Optional path to save the file (defaults to filename in current directory)
 * @returns The path where the file was saved
 */
export function saveFileFromChain(
  content: Uint8Array,
  ckbfsData: any,
  outputPath?: string,
): string {
  // Get filename from CKBFS data
  const filename = safelyDecode(ckbfsData.filename);

  // Determine output path
  const filePath = outputPath || filename;

  // Ensure directory exists
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, content);
  console.log(`File saved to: ${filePath}`);
  console.log(`Size: ${content.length} bytes`);

  return filePath;
}

/**
 * Decodes content from a single CKBFS witness
 * @param witnessHex The witness data in hex format (with or without 0x prefix)
 * @returns Object containing the decoded content and metadata, or null if not a valid CKBFS witness
 */
export function decodeWitnessContent(
  witnessHex: string,
): { content: Uint8Array; isValid: boolean } | null {
  try {
    // Remove 0x prefix if present
    const hexData = witnessHex.startsWith("0x")
      ? witnessHex.slice(2)
      : witnessHex;
    const witness = Buffer.from(hexData, "hex");

    // Check if it's a valid CKBFS witness
    if (witness.length < 6) {
      return null;
    }

    // Check CKBFS header
    const header = witness.slice(0, 5).toString();
    if (header !== "CKBFS") {
      return null;
    }

    // Extract content (skip CKBFS header + version byte)
    const content = witness.slice(6);

    return {
      content,
      isValid: true,
    };
  } catch (error) {
    console.warn("Error decoding witness content:", error);
    return null;
  }
}

/**
 * Decodes and combines content from multiple CKBFS witnesses
 * @param witnessHexArray Array of witness data in hex format
 * @param preserveOrder Whether to preserve the order of witnesses (default: true)
 * @returns Combined content from all valid CKBFS witnesses
 */
export function decodeMultipleWitnessContents(
  witnessHexArray: string[],
  preserveOrder: boolean = true,
): Uint8Array {
  const contentPieces: Uint8Array[] = [];

  for (let i = 0; i < witnessHexArray.length; i++) {
    const witnessHex = witnessHexArray[i];
    const decoded = decodeWitnessContent(witnessHex);

    if (decoded && decoded.isValid) {
      if (preserveOrder) {
        contentPieces.push(decoded.content);
      } else {
        contentPieces.unshift(decoded.content);
      }
    } else {
      console.warn(`Witness at index ${i} is not a valid CKBFS witness`);
    }
  }

  return Buffer.concat(contentPieces);
}

/**
 * Extracts complete file content from witnesses using specified indexes
 * @param witnesses Array of all witnesses from a transaction
 * @param indexes Array of witness indexes that contain CKBFS content
 * @returns Combined content from the specified witness indexes
 */
export function extractFileFromWitnesses(
  witnesses: string[],
  indexes: number[],
): Uint8Array {
  const relevantWitnesses: string[] = [];

  for (const idx of indexes) {
    if (idx >= witnesses.length) {
      console.warn(
        `Witness index ${idx} out of range (total witnesses: ${witnesses.length})`,
      );
      continue;
    }
    relevantWitnesses.push(witnesses[idx]);
  }

  return decodeMultipleWitnessContents(relevantWitnesses, true);
}

/**
 * Decodes file content directly from witness data without blockchain queries
 * @param witnessData Object containing witness information
 * @returns Object containing the decoded file content and metadata
 */
export function decodeFileFromWitnessData(witnessData: {
  witnesses: string[];
  indexes: number[] | number;
  filename?: string;
  contentType?: string;
}): {
  content: Uint8Array;
  filename?: string;
  contentType?: string;
  size: number;
} {
  const { witnesses, indexes, filename, contentType } = witnessData;

  // Normalize indexes to array
  const indexArray = Array.isArray(indexes) ? indexes : [indexes];

  // Extract content from witnesses
  const content = extractFileFromWitnesses(witnesses, indexArray);

  return {
    content,
    filename,
    contentType,
    size: content.length,
  };
}

/**
 * Saves decoded file content directly from witness data
 * @param witnessData Object containing witness information
 * @param outputPath Optional path to save the file
 * @returns The path where the file was saved
 */
export function saveFileFromWitnessData(
  witnessData: {
    witnesses: string[];
    indexes: number[] | number;
    filename?: string;
    contentType?: string;
  },
  outputPath?: string,
): string {
  const decoded = decodeFileFromWitnessData(witnessData);

  // Determine output path
  const filename = decoded.filename || "decoded_file";
  const filePath = outputPath || filename;

  // Ensure directory exists
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, decoded.content);
  console.log(`File saved to: ${filePath}`);
  console.log(`Size: ${decoded.size} bytes`);
  console.log(`Content type: ${decoded.contentType || "unknown"}`);

  return filePath;
}

/**
 * Identifier types for CKBFS cells
 */
export enum IdentifierType {
  TypeID = "typeId",
  OutPoint = "outPoint",
  Unknown = "unknown",
}

/**
 * Parsed identifier information
 */
export interface ParsedIdentifier {
  type: IdentifierType;
  typeId?: string;
  txHash?: string;
  index?: number;
  original: string;
}

/**
 * Detects and parses different CKBFS identifier formats
 * @param identifier The identifier string to parse
 * @returns Parsed identifier information
 */
export function parseIdentifier(identifier: string): ParsedIdentifier {
  const trimmed = identifier.trim();

  // Type 1: Pure TypeID hex string (with or without 0x prefix)
  if (trimmed.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
    const typeId = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    return {
      type: IdentifierType.TypeID,
      typeId,
      original: identifier,
    };
  }

  // Type 2: CKBFS URI with TypeID
  if (trimmed.startsWith("ckbfs://")) {
    const content = trimmed.slice(8); // Remove "ckbfs://"

    // Check if it's TypeID format (64 hex characters)
    if (content.match(/^[a-fA-F0-9]{64}$/)) {
      return {
        type: IdentifierType.TypeID,
        typeId: `0x${content}`,
        original: identifier,
      };
    }

    // Type 3: CKBFS URI with transaction hash and index (txhash + 'i' + index)
    const outPointMatch = content.match(/^([a-fA-F0-9]{64})i(\d+)$/);
    if (outPointMatch) {
      const [, txHash, indexStr] = outPointMatch;
      return {
        type: IdentifierType.OutPoint,
        txHash: `0x${txHash}`,
        index: parseInt(indexStr, 10),
        original: identifier,
      };
    }
  }

  // Unknown format
  return {
    type: IdentifierType.Unknown,
    original: identifier,
  };
}

/**
 * Resolves a CKBFS cell using any supported identifier format
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID, CKBFS URI, or outPoint URI)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the found cell and transaction info, or null if not found
 */
async function resolveCKBFSCell(
  client: any,
  identifier: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  cell: any;
  transaction: any;
  outPoint: { txHash: string; index: number };
  parsedId: ParsedIdentifier;
} | null> {
  const {
    network = "testnet",
    version = "20241025.db973a8e8032",
    useTypeID = false,
  } = options;

  const parsedId = parseIdentifier(identifier);

  try {
    if (parsedId.type === IdentifierType.TypeID && parsedId.typeId) {
      // Use existing TypeID resolution logic
      const cellInfo = await findCKBFSCellByTypeId(
        client,
        parsedId.typeId,
        network,
        version,
        useTypeID,
      );

      if (cellInfo) {
        return {
          ...cellInfo,
          parsedId,
        };
      }
    } else if (
      parsedId.type === IdentifierType.OutPoint &&
      parsedId.txHash &&
      parsedId.index !== undefined
    ) {
      // Resolve using transaction hash and index
      const txWithStatus = await client.getTransaction(parsedId.txHash);

      if (!txWithStatus || !txWithStatus.transaction) {
        console.warn(`Transaction ${parsedId.txHash} not found`);
        return null;
      }

      // Import Transaction class dynamically
      const { Transaction } = await import("@ckb-ccc/core");
      const tx = Transaction.from(txWithStatus.transaction);

      // Check if the index is valid
      if (parsedId.index >= tx.outputs.length) {
        console.warn(
          `Output index ${parsedId.index} out of range for transaction ${parsedId.txHash}`,
        );
        return null;
      }

      const output = tx.outputs[parsedId.index];

      // Verify it's a CKBFS cell by checking if it has a type script
      if (!output.type) {
        console.warn(
          `Output at index ${parsedId.index} is not a CKBFS cell (no type script)`,
        );
        return null;
      }

      // Create a mock cell object similar to what findSingletonCellByType returns
      const cell = {
        outPoint: {
          txHash: parsedId.txHash,
          index: parsedId.index,
        },
        output,
      };

      return {
        cell,
        transaction: txWithStatus.transaction,
        outPoint: {
          txHash: parsedId.txHash,
          index: parsedId.index,
        },
        parsedId,
      };
    }

    console.warn(
      `Unable to resolve identifier: ${identifier} (type: ${parsedId.type})`,
    );
    return null;
  } catch (error) {
    console.error(
      `Error resolving CKBFS cell for identifier ${identifier}:`,
      error,
    );
    return null;
  }
}

/**
 * Finds a CKBFS cell by TypeID
 * @param client The CKB client to use for blockchain queries
 * @param typeId The TypeID (args) of the CKBFS cell to find
 * @param network The network type (mainnet or testnet)
 * @param version The protocol version to use
 * @param useTypeID Whether to use type ID instead of code hash for script matching
 * @returns Promise resolving to the found cell and transaction info, or null if not found
 */
async function findCKBFSCellByTypeId(
  client: any,
  typeId: string,
  network: string = "testnet",
  version: string = "20241025.db973a8e8032",
  useTypeID: boolean = false,
): Promise<{
  cell: any;
  transaction: any;
  outPoint: { txHash: string; index: number };
} | null> {
  try {
    // Import constants dynamically to avoid circular dependencies
    const { getCKBFSScriptConfig, NetworkType, ProtocolVersion } = await import(
      "./constants"
    );

    // Get CKBFS script config
    const networkType =
      network === "mainnet" ? NetworkType.Mainnet : NetworkType.Testnet;
    const protocolVersion =
      version === "20240906.ce6724722cf6"
        ? ProtocolVersion.V1
        : ProtocolVersion.V2;
    const config = getCKBFSScriptConfig(
      networkType,
      protocolVersion,
      useTypeID,
    );

    // Create the script to search for
    const script = {
      codeHash: config.codeHash,
      hashType: config.hashType,
      args: typeId.startsWith("0x") ? typeId : `0x${typeId}`,
    };

    // Find the cell by type script
    const cell = await client.findSingletonCellByType(script, true);

    if (!cell) {
      return null;
    }

    // Get the transaction that contains this cell
    const txHash = cell.outPoint.txHash;
    const txWithStatus = await client.getTransaction(txHash);

    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${txHash} not found`);
    }

    return {
      cell,
      transaction: txWithStatus.transaction,
      outPoint: {
        txHash: cell.outPoint.txHash,
        index: cell.outPoint.index,
      },
    };
  } catch (error) {
    console.warn(`Error finding CKBFS cell by TypeID ${typeId}:`, error);
    return null;
  }
}

/**
 * Retrieves complete file content from the blockchain using any supported identifier
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID hex, CKBFS TypeID URI, or CKBFS outPoint URI)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the complete file content and metadata
 */
export async function getFileContentFromChainByIdentifier(
  client: any,
  identifier: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  content: Uint8Array;
  filename: string;
  contentType: string;
  checksum: number;
  size: number;
  backLinks: any[];
  parsedId: ParsedIdentifier;
} | null> {
  const {
    network = "testnet",
    version = "20241025.db973a8e8032",
    useTypeID = false,
  } = options;

  try {
    // Resolve the CKBFS cell using any supported identifier format
    const cellInfo = await resolveCKBFSCell(client, identifier, {
      network,
      version,
      useTypeID,
    });

    if (!cellInfo) {
      console.warn(`CKBFS cell with identifier ${identifier} not found`);
      return null;
    }

    const { cell, transaction, outPoint, parsedId } = cellInfo;

    // Import Transaction class dynamically
    const { Transaction } = await import("@ckb-ccc/core");
    const tx = Transaction.from(transaction);

    // Get output data from the cell
    const outputIndex = outPoint.index;
    const outputData = tx.outputsData[outputIndex];

    if (!outputData) {
      throw new Error(`Output data not found for cell at index ${outputIndex}`);
    }

    // Import required modules dynamically
    const { ccc } = await import("@ckb-ccc/core");
    const { CKBFSData } = await import("./molecule");
    const { ProtocolVersion } = await import("./constants");

    // Parse the output data
    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    // Try to unpack CKBFS data with both protocol versions
    let ckbfsData: any;
    let protocolVersion = version;

    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
    } catch (error) {
      try {
        ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
        protocolVersion = "20240906.ce6724722cf6";
      } catch (v1Error) {
        throw new Error(
          `Failed to unpack CKBFS data with both versions: V2(${error}), V1(${v1Error})`,
        );
      }
    }

    console.log(`Found CKBFS file: ${ckbfsData.filename}`);
    console.log(`Content type: ${ckbfsData.contentType}`);
    console.log(`Protocol version: ${protocolVersion}`);

    // Use existing function to get complete file content
    const content = await getFileContentFromChain(client, outPoint, ckbfsData);

    return {
      content,
      filename: ckbfsData.filename,
      contentType: ckbfsData.contentType,
      checksum: ckbfsData.checksum,
      size: content.length,
      backLinks: ckbfsData.backLinks || [],
      parsedId,
    };
  } catch (error) {
    console.error(`Error retrieving file by identifier ${identifier}:`, error);
    throw error;
  }
}

/**
 * Retrieves complete file content from the blockchain using TypeID (legacy function)
 * @param client The CKB client to use for blockchain queries
 * @param typeId The TypeID (args) of the CKBFS cell
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the complete file content and metadata
 */
export async function getFileContentFromChainByTypeId(
  client: any,
  typeId: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  content: Uint8Array;
  filename: string;
  contentType: string;
  checksum: number;
  size: number;
  backLinks: any[];
} | null> {
  const result = await getFileContentFromChainByIdentifier(
    client,
    typeId,
    options,
  );
  if (result) {
    const { parsedId, ...fileData } = result;
    return fileData;
  }
  return null;
}

/**
 * Saves file content retrieved from blockchain by identifier to disk
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID hex, CKBFS TypeID URI, or CKBFS outPoint URI)
 * @param outputPath Optional path to save the file (defaults to filename from CKBFS data)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the path where the file was saved, or null if file not found
 */
export async function saveFileFromChainByIdentifier(
  client: any,
  identifier: string,
  outputPath?: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<string | null> {
  try {
    // Get file content by identifier
    const fileData = await getFileContentFromChainByIdentifier(
      client,
      identifier,
      options,
    );

    if (!fileData) {
      console.warn(`File with identifier ${identifier} not found`);
      return null;
    }

    // Determine output path
    const filePath = outputPath || fileData.filename;

    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, fileData.content);
    console.log(`File saved to: ${filePath}`);
    console.log(`Size: ${fileData.size} bytes`);
    console.log(`Content type: ${fileData.contentType}`);
    console.log(`Checksum: ${fileData.checksum}`);

    return filePath;
  } catch (error) {
    console.error(`Error saving file by identifier ${identifier}:`, error);
    throw error;
  }
}

/**
 * Saves file content retrieved from blockchain by TypeID to disk (legacy function)
 * @param client The CKB client to use for blockchain queries
 * @param typeId The TypeID (args) of the CKBFS cell
 * @param outputPath Optional path to save the file (defaults to filename from CKBFS data)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the path where the file was saved, or null if file not found
 */
export async function saveFileFromChainByTypeId(
  client: any,
  typeId: string,
  outputPath?: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<string | null> {
  return await saveFileFromChainByIdentifier(
    client,
    typeId,
    outputPath,
    options,
  );
}

/**
 * Decodes file content directly from identifier using witness decoding (new method)
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID hex, CKBFS TypeID URI, or CKBFS outPoint URI)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the decoded file content and metadata, or null if not found
 */
export async function decodeFileFromChainByIdentifier(
  client: any,
  identifier: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  content: Uint8Array;
  filename: string;
  contentType: string;
  checksum: number;
  size: number;
  backLinks: any[];
  parsedId: ParsedIdentifier;
} | null> {
  const {
    network = "testnet",
    version = "20241025.db973a8e8032",
    useTypeID = false,
  } = options;

  try {
    // Resolve the CKBFS cell using any supported identifier format
    const cellInfo = await resolveCKBFSCell(client, identifier, {
      network,
      version,
      useTypeID,
    });

    if (!cellInfo) {
      console.warn(`CKBFS cell with identifier ${identifier} not found`);
      return null;
    }

    const { cell, transaction, outPoint, parsedId } = cellInfo;

    // Import required modules dynamically
    const { Transaction, ccc } = await import("@ckb-ccc/core");
    const { CKBFSData } = await import("./molecule");
    const { ProtocolVersion } = await import("./constants");

    const tx = Transaction.from(transaction);

    // Get output data from the cell
    const outputIndex = outPoint.index;
    const outputData = tx.outputsData[outputIndex];

    if (!outputData) {
      throw new Error(`Output data not found for cell at index ${outputIndex}`);
    }

    // Parse the output data
    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    // Try to unpack CKBFS data with both protocol versions
    let ckbfsData: any;
    let protocolVersion = version;

    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
    } catch (error) {
      try {
        ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
        protocolVersion = "20240906.ce6724722cf6";
      } catch (v1Error) {
        throw new Error(
          `Failed to unpack CKBFS data with both versions: V2(${error}), V1(${v1Error})`,
        );
      }
    }

    console.log(`Found CKBFS file: ${ckbfsData.filename}`);
    console.log(`Content type: ${ckbfsData.contentType}`);
    console.log(`Using direct witness decoding method`);

    // Get witness indexes from CKBFS data
    const indexes =
      ckbfsData.indexes ||
      (ckbfsData.index !== undefined ? [ckbfsData.index] : []);

    // Use direct witness decoding method
    const content = decodeFileFromWitnessData({
      witnesses: tx.witnesses,
      indexes: indexes,
      filename: ckbfsData.filename,
      contentType: ckbfsData.contentType,
    });

    return {
      content: content.content,
      filename: ckbfsData.filename,
      contentType: ckbfsData.contentType,
      checksum: ckbfsData.checksum,
      size: content.size,
      backLinks: ckbfsData.backLinks || [],
      parsedId,
    };
  } catch (error) {
    console.error(`Error decoding file by identifier ${identifier}:`, error);
    throw error;
  }
}

/**
 * Decodes file content directly from TypeID using witness decoding (legacy function)
 * @param client The CKB client to use for blockchain queries
 * @param typeId The TypeID (args) of the CKBFS cell
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the decoded file content and metadata, or null if not found
 */
export async function decodeFileFromChainByTypeId(
  client: any,
  typeId: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  content: Uint8Array;
  filename: string;
  contentType: string;
  checksum: number;
  size: number;
  backLinks: any[];
} | null> {
  const result = await decodeFileFromChainByIdentifier(client, typeId, options);
  if (result) {
    const { parsedId, ...fileData } = result;
    return fileData;
  }
  return null;
}

/**
 * Retrieves complete file content from the blockchain for CKBFS v3
 * V3 stores backlinks in witnesses instead of cell data
 * @param client The CKB client to use for blockchain queries
 * @param outPoint The output point of the latest CKBFS v3 cell
 * @param ckbfsData The data from the latest CKBFS v3 cell
 * @returns Promise resolving to the complete file content
 */
export async function getFileContentFromChainV3(
  client: any,
  outPoint: { txHash: string; index: number },
  ckbfsData: any,
): Promise<Uint8Array> {
  console.log(`Retrieving v3 file: ${safelyDecode(ckbfsData.filename)}`);
  console.log(`Content type: ${safelyDecode(ckbfsData.contentType)}`);

  // Prepare to collect all content pieces
  const contentPieces: Uint8Array[] = [];
  let currentOutPoint = outPoint;

  // Process the current transaction first
  const tx = await client.getTransaction(currentOutPoint.txHash);
  if (!tx || !tx.transaction) {
    throw new Error(`Transaction ${currentOutPoint.txHash} not found`);
  }

  // Get content from witnesses
  const index = ckbfsData.index;
  if (index !== undefined && index < tx.transaction.witnesses.length) {
    const witnessHex = tx.transaction.witnesses[index];
    const witness = Buffer.from(witnessHex.slice(2), "hex"); // Remove 0x prefix

    // Check if this is a v3 head witness
    if (witness.length >= 50 && witness.slice(0, 5).toString() === "CKBFS" && witness[5] === 0x03) {
      // Extract witness data using v3 format
      const witnessData = extractCKBFSV3WitnessContent(witness, true);
      contentPieces.push(witnessData.content);

      // Follow the witness chain if there are continuation witnesses
      let nextIndex = witnessData.nextIndex;
      while (nextIndex > 0 && nextIndex < tx.transaction.witnesses.length) {
        const nextWitnessHex = tx.transaction.witnesses[nextIndex];
        const nextWitness = Buffer.from(nextWitnessHex.slice(2), "hex");

        // Extract continuation witness data
        const nextWitnessData = extractCKBFSV3WitnessContent(nextWitness, false);
        contentPieces.push(nextWitnessData.content);

        // Move to next witness
        nextIndex = nextWitnessData.nextIndex;
      }

      // Follow backlinks chain from the head witness
      let previousTxHash = witnessData.previousTxHash;
      let previousWitnessIndex = witnessData.previousWitnessIndex;

      // If there's a previous transaction, follow the backlink chain
      while (previousTxHash && previousTxHash !== '0x' + '00'.repeat(32) && previousWitnessIndex !== undefined) {
        const backTx = await client.getTransaction(previousTxHash);
        if (!backTx || !backTx.transaction) {
          console.warn(`Backlink transaction ${previousTxHash} not found`);
          break;
        }

        if (previousWitnessIndex >= backTx.transaction.witnesses.length) {
          console.warn(`Backlink witness index ${previousWitnessIndex} out of range`);
          break;
        }

        const backWitnessHex = backTx.transaction.witnesses[previousWitnessIndex];
        const backWitness = Buffer.from(backWitnessHex.slice(2), "hex");

        // Check if this is a v3 head witness
        if (backWitness.length >= 50 && backWitness.slice(0, 5).toString() === "CKBFS" && backWitness[5] === 0x03) {
          const backWitnessData = extractCKBFSV3WitnessContent(backWitness, true);
          contentPieces.unshift(backWitnessData.content); // Add to beginning

          // Follow continuation witnesses in this transaction
          let nextBackIndex = backWitnessData.nextIndex;
          const backContentPieces: Uint8Array[] = [];
          while (nextBackIndex > 0 && nextBackIndex < backTx.transaction.witnesses.length) {
            const nextBackWitnessHex = backTx.transaction.witnesses[nextBackIndex];
            const nextBackWitness = Buffer.from(nextBackWitnessHex.slice(2), "hex");

            const nextBackWitnessData = extractCKBFSV3WitnessContent(nextBackWitness, false);
            backContentPieces.push(nextBackWitnessData.content);

            nextBackIndex = nextBackWitnessData.nextIndex;
          }

          // Insert continuation content pieces right after the head content
          for (let i = backContentPieces.length - 1; i >= 0; i--) {
            contentPieces.unshift(backContentPieces[i]);
          }

          // Continue following the backlink chain
          previousTxHash = backWitnessData.previousTxHash;
          previousWitnessIndex = backWitnessData.previousWitnessIndex;
        } else {
          console.warn(`Backlink witness is not a valid CKBFS v3 witness`);
          break;
        }
      }
    } else {
      console.warn(`Witness at index ${index} is not a valid CKBFS v3 witness`);
    }
  }

  // Combine all content pieces
  return Buffer.concat(contentPieces);
}

/**
 * Retrieves complete file content from the blockchain using identifier for CKBFS v3
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID hex, CKBFS TypeID URI, or CKBFS outPoint URI)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the complete file content and metadata
 */
export async function getFileContentFromChainByIdentifierV3(
  client: any,
  identifier: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<{
  content: Uint8Array;
  filename: string;
  contentType: string;
  checksum: number;
  size: number;
  parsedId: ParsedIdentifier;
} | null> {
  const {
    network = "testnet",
    version = ProtocolVersion.V3,
    useTypeID = false,
  } = options;

  try {
    // Resolve the CKBFS cell using any supported identifier format
    const cellInfo = await resolveCKBFSCell(client, identifier, {
      network,
      version,
      useTypeID,
    });

    if (!cellInfo) {
      console.warn(`CKBFS v3 cell with identifier ${identifier} not found`);
      return null;
    }

    const { cell, transaction, outPoint, parsedId } = cellInfo;

    // Import Transaction class dynamically
    const { Transaction } = await import("@ckb-ccc/core");
    const tx = Transaction.from(transaction);

    // Get output data from the cell
    const outputIndex = outPoint.index;
    const outputData = tx.outputsData[outputIndex];

    if (!outputData) {
      throw new Error(`Output data not found for cell at index ${outputIndex}`);
    }

    // Import required modules dynamically
    const { ccc } = await import("@ckb-ccc/core");
    const { CKBFSData } = await import("./molecule");

    // Parse the output data
    const rawData = outputData.startsWith("0x")
      ? ccc.bytesFrom(outputData.slice(2), "hex")
      : Buffer.from(outputData, "hex");

    // Unpack CKBFS v3 data
    const ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V3);

    console.log(`Found CKBFS v3 file: ${ckbfsData.filename}`);
    console.log(`Content type: ${ckbfsData.contentType}`);

    // Use v3-specific function to get complete file content
    const content = await getFileContentFromChainV3(client, outPoint, ckbfsData);

    return {
      content,
      filename: ckbfsData.filename,
      contentType: ckbfsData.contentType,
      checksum: ckbfsData.checksum,
      size: content.length,
      parsedId,
    };
  } catch (error) {
    console.error(`Error retrieving v3 file by identifier ${identifier}:`, error);
    throw error;
  }
}

/**
 * Saves CKBFS v3 file content retrieved from blockchain by identifier to disk
 * @param client The CKB client to use for blockchain queries
 * @param identifier The identifier (TypeID hex, CKBFS TypeID URI, or CKBFS outPoint URI)
 * @param outputPath Optional path to save the file (defaults to filename from CKBFS data)
 * @param options Optional configuration for network, version, and useTypeID
 * @returns Promise resolving to the path where the file was saved, or null if file not found
 */
export async function saveFileFromChainByIdentifierV3(
  client: any,
  identifier: string,
  outputPath?: string,
  options: {
    network?: "mainnet" | "testnet";
    version?: string;
    useTypeID?: boolean;
  } = {},
): Promise<string | null> {
  try {
    // Get file content by identifier using v3 method
    const fileData = await getFileContentFromChainByIdentifierV3(
      client,
      identifier,
      { ...options, version: ProtocolVersion.V3 },
    );

    if (!fileData) {
      console.warn(`CKBFS v3 file with identifier ${identifier} not found`);
      return null;
    }

    // Determine output path
    const filePath = outputPath || fileData.filename;

    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, fileData.content);
    console.log(`CKBFS v3 file saved to: ${filePath}`);
    console.log(`Size: ${fileData.size} bytes`);
    console.log(`Content type: ${fileData.contentType}`);
    console.log(`Checksum: ${fileData.checksum}`);

    return filePath;
  } catch (error) {
    console.error(`Error saving v3 file by identifier ${identifier}:`, error);
    throw error;
  }
}
