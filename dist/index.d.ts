import { Script, Signer, Transaction } from "@ckb-ccc/core";
import { calculateChecksum, verifyChecksum, updateChecksum, verifyWitnessChecksum } from "./utils/checksum";
import { createCKBFSCell, createPublishTransaction as utilCreatePublishTransaction, createAppendTransaction as utilCreateAppendTransaction, publishCKBFS as utilPublishCKBFS, appendCKBFS as utilAppendCKBFS, CKBFSCellOptions, PublishOptions, AppendOptions } from "./utils/transaction";
import { readFile, readFileAsText, readFileAsUint8Array, writeFile, getContentType, splitFileIntoChunks, combineChunksToFile, getFileContentFromChain, saveFileFromChain } from "./utils/file";
import { createCKBFSWitness, createTextCKBFSWitness, extractCKBFSWitnessContent, isCKBFSWitness, createChunkedCKBFSWitnesses } from "./utils/witness";
import { CKBFSData, BackLinkV1, BackLinkV2, CKBFSDataType, BackLinkType, CKBFS_HEADER, CKBFS_HEADER_STRING } from "./utils/molecule";
import { NetworkType, ProtocolVersion, ProtocolVersionType, DEFAULT_NETWORK, DEFAULT_VERSION, CKBFS_CODE_HASH, CKBFS_TYPE_ID, ADLER32_CODE_HASH, ADLER32_TYPE_ID, DEP_GROUP_TX_HASH, DEPLOY_TX_HASH, getCKBFSScriptConfig, CKBFSScriptConfig } from "./utils/constants";
/**
 * Custom options for file publishing and appending
 */
export interface FileOptions {
    contentType?: string;
    filename?: string;
    capacity?: bigint;
    feeRate?: number;
    network?: NetworkType;
    version?: ProtocolVersionType;
    useTypeID?: boolean;
}
/**
 * Options required when publishing content directly (string or Uint8Array)
 */
export type PublishContentOptions = Omit<FileOptions, "capacity" | "contentType" | "filename"> & Required<Pick<FileOptions, "contentType" | "filename">> & {
    capacity?: bigint;
};
/**
 * Options required when appending content directly (string or Uint8Array)
 */
export type AppendContentOptions = Omit<FileOptions, "contentType" | "filename" | "capacity"> & {
    capacity?: bigint;
};
/**
 * Configuration options for the CKBFS SDK
 */
export interface CKBFSOptions {
    chunkSize?: number;
    version?: ProtocolVersionType;
    useTypeID?: boolean;
    network?: NetworkType;
}
/**
 * Main CKBFS SDK class
 */
export declare class CKBFS {
    private signer;
    private chunkSize;
    private network;
    private version;
    private useTypeID;
    /**
     * Creates a new CKBFS SDK instance
     * @param signerOrPrivateKey The signer instance or CKB private key to use for signing transactions
     * @param networkOrOptions The network type or configuration options
     * @param options Additional configuration options when using privateKey
     */
    constructor(signerOrPrivateKey: Signer | string, networkOrOptions?: NetworkType | CKBFSOptions, options?: CKBFSOptions);
    /**
     * Gets the recommended address object for the signer
     * @returns Promise resolving to the address object
     */
    getAddress(): Promise<import("@ckb-ccc/core").Address>;
    /**
     * Gets the lock script for the signer
     * @returns Promise resolving to the lock script
     */
    getLock(): Promise<Script>;
    /**
     * Gets the CKBFS script configuration for the current settings
     * @returns The CKBFS script configuration
     */
    getCKBFSConfig(): CKBFSScriptConfig;
    /**
     * Publishes a file to CKBFS
     * @param filePath The path to the file to publish
     * @param options Options for publishing the file
     * @returns Promise resolving to the transaction hash
     */
    publishFile(filePath: string, options?: FileOptions): Promise<string>;
    /**
     * Publishes content (string or Uint8Array) directly to CKBFS
     * @param content The content string or byte array to publish
     * @param options Options for publishing the content (contentType and filename are required)
     * @returns Promise resolving to the transaction hash
     */
    publishContent(content: string | Uint8Array, options: PublishContentOptions): Promise<string>;
    /**
     * Appends content from a file to an existing CKBFS file
     * @param filePath The path to the file containing the content to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the transaction hash
     */
    appendFile(filePath: string, ckbfsCell: AppendOptions["ckbfsCell"], options?: Omit<FileOptions, "contentType" | "filename">): Promise<string>;
    /**
     * Appends content (string or Uint8Array) directly to an existing CKBFS file
     * @param content The content string or byte array to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the transaction hash
     */
    appendContent(content: string | Uint8Array, ckbfsCell: AppendOptions["ckbfsCell"], options?: AppendContentOptions): Promise<string>;
    /**
     * Creates a new transaction for publishing a file but doesn't sign or send it
     * @param filePath The path to the file to publish
     * @param options Options for publishing the file
     * @returns Promise resolving to the unsigned transaction
     */
    createPublishTransaction(filePath: string, options?: FileOptions): Promise<Transaction>;
    /**
     * Creates a new transaction for publishing content (string or Uint8Array) directly, but doesn't sign or send it
     * @param content The content string or byte array to publish
     * @param options Options for publishing the content (contentType and filename are required)
     * @returns Promise resolving to the unsigned transaction
     */
    createPublishContentTransaction(content: string | Uint8Array, options: PublishContentOptions): Promise<Transaction>;
    /**
     * Creates a new transaction for appending content from a file but doesn't sign or send it
     * @param filePath The path to the file containing the content to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the unsigned transaction
     */
    createAppendTransaction(filePath: string, ckbfsCell: AppendOptions["ckbfsCell"], options?: Omit<FileOptions, "contentType" | "filename">): Promise<Transaction>;
    /**
     * Creates a new transaction for appending content (string or Uint8Array) directly, but doesn't sign or send it
     * @param content The content string or byte array to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the unsigned transaction
     */
    createAppendContentTransaction(content: string | Uint8Array, ckbfsCell: AppendOptions["ckbfsCell"], options?: AppendContentOptions): Promise<Transaction>;
}
export { calculateChecksum, verifyChecksum, updateChecksum, verifyWitnessChecksum, createCKBFSCell, utilCreatePublishTransaction as createPublishTransaction, utilCreateAppendTransaction as createAppendTransaction, utilPublishCKBFS as publishCKBFS, utilAppendCKBFS as appendCKBFS, readFile, readFileAsText, readFileAsUint8Array, writeFile, getContentType, splitFileIntoChunks, combineChunksToFile, getFileContentFromChain, saveFileFromChain, createCKBFSWitness, createTextCKBFSWitness, extractCKBFSWitnessContent, isCKBFSWitness, createChunkedCKBFSWitnesses, CKBFSData, BackLinkV1, BackLinkV2, CKBFSDataType, BackLinkType, CKBFSCellOptions, PublishOptions, AppendOptions, CKBFS_HEADER, CKBFS_HEADER_STRING, NetworkType, ProtocolVersion, DEFAULT_NETWORK, DEFAULT_VERSION, CKBFS_CODE_HASH, CKBFS_TYPE_ID, ADLER32_CODE_HASH, ADLER32_TYPE_ID, DEP_GROUP_TX_HASH, DEPLOY_TX_HASH, getCKBFSScriptConfig, CKBFSScriptConfig, };
