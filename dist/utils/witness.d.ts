/**
 * Utility functions for creating and handling CKBFS witnesses
 */
/**
 * Creates a CKBFS witness with content
 * @param content The content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export declare function createCKBFSWitness(content: Uint8Array): Uint8Array;
/**
 * Creates a CKBFS witness with text content
 * @param text The text content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
export declare function createTextCKBFSWitness(text: string): Uint8Array;
/**
 * Extracts content from a CKBFS witness
 * @param witness The CKBFS witness data
 * @returns Object containing the extracted version and content bytes
 */
export declare function extractCKBFSWitnessContent(witness: Uint8Array): {
    version: number;
    content: Uint8Array;
};
/**
 * Checks if a witness is a valid CKBFS witness
 * @param witness The witness data to check
 * @returns Boolean indicating whether the witness is a valid CKBFS witness
 */
export declare function isCKBFSWitness(witness: Uint8Array): boolean;
/**
 * Creates an array of witnesses for a CKBFS transaction from content chunks
 * @param contentChunks Array of content chunks
 * @param version Optional version byte (default is 0)
 * @returns Array of Uint8Array witnesses
 */
export declare function createChunkedCKBFSWitnesses(contentChunks: Uint8Array[]): Uint8Array[];
