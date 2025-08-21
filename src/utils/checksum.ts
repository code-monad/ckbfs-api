import { adler32 } from 'hash-wasm';
import ADLER32 from 'adler-32';

/**
 * Utility functions for Adler32 checksum generation and verification
 */

/**
 * Calculates Adler32 checksum for the provided data
 * @param data The data to calculate checksum for
 * @returns Promise resolving to the calculated checksum as a number
 */
export async function calculateChecksum(data: Uint8Array): Promise<number> {
  const checksumString = await adler32(data);
  const checksumBuffer = Buffer.from(checksumString, 'hex');
  return checksumBuffer.readUInt32BE();
}

/**
 * Updates an existing checksum with new data using proper rolling Adler-32 calculation
 * @param previousChecksum The existing checksum to update
 * @param newData The new data to add to the checksum
 * @returns Promise resolving to the updated checksum as a number
 */
export async function updateChecksum(previousChecksum: number, newData: Uint8Array): Promise<number> {
  // Extract a and b values from the previous checksum
  // In Adler-32, the checksum is composed of two 16-bit integers: a and b
  // The final checksum is (b << 16) | a
  const a = previousChecksum & 0xFFFF;
  const b = (previousChecksum >>> 16) & 0xFFFF;
  
  // Use the adler-32 package to calculate a proper rolling checksum
  // The package doesn't have a "resume" function, so we need to work with the underlying algorithm
  
  // Initialize with existing a and b values
  let adlerA = a;
  let adlerB = b;
  const MOD_ADLER = 65521; // Adler-32 modulo value
  
  // Process each byte of the new data
  for (let i = 0; i < newData.length; i++) {
    adlerA = (adlerA + newData[i]) % MOD_ADLER;
    adlerB = (adlerB + adlerA) % MOD_ADLER;
  }
  
  // Combine a and b to get the final checksum
  // Use a Uint32Array to ensure we get a proper unsigned 32-bit integer
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint16(0, adlerA, true); // Set lower 16 bits (little endian)
  view.setUint16(2, adlerB, true); // Set upper 16 bits (little endian)
  
  // Read as an unsigned 32-bit integer
  const updatedChecksum = view.getUint32(0, true);
  
  console.log(`Updated checksum from ${previousChecksum} to ${updatedChecksum} for appended content`);
  
  return updatedChecksum;
}

/**
 * Verifies if a given checksum matches the expected checksum for the data
 * @param data The data to verify
 * @param expectedChecksum The expected checksum
 * @returns Promise resolving to a boolean indicating whether the checksum is valid
 */
export async function verifyChecksum(data: Uint8Array, expectedChecksum: number): Promise<boolean> {
  const calculatedChecksum = await calculateChecksum(data);
  return calculatedChecksum === expectedChecksum;
}

/**
 * Verifies the checksum of a CKBFS witness
 * @param witness The witness bytes
 * @param expectedChecksum The expected checksum
 * @param backlinks Optional backlinks to use for checksum verification
 * @returns Promise resolving to a boolean indicating whether the checksum is valid
 */
export async function verifyWitnessChecksum(
  witness: Uint8Array, 
  expectedChecksum: number,
  backlinks: { checksum: number }[] = []
): Promise<boolean> {
  // Extract the content bytes from the witness (skip the CKBFS header and version)
  const contentBytes = witness.slice(6);
  
  // If backlinks are provided, use the last backlink's checksum
  if (backlinks.length > 0) {
    const lastBacklink = backlinks[backlinks.length - 1];
    const updatedChecksum = await updateChecksum(lastBacklink.checksum, contentBytes);
    return updatedChecksum === expectedChecksum;
  }
  
  // Otherwise, calculate checksum from scratch
  return verifyChecksum(contentBytes, expectedChecksum);
}

/**
 * Verifies the checksum of a CKBFS v3 witness
 * @param witness The v3 witness bytes
 * @param expectedChecksum The expected checksum
 * @param previousChecksum Optional previous checksum for chained verification
 * @returns Promise resolving to a boolean indicating whether the checksum is valid
 */
export async function verifyV3WitnessChecksum(
  witness: Uint8Array,
  expectedChecksum: number,
  previousChecksum?: number
): Promise<boolean> {
  // Check if this is a head witness (contains CKBFS header)
  const isHeadWitness = witness.length >= 50 && 
    new TextDecoder().decode(witness.slice(0, 5)) === 'CKBFS' &&
    witness[5] === 0x03;
  
  let contentBytes: Uint8Array;
  
  if (isHeadWitness) {
    // Head witness: extract content after backlink structure
    // Format: CKBFS(5) + version(1) + prevTxHash(32) + prevWitnessIndex(4) + prevChecksum(4) + nextIndex(4) + content
    contentBytes = witness.slice(50);
  } else {
    // Continuation witness: extract content after next index
    // Format: nextIndex(4) + content
    contentBytes = witness.slice(4);
  }
  
  // If previous checksum is provided, use it for rolling calculation
  if (previousChecksum !== undefined) {
    const updatedChecksum = await updateChecksum(previousChecksum, contentBytes);
    return updatedChecksum === expectedChecksum;
  }
  
  // Otherwise, calculate checksum from scratch
  return verifyChecksum(contentBytes, expectedChecksum);
}

/**
 * Verifies the checksum chain for multiple v3 witnesses
 * @param witnesses Array of v3 witness bytes
 * @param finalExpectedChecksum The expected final checksum
 * @param initialChecksum Optional initial checksum (for append operations)
 * @returns Promise resolving to a boolean indicating whether the checksum chain is valid
 */
export async function verifyV3WitnessChain(
  witnesses: Uint8Array[],
  finalExpectedChecksum: number,
  initialChecksum: number = 1 // Adler32 starts with 1
): Promise<boolean> {
  if (witnesses.length === 0) {
    return finalExpectedChecksum === initialChecksum;
  }
  
  let currentChecksum = initialChecksum;
  
  // Process each witness in the chain
  for (const witness of witnesses) {
    const isHeadWitness = witness.length >= 50 && 
      new TextDecoder().decode(witness.slice(0, 5)) === 'CKBFS' &&
      witness[5] === 0x03;
    
    let contentBytes: Uint8Array;
    
    if (isHeadWitness) {
      // Head witness: extract content after backlink structure
      contentBytes = witness.slice(50);
    } else {
      // Continuation witness: extract content after next index
      contentBytes = witness.slice(4);
    }
    
    // Update checksum with this witness's content
    currentChecksum = await updateChecksum(currentChecksum, contentBytes);
  }
  
  return currentChecksum === finalExpectedChecksum;
} 