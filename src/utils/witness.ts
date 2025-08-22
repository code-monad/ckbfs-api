import { CKBFS_HEADER } from './molecule';
import { ProtocolVersion, ProtocolVersionType } from './constants';

/**
 * Utility functions for creating and handling CKBFS witnesses
 */

/**
 * V3 witness structure for backlinks and content chaining
 */
export interface CKBFSV3WitnessOptions {
  previousTxHash?: string; // 32 bytes, 0x00...00 for publish
  previousWitnessIndex?: number; // 4 bytes, 0x00000000 for publish
  previousChecksum?: number; // 4 bytes, 0x00000000 for publish
  nextIndex?: number; // 4 bytes, 0x00000000 for tail witness
  content: Uint8Array;
}

/**
 * Creates a CKBFS witness with content
 * @param content The content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export function createCKBFSWitness(content: Uint8Array): Uint8Array {
  // Create witness with CKBFS header, version byte, and content
  // Version byte must always be 0x00 per protocol
  const versionByte = new Uint8Array([0]);
  return Buffer.concat([CKBFS_HEADER, versionByte, content]);
}

/**
 * Creates a CKBFS witness with text content
 * @param text The text content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export function createTextCKBFSWitness(text: string): Uint8Array {
  const textEncoder = new TextEncoder();
  const contentBytes = textEncoder.encode(text);
  return createCKBFSWitness(contentBytes);
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
 * Creates a CKBFS v3 witness with structured format
 * @param options Witness options including backlink data and content
 * @returns Uint8Array containing the v3 witness data
 */
export function createCKBFSV3Witness(options: CKBFSV3WitnessOptions): Uint8Array {
  const {
    previousTxHash = '0x' + '00'.repeat(32),
    previousWitnessIndex = 0,
    previousChecksum = 0,
    nextIndex = 0,
    content
  } = options;

  // Create witness components
  const header = CKBFS_HEADER; // "CKBFS" (5 bytes)
  const version = new Uint8Array([0x03]); // Version 3 (1 byte)
  
  // Previous position: txHash (32 bytes) + witnessIndex (4 bytes)
  const prevTxHashBytes = new Uint8Array(32);
  if (previousTxHash !== '0x' + '00'.repeat(32)) {
    const hexStr = previousTxHash.startsWith('0x') ? previousTxHash.slice(2) : previousTxHash;
    for (let i = 0; i < 32; i++) {
      prevTxHashBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    }
  }
  
  const prevWitnessIndexBytes = new Uint8Array(4);
  new DataView(prevWitnessIndexBytes.buffer).setUint32(0, previousWitnessIndex, true); // little-endian
  
  // Previous checksum (4 bytes)
  const prevChecksumBytes = new Uint8Array(4);
  new DataView(prevChecksumBytes.buffer).setUint32(0, previousChecksum, true); // little-endian
  
  // Next index (4 bytes)
  const nextIndexBytes = new Uint8Array(4);
  new DataView(nextIndexBytes.buffer).setUint32(0, nextIndex, true); // little-endian

  // Combine all parts
  return Buffer.concat([
    header,              // 5 bytes: "CKBFS"
    version,            // 1 byte: 0x03
    prevTxHashBytes,    // 32 bytes: previous tx hash
    prevWitnessIndexBytes, // 4 bytes: previous witness index
    prevChecksumBytes,  // 4 bytes: previous checksum
    nextIndexBytes,     // 4 bytes: next index
    content             // variable: content bytes
  ]);
}

/**
 * Creates an array of v3 witnesses for chunked content
 * @param contentChunks Array of content chunks
 * @param options Backlink options for head witness and start index
 * @returns Array of Uint8Array witnesses
 */
export function createChunkedCKBFSV3Witnesses(
  contentChunks: Uint8Array[],
  options: Omit<CKBFSV3WitnessOptions, 'content' | 'nextIndex'> & { startIndex?: number } = {}
): Uint8Array[] {
  if (contentChunks.length === 0) {
    return [];
  }

  // Default start index to 1 if not provided (witness 0 is typically for signing)
  const startIndex = options.startIndex || 1;
  const witnesses: Uint8Array[] = [];
  
  for (let i = 0; i < contentChunks.length; i++) {
    const isHead = i === 0;
    const isTail = i === contentChunks.length - 1;
    
    if (isHead) {
      // Head witness with backlink info
      witnesses.push(createCKBFSV3Witness({
        ...options,
        nextIndex: isTail ? 0 : startIndex + i + 1, // Correct next witness index calculation
        content: contentChunks[i]
      }));
    } else {
      // Middle/tail witness with minimal header
      const nextIndex = isTail ? 0 : startIndex + i + 1;
      const nextIndexBytes = new Uint8Array(4);
      new DataView(nextIndexBytes.buffer).setUint32(0, nextIndex, true);
      
      witnesses.push(Buffer.concat([
        nextIndexBytes,    // 4 bytes: next index
        contentChunks[i]   // variable: content bytes
      ]));
    }
  }
  
  return witnesses;
}

/**
 * Extracts content from a CKBFS v3 witness
 * @param witness The CKBFS v3 witness data
 * @param isHeadWitness Whether this is the head witness or a continuation witness
 * @returns Object containing the extracted data
 */
export function extractCKBFSV3WitnessContent(witness: Uint8Array, isHeadWitness: boolean = true): {
  version?: number;
  previousTxHash?: string;
  previousWitnessIndex?: number;
  previousChecksum?: number;
  nextIndex: number;
  content: Uint8Array;
} {
  if (isHeadWitness) {
    // Head witness format: CKBFS(5) + version(1) + prevTxHash(32) + prevWitnessIndex(4) + prevChecksum(4) + nextIndex(4) + content
    if (witness.length < 50) {
      throw new Error('Invalid CKBFS v3 head witness: too short');
    }
    
    const header = witness.slice(0, 5);
    const headerString = new TextDecoder().decode(header);
    
    if (headerString !== 'CKBFS') {
      throw new Error('Invalid CKBFS v3 head witness: missing CKBFS header');
    }
    
    const version = witness[5];
    if (version !== 0x03) {
      throw new Error(`Invalid CKBFS v3 head witness: expected version 0x03, got 0x${version.toString(16)}`);
    }
    
    // Extract previous position
    const prevTxHashBytes = witness.slice(6, 38);
    const previousTxHash = '0x' + Array.from(prevTxHashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const previousWitnessIndex = new DataView(witness.slice(38, 42).buffer.slice(witness.slice(38, 42).byteOffset, witness.slice(38, 42).byteOffset + 4)).getUint32(0, true);
    const previousChecksum = new DataView(witness.slice(42, 46).buffer.slice(witness.slice(42, 46).byteOffset, witness.slice(42, 46).byteOffset + 4)).getUint32(0, true);
    const nextIndex = new DataView(witness.slice(46, 50).buffer.slice(witness.slice(46, 50).byteOffset, witness.slice(46, 50).byteOffset + 4)).getUint32(0, true);
    const content = witness.slice(50);
    
    return {
      version,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum,
      nextIndex,
      content
    };
  } else {
    // Continuation witness format: nextIndex(4) + content
    if (witness.length < 4) {
      throw new Error('Invalid CKBFS v3 continuation witness: too short');
    }
    
    const nextIndex = new DataView(witness.slice(0, 4).buffer).getUint32(0, true);
    const content = witness.slice(4);
    
    return {
      nextIndex,
      content
    };
  }
}

/**
 * Checks if a witness is a valid CKBFS v3 witness
 * @param witness The witness data to check
 * @returns Boolean indicating whether the witness is a valid CKBFS v3 witness
 */
export function isCKBFSV3Witness(witness: Uint8Array): boolean {
  if (witness.length < 50) {
    return false;
  }
  
  const header = witness.slice(0, 5);
  const headerString = new TextDecoder().decode(header);
  
  if (headerString !== 'CKBFS') {
    return false;
  }
  
  const version = witness[5];
  return version === 0x03;
}

/**
 * Creates an array of witnesses for a CKBFS transaction from content chunks
 * @param contentChunks Array of content chunks
 * @param version Optional version byte (default is 0)
 * @returns Array of Uint8Array witnesses
 */
export function createChunkedCKBFSWitnesses(contentChunks: Uint8Array[]): Uint8Array[] {
  return contentChunks.map(chunk => createCKBFSWitness(chunk));
} 