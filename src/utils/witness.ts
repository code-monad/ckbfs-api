import { CKBFS_HEADER } from './molecule';

/**
 * Utility functions for creating and handling CKBFS witnesses
 */

/**
 * Creates a CKBFS witness with content
 * @param content The content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export function createCKBFSWitness(content: Uint8Array, version: number = 0): Uint8Array {
  // Create witness with CKBFS header, version byte, and content
  const versionByte = new Uint8Array([version]);
  return Buffer.concat([CKBFS_HEADER, versionByte, content]);
}

/**
 * Creates a CKBFS witness with text content
 * @param text The text content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export function createTextCKBFSWitness(text: string, version: number = 0): Uint8Array {
  const textEncoder = new TextEncoder();
  const contentBytes = textEncoder.encode(text);
  return createCKBFSWitness(contentBytes, version);
}

/**
 * Extracts content from a CKBFS witness
 * @param witness The CKBFS witness data
 * @returns Object containing the extracted version and content bytes
 */
export function extractCKBFSWitnessContent(witness: Uint8Array): { version: number; content: Uint8Array } {
  // Ensure the witness has the CKBFS header
  const header = witness.slice(0, 5);
  const headerString = new TextDecoder().decode(header);
  
  if (headerString !== 'CKBFS') {
    throw new Error('Invalid CKBFS witness: missing CKBFS header');
  }
  
  // Extract version byte and content
  const version = witness[5];
  const content = witness.slice(6);
  
  return { version, content };
}

/**
 * Checks if a witness is a valid CKBFS witness
 * @param witness The witness data to check
 * @returns Boolean indicating whether the witness is a valid CKBFS witness
 */
export function isCKBFSWitness(witness: Uint8Array): boolean {
  if (witness.length < 6) {
    return false;
  }
  
  const header = witness.slice(0, 5);
  const headerString = new TextDecoder().decode(header);
  
  return headerString === 'CKBFS';
}

/**
 * Creates an array of witnesses for a CKBFS transaction from content chunks
 * @param contentChunks Array of content chunks
 * @param version Optional version byte (default is 0)
 * @returns Array of Uint8Array witnesses
 */
export function createChunkedCKBFSWitnesses(contentChunks: Uint8Array[], version: number = 0): Uint8Array[] {
  return contentChunks.map(chunk => createCKBFSWitness(chunk, version));
} 