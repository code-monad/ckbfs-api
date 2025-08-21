/**
 * Legacy transaction utilities - re-exports from version-specific modules
 * This file maintains backward compatibility while the actual implementation
 * has been moved to version-specific files in the transactions/ directory
 */

// Re-export shared utilities
export { ensureHexPrefix, CKBFSCellOptions } from "./transactions/shared";

// Re-export V1/V2 utilities for backward compatibility
export {
  PublishOptions,
  AppendOptions,
  createCKBFSCell,
  preparePublishTransaction,
  createPublishTransaction,
  prepareAppendTransaction,
  createAppendTransaction,
  createAppendTransactionDry,
  publishCKBFS,
  appendCKBFS,
} from "./transactions/v1v2";

// Re-export V3 utilities
export {
  PublishV3Options,
  AppendV3Options,
  TransferV3Options,
  createCKBFSV3Cell,
  preparePublishV3Transaction,
  createPublishV3Transaction,
  createAppendV3Transaction,
  createTransferV3Transaction,
  publishCKBFSV3,
  appendCKBFSV3,
  transferCKBFSV3,
} from "./transactions/v3";

// Re-export all from transactions index
export * from "./transactions";