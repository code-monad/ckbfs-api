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