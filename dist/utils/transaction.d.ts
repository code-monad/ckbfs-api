import { ccc, Transaction, Script, Signer } from "@ckb-ccc/core";
import { CKBFSDataType } from "./molecule";
import { NetworkType, ProtocolVersionType } from "./constants";
/**
 * Utility functions for CKB transaction creation and handling
 */
/**
 * Options for creating a CKBFS cell
 */
export interface CKBFSCellOptions {
    contentType: string;
    filename: string;
    capacity?: bigint;
    lock: Script;
    network?: NetworkType;
    version?: ProtocolVersionType;
    useTypeID?: boolean;
}
/**
 * Options for publishing a file to CKBFS
 */
export interface PublishOptions extends CKBFSCellOptions {
    contentChunks: Uint8Array[];
    feeRate?: number;
}
/**
 * Options for appending content to a CKBFS file
 */
export interface AppendOptions {
    ckbfsCell: {
        outPoint: {
            txHash: string;
            index: number;
        };
        data: CKBFSDataType;
        type: Script;
        lock: Script;
        capacity: bigint;
    };
    contentChunks: Uint8Array[];
    feeRate?: number;
    network?: NetworkType;
    version?: ProtocolVersionType;
}
/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
export declare function ensureHexPrefix(value: string): `0x${string}`;
/**
 * Creates a CKBFS cell
 * @param options Options for creating the CKBFS cell
 * @returns The created cell output
 */
export declare function createCKBFSCell(options: CKBFSCellOptions): {
    lock: ccc.Script;
    type: ccc.Script;
    capacity: bigint;
};
/**
 * Creates a transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the created transaction
 */
export declare function createPublishTransaction(signer: Signer, options: PublishOptions): Promise<Transaction>;
/**
 * Creates a transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export declare function createAppendTransaction(signer: Signer, options: AppendOptions): Promise<Transaction>;
/**
 * Creates a complete transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the signed transaction
 */
export declare function publishCKBFS(signer: Signer, options: PublishOptions): Promise<Transaction>;
/**
 * Creates a complete transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the signed transaction
 */
export declare function appendCKBFS(signer: Signer, options: AppendOptions): Promise<Transaction>;
