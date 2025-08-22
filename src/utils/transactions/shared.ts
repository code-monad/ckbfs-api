import { Script, Transaction } from "@ckb-ccc/core";
import { CKBFSDataType } from "../molecule";
import { NetworkType, ProtocolVersionType } from "../constants";

/**
 * Shared interfaces and utilities for transaction handling across all versions
 */

/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
export function ensureHexPrefix(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return `0x${value}` as `0x${string}`;
}

/**
 * Base options for creating a CKBFS cell
 */
export interface BaseCKBFSCellOptions {
  contentType: string;
  filename: string;
  capacity?: bigint;
  lock: Script;
  network?: NetworkType;
  version?: ProtocolVersionType;
  useTypeID?: boolean;
}

/**
 * Base options for publishing a file to CKBFS
 */
export interface BasePublishOptions extends BaseCKBFSCellOptions {
  contentChunks: Uint8Array[];
  feeRate?: number;
  from?: Transaction;
}

/**
 * Base options for appending content to a CKBFS file
 */
export interface BaseAppendOptions {
  ckbfsCell: {
    outPoint: { txHash: string; index: number };
    data: CKBFSDataType;
    type: Script;
    lock: Script;
    capacity: bigint;
  };
  contentChunks: Uint8Array[];
  feeRate?: number;
  network?: NetworkType;
  version?: ProtocolVersionType;
  from?: Transaction;
  witnessStartIndex?: number;
}

/**
 * Common CKBFS cell creation options
 */
export interface CKBFSCellOptions extends BaseCKBFSCellOptions {}