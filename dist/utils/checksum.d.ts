/**
 * Utility functions for Adler32 checksum generation and verification
 */
/**
 * Calculates Adler32 checksum for the provided data
 * @param data The data to calculate checksum for
 * @returns Promise resolving to the calculated checksum as a number
 */
export declare function calculateChecksum(data: Uint8Array): Promise<number>;
/**
 * Updates an existing checksum with new data using proper rolling Adler-32 calculation
 * @param previousChecksum The existing checksum to update
 * @param newData The new data to add to the checksum
 * @returns Promise resolving to the updated checksum as a number
 */
export declare function updateChecksum(previousChecksum: number, newData: Uint8Array): Promise<number>;
/**
 * Verifies if a given checksum matches the expected checksum for the data
 * @param data The data to verify
 * @param expectedChecksum The expected checksum
 * @returns Promise resolving to a boolean indicating whether the checksum is valid
 */
export declare function verifyChecksum(data: Uint8Array, expectedChecksum: number): Promise<boolean>;
/**
 * Verifies the checksum of a CKBFS witness
 * @param witness The witness bytes
 * @param expectedChecksum The expected checksum
 * @param backlinks Optional backlinks to use for checksum verification
 * @returns Promise resolving to a boolean indicating whether the checksum is valid
 */
export declare function verifyWitnessChecksum(witness: Uint8Array, expectedChecksum: number, backlinks?: {
    checksum: number;
}[]): Promise<boolean>;
