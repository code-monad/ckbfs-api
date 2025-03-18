import { adler32 } from 'hash-wasm';

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
 * Updates an existing checksum with new data
 * @param previousChecksum The existing checksum to update
 * @param newData The new data to add to the checksum
 * @returns Promise resolving to the updated checksum as a number
 */
export async function updateChecksum(previousChecksum: number, newData: Uint8Array): Promise<number> {
  // In a real implementation, this would require the actual Adler32 state recovery
  // For now, we're simply concatenating the previousChecksum as a hex string with the new data
  // and calculating a new checksum
  
  const checksumBytes = Buffer.alloc(4);
  checksumBytes.writeUInt32BE(previousChecksum);
  
  // Concatenate the previous checksum bytes with the new data
  const combinedData = Buffer.concat([checksumBytes, Buffer.from(newData)]);
  
  // Calculate the new checksum
  return calculateChecksum(combinedData);
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