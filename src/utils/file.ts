import fs from 'fs';
import path from 'path';

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
  return fs.readFileSync(filePath, 'utf-8');
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
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Splits a file into chunks of a specific size
 * @param filePath The path to the file to split
 * @param chunkSize The maximum size of each chunk in bytes
 * @returns Array of Uint8Array chunks
 */
export function splitFileIntoChunks(filePath: string, chunkSize: number): Uint8Array[] {
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
export function combineChunksToFile(chunks: Uint8Array[], outputPath: string): void {
  const combinedBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  writeFile(outputPath, combinedBuffer);
}

/**
 * Utility function to safely decode buffer to string
 * @param buffer The buffer to decode
 * @returns Decoded string or placeholder on error
 */
function safelyDecode(buffer: any): string {
  if (!buffer) return '[Unknown]';
  try {
    if (buffer instanceof Uint8Array) {
      return new TextDecoder().decode(buffer);
    } else if (typeof buffer === 'string') {
      return buffer;
    } else {
      return `[Buffer: ${buffer.toString()}]`;
    }
  } catch (e) {
    return '[Decode Error]';
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
  ckbfsData: any
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
  const indexes = currentData.indexes || (currentData.index !== undefined ? [currentData.index] : []);
  if (indexes.length > 0) {
    // Get content from each witness index
    for (const idx of indexes) {
      if (idx >= tx.transaction.witnesses.length) {
        console.warn(`Witness index ${idx} out of range`);
        continue;
      }
      
      const witnessHex = tx.transaction.witnesses[idx];
      const witness = Buffer.from(witnessHex.slice(2), 'hex'); // Remove 0x prefix
      
      // Extract content (skip CKBFS header + version byte)
      if (witness.length >= 6 && witness.slice(0, 5).toString() === 'CKBFS') {
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
      const backIndexes = backlink.indexes || (backlink.index !== undefined ? [backlink.index] : []);
      if (backIndexes.length > 0) {
        // Get content from each witness index
        for (const idx of backIndexes) {
          if (idx >= backTx.transaction.witnesses.length) {
            console.warn(`Backlink witness index ${idx} out of range`);
            continue;
          }
          
          const witnessHex = backTx.transaction.witnesses[idx];
          const witness = Buffer.from(witnessHex.slice(2), 'hex'); // Remove 0x prefix
          
          // Extract content (skip CKBFS header + version byte)
          if (witness.length >= 6 && witness.slice(0, 5).toString() === 'CKBFS') {
            const content = witness.slice(6);
            contentPieces.unshift(content); // Add to beginning of array (we're going backwards)
          } else {
            console.warn(`Backlink witness at index ${idx} is not a valid CKBFS witness`);
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
  outputPath?: string
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