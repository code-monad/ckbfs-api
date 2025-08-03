/**
 * Utility functions for file operations
 */
/**
 * Reads a file from the file system
 * @param filePath The path to the file to read
 * @returns Buffer containing the file contents
 */
export declare function readFile(filePath: string): Buffer;
/**
 * Reads a file as text from the file system
 * @param filePath The path to the file to read
 * @returns String containing the file contents
 */
export declare function readFileAsText(filePath: string): string;
/**
 * Reads a file as Uint8Array from the file system
 * @param filePath The path to the file to read
 * @returns Uint8Array containing the file contents
 */
export declare function readFileAsUint8Array(filePath: string): Uint8Array;
/**
 * Writes data to a file in the file system
 * @param filePath The path to write the file to
 * @param data The data to write to the file
 */
export declare function writeFile(filePath: string, data: Buffer | string): void;
/**
 * Gets the MIME content type based on file extension
 * @param filePath The path to the file
 * @returns The MIME content type for the file
 */
export declare function getContentType(filePath: string): string;
/**
 * Splits a file into chunks of a specific size
 * @param filePath The path to the file to split
 * @param chunkSize The maximum size of each chunk in bytes
 * @returns Array of Uint8Array chunks
 */
export declare function splitFileIntoChunks(filePath: string, chunkSize: number): Uint8Array[];
/**
 * Combines chunks into a single file
 * @param chunks Array of chunks to combine
 * @param outputPath The path to write the combined file to
 */
export declare function combineChunksToFile(chunks: Uint8Array[], outputPath: string): void;
/**
 * Retrieves complete file content from the blockchain by following backlinks
 * @param client The CKB client to use for blockchain queries
 * @param outPoint The output point of the latest CKBFS cell
 * @param ckbfsData The data from the latest CKBFS cell
 * @returns Promise resolving to the complete file content
 */
export declare function getFileContentFromChain(client: any, outPoint: {
    txHash: string;
    index: number;
}, ckbfsData: any): Promise<Uint8Array>;
/**
 * Saves file content retrieved from blockchain to disk
 * @param content The file content to save
 * @param ckbfsData The CKBFS cell data containing file metadata
 * @param outputPath Optional path to save the file (defaults to filename in current directory)
 * @returns The path where the file was saved
 */
export declare function saveFileFromChain(content: Uint8Array, ckbfsData: any, outputPath?: string): string;
/**
 * Decodes content from a single CKBFS witness
 * @param witnessHex The witness data in hex format (with or without 0x prefix)
 * @returns Object containing the decoded content and metadata, or null if not a valid CKBFS witness
 */
export declare function decodeWitnessContent(witnessHex: string): {
    content: Uint8Array;
    isValid: boolean;
} | null;
/**
 * Decodes and combines content from multiple CKBFS witnesses
 * @param witnessHexArray Array of witness data in hex format
 * @param preserveOrder Whether to preserve the order of witnesses (default: true)
 * @returns Combined content from all valid CKBFS witnesses
 */
export declare function decodeMultipleWitnessContents(witnessHexArray: string[], preserveOrder?: boolean): Uint8Array;
/**
 * Extracts complete file content from witnesses using specified indexes
 * @param witnesses Array of all witnesses from a transaction
 * @param indexes Array of witness indexes that contain CKBFS content
 * @returns Combined content from the specified witness indexes
 */
export declare function extractFileFromWitnesses(witnesses: string[], indexes: number[]): Uint8Array;
/**
 * Decodes file content directly from witness data without blockchain queries
 * @param witnessData Object containing witness information
 * @returns Object containing the decoded file content and metadata
 */
export declare function decodeFileFromWitnessData(witnessData: {
    witnesses: string[];
    indexes: number[] | number;
    filename?: string;
    contentType?: string;
}): {
    content: Uint8Array;
    filename?: string;
    contentType?: string;
    size: number;
};
/**
 * Saves decoded file content directly from witness data
 * @param witnessData Object containing witness information
 * @param outputPath Optional path to save the file
 * @returns The path where the file was saved
 */
export declare function saveFileFromWitnessData(witnessData: {
    witnesses: string[];
    indexes: number[] | number;
    filename?: string;
    contentType?: string;
}, outputPath?: string): string;
