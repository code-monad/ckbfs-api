import { ccc, Transaction, Script, Signer } from "@ckb-ccc/core";
import { calculateChecksum, updateChecksum } from './checksum';
import { CKBFSData, BackLinkType, CKBFSDataType } from './molecule';
import { createChunkedCKBFSWitnesses } from './witness';
import { 
  getCKBFSScriptConfig, 
  NetworkType, 
  ProtocolVersion, 
  DEFAULT_NETWORK, 
  DEFAULT_VERSION 
} from './constants';

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
  version?: string;
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
    outPoint: { txHash: string; index: number };
    data: CKBFSDataType;
    type: Script;
    lock: Script;
    capacity: bigint;
  };
  contentChunks: Uint8Array[];
  feeRate?: number;
  network?: NetworkType;
  version?: string;
}

/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
function ensureHexPrefix(value: string): `0x${string}` {
  if (value.startsWith('0x')) {
    return value as `0x${string}`;
  }
  return `0x${value}` as `0x${string}`;
}

/**
 * Creates a CKBFS cell
 * @param options Options for creating the CKBFS cell
 * @returns The created cell output
 */
export function createCKBFSCell(options: CKBFSCellOptions) {
  const { 
    contentType, 
    filename, 
    capacity, 
    lock, 
    network = DEFAULT_NETWORK, 
    version = DEFAULT_VERSION,
    useTypeID = false
  } = options;
  
  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, version, useTypeID);
  
  // Create pre CKBFS type script
  const preCkbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  
  // Return the cell output
  return {
    lock,
    type: preCkbfsTypeScript,
    capacity: capacity || 200n * 100000000n, // Default 200 CKB
  };
}

/**
 * Creates a transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the created transaction
 */
export async function createPublishTransaction(
  signer: Signer, 
  options: PublishOptions
): Promise<Transaction> {
  const { 
    contentChunks, 
    contentType, 
    filename, 
    lock, 
    capacity,
    feeRate,
    network = DEFAULT_NETWORK,
    version = DEFAULT_VERSION,
    useTypeID = false
  } = options;
  
  // Calculate checksum for the combined content
  const textEncoder = new TextEncoder();
  const combinedContent = Buffer.concat(contentChunks);
  const checksum = await calculateChecksum(combinedContent);
  
  // Create CKBFS witnesses
  const ckbfsWitnesses = createChunkedCKBFSWitnesses(contentChunks);
  
  // Calculate the actual witness indices where our content is placed
  // Index 0 is reserved for the secp256k1 witness for signing
  // So our CKBFS data starts at index 1
  const contentStartIndex = 1;
  const witnessIndices = Array.from(
    { length: contentChunks.length }, 
    (_, i) => contentStartIndex + i
  );
  
  // Create CKBFS cell output data based on version
  let outputData: Uint8Array;
  
  if (version === ProtocolVersion.V1) {
    // V1 format: Single index field
    // For V1, use the first index where content is placed
    outputData = CKBFSData.pack({
      index: [contentStartIndex],
      checksum,
      contentType: textEncoder.encode(contentType),
      filename: textEncoder.encode(filename),
      backLinks: [],
    }, version);
  } else {
    // V2 format: Multiple indexes
    // For V2, use all the indices where content is placed
    outputData = CKBFSData.pack({
      indexes: witnessIndices,
      checksum,
      contentType: textEncoder.encode(contentType),
      filename: textEncoder.encode(filename),
      backLinks: [],
    }, version);
  }
  
  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, version, useTypeID);
  
  const preCkbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  const ckbfsCellSize = BigInt(outputData.length + preCkbfsTypeScript.occupiedSize + lock.occupiedSize + 8) * 100000000n
  // Create pre transaction without cell deps initially
  const preTx = Transaction.from({
    outputs: [
      createCKBFSCell({ 
        contentType, 
        filename, 
        lock, 
        network, 
        version,
        useTypeID,
        capacity: ckbfsCellSize || capacity
      })
    ],
    witnesses: [
      [], // Empty secp witness for signing
      ...ckbfsWitnesses.map(w => `0x${Buffer.from(w).toString('hex')}`),
    ],
    outputsData: [
      outputData,
    ]
  });
  
  // Add the CKBFS dep group cell dependency
  preTx.addCellDeps({
    outPoint: {
      txHash: ensureHexPrefix(config.depTxHash),
      index: config.depIndex || 0,
    },
    depType: "depGroup"
  });
  
  // Get the recommended address to ensure lock script cell deps are included
  const address = await signer.getRecommendedAddressObj();
  
  // Complete inputs by capacity
  await preTx.completeInputsByCapacity(signer);
  
  // Complete fee change to lock
  await preTx.completeFeeChangeToLock(signer, lock, feeRate || 2000);
  
  // Create type ID args
  const args = ccc.hashTypeId(preTx.inputs[0], 0x0);
  
  // Create CKBFS type script with type ID
  const ckbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    args
  );
  
  // Create final transaction with same cell deps as preTx
  const tx = Transaction.from({
    cellDeps: preTx.cellDeps,
    witnesses: [
      [], // Reset first witness for signing
      ...preTx.witnesses.slice(1)
    ],
    outputsData: preTx.outputsData,
    inputs: preTx.inputs,
    outputs: [
      {
        lock,
        type: ckbfsTypeScript,
        capacity: preTx.outputs[0].capacity,
      },
      ...preTx.outputs.slice(1) // Include rest of outputs (e.g., change)
    ]
  });
  
  return tx;
}

/**
 * Creates a transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export async function createAppendTransaction(
  signer: Signer, 
  options: AppendOptions
): Promise<Transaction> {
  const { 
    ckbfsCell, 
    contentChunks, 
    feeRate,
    network = DEFAULT_NETWORK,
    version = DEFAULT_VERSION 
  } = options;
  const { outPoint, data, type, lock, capacity } = ckbfsCell;
  
  // Get CKBFS script config early to use version info
  const config = getCKBFSScriptConfig(network, version);
  
  // Create CKBFS witnesses - this may vary between V1 and V2
  const ckbfsWitnesses = createChunkedCKBFSWitnesses(contentChunks);
  
  // Combine the new content chunks
  const combinedContent = Buffer.concat(contentChunks);
  
  // Instead of calculating a new checksum from scratch, update the existing checksum
  // with the new content - this is more efficient and matches the Adler32 algorithm's
  // cumulative nature
  const contentChecksum = await updateChecksum(data.checksum, combinedContent);
  console.log(`Updated checksum from ${data.checksum} to ${contentChecksum} for appended content`);
  
  // Create backlink for the current state based on version
  let newBackLink: any;
  
  if (version === ProtocolVersion.V1) {
    // V1 format: Use index field (single number)
    newBackLink = {
      txHash: outPoint.txHash,
      index: data.index && data.index.length > 0 ? data.index[0] : 0,
      checksum: data.checksum,
    };
  } else {
    // V2 format: Use indexes field (array of numbers)
    newBackLink = {
      txHash: outPoint.txHash,
      indexes: data.indexes || data.index || [],
      checksum: data.checksum,
    };
  }
  
  // Update backlinks
  const backLinks = [...(data.backLinks || []), newBackLink];
  
  // Define indices based on version
  let outputData: Uint8Array;
  
  // Calculate the actual witness indices where our content is placed
  // Index 0 is reserved for the secp256k1 witness for signing
  // So our CKBFS data starts at index 1
  const contentStartIndex = 1;
  const witnessIndices = Array.from(
    { length: contentChunks.length }, 
    (_, i) => contentStartIndex + i
  );
  
  if (version === ProtocolVersion.V1) {
    // In V1, use the first index where content is placed
    // (even if we have multiple witnesses, V1 only supports a single index)
    outputData = CKBFSData.pack({
      index: [contentStartIndex],
      checksum: contentChecksum,
      contentType: data.contentType,
      filename: data.filename,
      backLinks,
    }, version);
  } else {
    // In V2, use all the indices where content is placed
    outputData = CKBFSData.pack({
      indexes: witnessIndices,
      checksum: contentChecksum,
      contentType: data.contentType,
      filename: data.filename,
      backLinks,
    }, version);
  }
  
  // Pack the original data to get its size - use the appropriate version
  const originalData = CKBFSData.pack(data, version);
  const originalDataSize = originalData.length;
  
  // Get sizes
  const newDataSize = outputData.length;
  const dataSizeDiff = newDataSize - originalDataSize;
  
  // Calculate the additional capacity needed (in shannons)
  // CKB requires 1 shannon per byte of data
  const additionalCapacity = BigInt(Math.max(0, dataSizeDiff)) * 100000000n;
  
  // Add the additional capacity to the original cell capacity
  console.log(`Original capacity: ${capacity}, Additional needed: ${additionalCapacity}, Data size diff: ${dataSizeDiff}, Version: ${version}`);
  const outputCapacity = capacity + additionalCapacity;

  // Create initial transaction with the CKBFS cell input
  const tx = Transaction.from({
    inputs: [
      {
        previousOutput: {
          txHash: outPoint.txHash,
          index: outPoint.index,
        },
        since: "0x0",
      }
    ],
    outputs: [
      {
        lock,
        type,
        capacity: outputCapacity,
      }
    ],
    witnesses: [
      [], // Empty secp witness for signing
      ...ckbfsWitnesses.map(w => `0x${Buffer.from(w).toString('hex')}`),
    ],
    outputsData: [
      outputData,
    ]
  });
  
  // Add the CKBFS dep group cell dependency
  tx.addCellDeps({
    outPoint: {
      txHash: ensureHexPrefix(config.depTxHash),
      index: config.depIndex || 0,
    },
    depType: "depGroup"
  });
  
  // Get the recommended address to ensure lock script cell deps are included
  const address = await signer.getRecommendedAddressObj();
  
  // If we need more capacity than the original cell had, add additional inputs
  if (additionalCapacity > 0n) {
    // Add more inputs to cover the increased capacity
    await tx.completeInputsByCapacity(signer);
  }
  
  // Complete fee
  await tx.completeFeeChangeToLock(signer, lock || address.script, feeRate || 2000);
  
  return tx;
}

/**
 * Creates a complete transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the signed transaction
 */
export async function publishCKBFS(
  signer: Signer, 
  options: PublishOptions
): Promise<Transaction> {
  const tx = await createPublishTransaction(signer, options);
  return signer.signTransaction(tx);
}

/**
 * Creates a complete transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the signed transaction
 */
export async function appendCKBFS(
  signer: Signer, 
  options: AppendOptions
): Promise<Transaction> {
  const tx = await createAppendTransaction(signer, options);
  return signer.signTransaction(tx);
} 