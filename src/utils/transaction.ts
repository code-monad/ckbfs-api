import { ccc, Transaction, Script, Signer } from "@ckb-ccc/core";
import { calculateChecksum, updateChecksum } from "./checksum";
import { CKBFSData, BackLinkType, CKBFSDataType } from "./molecule";
import { createChunkedCKBFSWitnesses } from "./witness";
import {
  getCKBFSScriptConfig,
  NetworkType,
  ProtocolVersion,
  ProtocolVersionType,
  DEFAULT_NETWORK,
  DEFAULT_VERSION,
} from "./constants";

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
  from?: Transaction;
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
  version?: ProtocolVersionType;
  from?: Transaction;
}

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
    useTypeID = false,
  } = options;

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, version, useTypeID);

  // Create pre CKBFS type script
  const preCkbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );

  // Return the cell output
  return {
    lock,
    type: preCkbfsTypeScript,
    capacity: capacity || 200n * 100000000n, // Default 200 CKB
  };
}

/**
 * Prepares a transaction for publishing a file to CKBFS without fee and change handling
 * You will need to manually set the typeID if you did not provide inputs, or just check is return value emptyTypeID is true
 * @param options Options for publishing the file
 * @returns Promise resolving to the prepared transaction and the output index of CKBFS Cell
 */
export async function preparePublishTransaction(
  options: PublishOptions,
): Promise<{tx: Transaction, outputIndex: number, emptyTypeID: boolean}> { // if emptyTypeID is true, you shall manually set the typeID after
  const {
    from,
    contentChunks,
    contentType,
    filename,
    lock,
    capacity,
    network = DEFAULT_NETWORK,
    version = DEFAULT_VERSION,
    useTypeID = false,
  } = options;

  // Calculate checksum for the combined content
  const combinedContent = Buffer.concat(contentChunks);
  const checksum = await calculateChecksum(combinedContent);

  // Create CKBFS witnesses - each chunk already includes the CKBFS header
  // Pass 0 as version byte - this is the protocol version byte in the witness header
  // not to be confused with the Protocol Version (V1 vs V2)
  const ckbfsWitnesses = createChunkedCKBFSWitnesses(contentChunks);

  // Calculate the actual witness indices where our content is placed

  const contentStartIndex = from?.witnesses.length || 1;
  const witnessIndices = Array.from(
    { length: contentChunks.length },
    (_, i) => contentStartIndex + i,
  );

  // Create CKBFS cell output data based on version
  let outputData: Uint8Array;

  if (version === ProtocolVersion.V1) {
    // V1 format: Single index field (a single number, not an array)
    // For V1, use the first index where content is placed
    outputData = CKBFSData.pack(
      {
        index: contentStartIndex,
        checksum,
        contentType: contentType,
        filename: filename,
        backLinks: [],
      },
      version,
    );
  } else {
    // V2 format: Multiple indexes (array of numbers)
    // For V2, use all the indices where content is placed
    outputData = CKBFSData.pack(
      {
        indexes: witnessIndices,
        checksum,
        contentType,
        filename,
        backLinks: [],
      },
      version,
    );
  }

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, version, useTypeID);

  const preCkbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );
  const ckbfsCellSize =
    BigInt(
      outputData.length +
        preCkbfsTypeScript.occupiedSize +
        lock.occupiedSize +
        8,
    ) * 100000000n;
  // Create pre transaction without cell deps initially
  let preTx: Transaction;
  if(from) {
    // If from is not empty, inject/merge the fields
    preTx = Transaction.from({
      ...from,
      outputs: from.outputs.length === 0 
        ? [
            createCKBFSCell({
              contentType,
              filename,
              lock,
              network,
              version,
              useTypeID,
              capacity: ckbfsCellSize || capacity,
            }),
          ]
        : [
            ...from.outputs,
            createCKBFSCell({
              contentType,
              filename,
              lock,
              network,
              version,
              useTypeID,
              capacity: ckbfsCellSize || capacity,
            }),
          ],
      witnesses: from.witnesses.length === 0 
        ? [
            [], // Empty secp witness for signing if not provided
            ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
          ]
        : [
            ...from.witnesses,
            ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
          ],
      outputsData: from.outputsData.length === 0 
        ? [outputData]
        : [
            ...from.outputsData,
            outputData,
          ],
    });
  } else {
      preTx = Transaction.from({
        outputs: [
          createCKBFSCell({
            contentType,
            filename,
            lock,
            network,
            version,
            useTypeID,
            capacity: ckbfsCellSize || capacity,
          }),
        ],
        witnesses: [
          [], // Empty secp witness for signing
          ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
        ],
        outputsData: [outputData],
      });
  }

  // Add the CKBFS dep group cell dependency
  preTx.addCellDeps({
    outPoint: {
      txHash: ensureHexPrefix(config.depTxHash),
      index: config.depIndex || 0,
    },
    depType: "depGroup",
  });

  // Create type ID args
  const outputIndex = from ? from.outputs.length : 0;
  const args = preTx.inputs.length > 0 ? ccc.hashTypeId(preTx.inputs[0], outputIndex) : "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Create CKBFS type script with type ID
  const ckbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    args,
  );

  // Create final transaction with same cell deps as preTx
  const tx = Transaction.from({
    cellDeps: preTx.cellDeps,
    witnesses: preTx.witnesses,
    outputsData: preTx.outputsData,
    inputs: preTx.inputs,
    outputs: outputIndex === 0 
      ? [
          {
            lock,
            type: ckbfsTypeScript,
            capacity: preTx.outputs[outputIndex].capacity,
          },
        ]
      : [
          ...preTx.outputs.slice(0, outputIndex), // Include rest of outputs (e.g., change)
          {
            lock,
            type: ckbfsTypeScript,
            capacity: preTx.outputs[outputIndex].capacity,
          },
        ],
  });

  return {tx, outputIndex, emptyTypeID: args === "0x0000000000000000000000000000000000000000000000000000000000000000"};
}

/**
 * Creates a transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the created transaction
 */
export async function createPublishTransaction(
  signer: Signer,
  options: PublishOptions,
): Promise<Transaction> {
  const {
    feeRate,
    lock,
  } = options;

  // Use preparePublishTransaction to create the base transaction
  const { tx: preTx, outputIndex, emptyTypeID } = await preparePublishTransaction(options);

  // Complete inputs by capacity
  await preTx.completeInputsByCapacity(signer);

  // Complete fee change to lock
  await preTx.completeFeeChangeToLock(signer, lock, feeRate || 2000);

  // If emptyTypeID is true, we need to create the proper type ID args
  if (emptyTypeID) {
    // Get CKBFS script config
    const config = getCKBFSScriptConfig(options.network || DEFAULT_NETWORK, options.version || DEFAULT_VERSION, options.useTypeID || false);
    
    // Create type ID args
    const args = ccc.hashTypeId(preTx.inputs[0], outputIndex);

    // Create CKBFS type script with type ID
    const ckbfsTypeScript = new Script(
      ensureHexPrefix(config.codeHash),
      config.hashType as any,
      args,
    );

    // Create final transaction with updated type script
    const tx = Transaction.from({
      cellDeps: preTx.cellDeps,
      witnesses: preTx.witnesses,
      outputsData: preTx.outputsData,
      inputs: preTx.inputs,
      outputs: preTx.outputs.map((output, index) => 
        index === outputIndex 
          ? {
              lock,
              type: ckbfsTypeScript,
              capacity: output.capacity,
            }
          : output
      ),
    });

    return tx;
  } else {
    // If typeID was already set properly, just reset the first witness for signing
    const tx = Transaction.from({
      cellDeps: preTx.cellDeps,
      witnesses: preTx.witnesses,
      outputsData: preTx.outputsData,
      inputs: preTx.inputs,
      outputs: preTx.outputs,
    });

    return tx;
  }
}

/**
 * Prepares a transaction for appending content to a CKBFS file without fee and change handling
 * @param options Options for appending content
 * @returns Promise resolving to the prepared transaction and the output index of CKBFS Cell
 */
export async function prepareAppendTransaction(
  options: AppendOptions,
): Promise<{tx: Transaction, outputIndex: number}> {
  const {
    from,
    ckbfsCell,
    contentChunks,
    network = DEFAULT_NETWORK,
    version = DEFAULT_VERSION,
  } = options;
  const { outPoint, data, type, lock, capacity } = ckbfsCell;

  // Get CKBFS script config early to use version info
  const config = getCKBFSScriptConfig(network, version);

  // Create CKBFS witnesses - each chunk already includes the CKBFS header
  // Pass 0 as version byte - this is the protocol version byte in the witness header
  // not to be confused with the Protocol Version (V1 vs V2)
  const ckbfsWitnesses = createChunkedCKBFSWitnesses(contentChunks);

  // Combine the new content chunks for checksum calculation
  const combinedContent = Buffer.concat(contentChunks);

  // Update the existing checksum with the new content - this matches Adler32's
  // cumulative nature as required by Rule 11 in the RFC
  const contentChecksum = await updateChecksum(data.checksum, combinedContent);

  // Calculate the actual witness indices where our content is placed
  const contentStartIndex = from?.witnesses.length || 1;
  const witnessIndices = Array.from(
    { length: contentChunks.length },
    (_, i) => contentStartIndex + i,
  );

  // Create backlink for the current state based on version
  let newBackLink: any;

  if (version === ProtocolVersion.V1) {
    // V1 format: Use index field (single number)
    newBackLink = {
      // In V1, field order is index, checksum, txHash
      // and index is a single number value, not an array
      index:
        data.index ||
        (data.indexes && data.indexes.length > 0 ? data.indexes[0] : 0),
      checksum: data.checksum,
      txHash: outPoint.txHash,
    };
  } else {
    // V2 format: Use indexes field (array of numbers)
    newBackLink = {
      // In V2, field order is indexes, checksum, txHash
      // and indexes is an array of numbers
      indexes: data.indexes || (data.index ? [data.index] : []),
      checksum: data.checksum,
      txHash: outPoint.txHash,
    };
  }

  // Update backlinks - add the new one to the existing backlinks array
  const backLinks = [...(data.backLinks || []), newBackLink];

  // Define output data based on version
  let outputData: Uint8Array;

  if (version === ProtocolVersion.V1) {
    // In V1, index is a single number, not an array
    // The first witness index is used (V1 can only reference one witness)
    outputData = CKBFSData.pack(
      {
        index: witnessIndices[0], // Use only the first index as a number
        checksum: contentChecksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks,
      },
      ProtocolVersion.V1,
    ); // Explicitly use V1 for packing
  } else {
    // In V2, indexes is an array of witness indices
    outputData = CKBFSData.pack(
      {
        indexes: witnessIndices,
        checksum: contentChecksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks,
      },
      ProtocolVersion.V2,
    ); // Explicitly use V2 for packing
  }

  // Calculate the required capacity for the output cell
  // This accounts for:
  // 1. The output data size
  // 2. The type script's occupied size
  // 3. The lock script's occupied size
  // 4. A constant of 8 bytes (for header overhead)
  const ckbfsCellSize =
    BigInt(outputData.length + type.occupiedSize + lock.occupiedSize + 8) *
    100000000n;

  // Use the maximum value between calculated size and original capacity
  // to ensure we have enough capacity but don't decrease capacity unnecessarily
  const outputCapacity = ckbfsCellSize > capacity ? ckbfsCellSize : capacity;

  // Create initial transaction with the CKBFS cell input
  let preTx: Transaction;
  if (from) {
    // If from is not empty, inject/merge the fields
    preTx = Transaction.from({
      ...from,
      inputs: from.inputs.length === 0
        ? [
            {
              previousOutput: {
                txHash: outPoint.txHash,
                index: outPoint.index,
              },
              since: "0x0",
            },
          ]
        : [
            ...from.inputs,
            {
              previousOutput: {
                txHash: outPoint.txHash,
                index: outPoint.index,
              },
              since: "0x0",
            },
          ],
      outputs: from.outputs.length === 0
        ? [
            {
              lock,
              type,
              capacity: outputCapacity,
            },
          ]
        : [
            ...from.outputs,
            {
              lock,
              type,
              capacity: outputCapacity,
            },
          ],
      outputsData: from.outputsData.length === 0
        ? [outputData]
        : [
            ...from.outputsData,
            outputData,
          ],
      witnesses: from.witnesses.length === 0
        ? [
            [], // Empty secp witness for signing if not provided
            ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
          ]
        : [
            ...from.witnesses,
            ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
          ],
    });
  } else {
    preTx = Transaction.from({
      inputs: [
        {
          previousOutput: {
            txHash: outPoint.txHash,
            index: outPoint.index,
          },
          since: "0x0",
        },
      ],
      outputs: [
        {
          lock,
          type,
          capacity: outputCapacity,
        },
      ],
      outputsData: [outputData],
      witnesses: [
        [], // Empty secp witness for signing
        ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
      ],
    });
  }

  // Add the CKBFS dep group cell dependency
  preTx.addCellDeps({
    outPoint: {
      txHash: ensureHexPrefix(config.depTxHash),
      index: config.depIndex || 0,
    },
    depType: "depGroup",
  });

  const outputIndex = from ? from.outputs.length : 0;

  return {tx: preTx, outputIndex};
}

/**
 * Creates a transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export async function createAppendTransaction(
  signer: Signer,
  options: AppendOptions,
): Promise<Transaction> {
  const {
    ckbfsCell,
    feeRate,
  } = options;
  const { lock } = ckbfsCell;

  // Use prepareAppendTransaction to create the base transaction
  const { tx: preTx, outputIndex } = await prepareAppendTransaction(options);

  // Get the recommended address to ensure lock script cell deps are included
  const address = await signer.getRecommendedAddressObj();

  const inputsBefore = preTx.inputs.length;
  // If we need more capacity than the original cell had, add additional inputs
  if (preTx.outputs[outputIndex].capacity > ckbfsCell.capacity) {
    console.log(
      `Need additional capacity: ${preTx.outputs[outputIndex].capacity - ckbfsCell.capacity} shannons`,
    );
    // Add more inputs to cover the increased capacity
    await preTx.completeInputsByCapacity(signer);
  }

  const witnesses: any = [];
  // add empty witness for signer if ckbfs's lock is the same as signer's lock
  if (address.script.hash() === lock.hash()) {
    witnesses.push("0x");
  }
  // add ckbfs witnesses (skip the first witness which is for signing)
  witnesses.push(...preTx.witnesses.slice(1));

  // Add empty witnesses for additional signer inputs
  // This is to ensure that the transaction is valid and can be signed
  for (let i = inputsBefore; i < preTx.inputs.length; i++) {
    witnesses.push("0x");
  }
  preTx.witnesses = witnesses;

  // Complete fee
  await preTx.completeFeeChangeToLock(signer, address.script, feeRate || 2000);

  return preTx;
}

/**
 * Creates a transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export async function createAppendTransactionDry(
  signer: Signer,
  options: AppendOptions,
): Promise<Transaction> {
  const {
    ckbfsCell,
    contentChunks,
    network = DEFAULT_NETWORK,
    version = DEFAULT_VERSION,
  } = options;
  const { outPoint, data, type, lock, capacity } = ckbfsCell;

  // Get CKBFS script config early to use version info
  const config = getCKBFSScriptConfig(network, version);

  // Create CKBFS witnesses - each chunk already includes the CKBFS header
  // Pass 0 as version byte - this is the protocol version byte in the witness header
  // not to be confused with the Protocol Version (V1 vs V2)
  const ckbfsWitnesses = createChunkedCKBFSWitnesses(contentChunks);

  // Combine the new content chunks for checksum calculation
  const combinedContent = Buffer.concat(contentChunks);

  // Update the existing checksum with the new content - this matches Adler32's
  // cumulative nature as required by Rule 11 in the RFC
  const contentChecksum = await updateChecksum(data.checksum, combinedContent);
  console.log(
    `Updated checksum from ${data.checksum} to ${contentChecksum} for appended content`,
  );

  // Get the recommended address to ensure lock script cell deps are included
  const address = await signer.getRecommendedAddressObj();

  // Calculate the actual witness indices where our content is placed
  // CKBFS data starts at index 1 if signer's lock script is the same as ckbfs's lock script
  // else CKBFS data starts at index 0
  const contentStartIndex = address.script.hash() === lock.hash() ? 1 : 0;
  const witnessIndices = Array.from(
    { length: contentChunks.length },
    (_, i) => contentStartIndex + i,
  );

  // Create backlink for the current state based on version
  let newBackLink: any;

  if (version === ProtocolVersion.V1) {
    // V1 format: Use index field (single number)
    newBackLink = {
      // In V1, field order is index, checksum, txHash
      // and index is a single number value, not an array
      index:
        data.index ||
        (data.indexes && data.indexes.length > 0 ? data.indexes[0] : 0),
      checksum: data.checksum,
      txHash: outPoint.txHash,
    };
  } else {
    // V2 format: Use indexes field (array of numbers)
    newBackLink = {
      // In V2, field order is indexes, checksum, txHash
      // and indexes is an array of numbers
      indexes: data.indexes || (data.index ? [data.index] : []),
      checksum: data.checksum,
      txHash: outPoint.txHash,
    };
  }

  // Update backlinks - add the new one to the existing backlinks array
  const backLinks = [...(data.backLinks || []), newBackLink];

  // Define output data based on version
  let outputData: Uint8Array;

  if (version === ProtocolVersion.V1) {
    // In V1, index is a single number, not an array
    // The first witness index is used (V1 can only reference one witness)
    outputData = CKBFSData.pack(
      {
        index: witnessIndices[0], // Use only the first index as a number
        checksum: contentChecksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks,
      },
      ProtocolVersion.V1,
    ); // Explicitly use V1 for packing
  } else {
    // In V2, indexes is an array of witness indices
    outputData = CKBFSData.pack(
      {
        indexes: witnessIndices,
        checksum: contentChecksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks,
      },
      ProtocolVersion.V2,
    ); // Explicitly use V2 for packing
  }


  // Calculate the required capacity for the output cell
  // This accounts for:
  // 1. The output data size
  // 2. The type script's occupied size
  // 3. The lock script's occupied size
  // 4. A constant of 8 bytes (for header overhead)
  const ckbfsCellSize =
    BigInt(outputData.length + type.occupiedSize + lock.occupiedSize + 8) *
    100000000n;

  console.log(
    `Original capacity: ${capacity}, Calculated size: ${ckbfsCellSize}, Data size: ${outputData.length}`,
  );

  // Use the maximum value between calculated size and original capacity
  // to ensure we have enough capacity but don't decrease capacity unnecessarily
  const outputCapacity = ckbfsCellSize > capacity ? ckbfsCellSize : capacity;

  // Create initial transaction with the CKBFS cell input
  const tx = Transaction.from({
    inputs: [
      {
        previousOutput: {
          txHash: outPoint.txHash,
          index: outPoint.index,
        },
        since: "0x0",
      },
    ],
    outputs: [
      {
        lock,
        type,
        capacity: outputCapacity,
      },
    ],
    outputsData: [outputData],
  });

  // Add the CKBFS dep group cell dependency
  tx.addCellDeps({
    outPoint: {
      txHash: ensureHexPrefix(config.depTxHash),
      index: config.depIndex || 0,
    },
    depType: "depGroup",
  });

  const inputsBefore = tx.inputs.length;
  // // If we need more capacity than the original cell had, add additional inputs
  // if (outputCapacity > capacity) {
  //   console.log(
  //     `Need additional capacity: ${outputCapacity - capacity} shannons`,
  //   );
  //   // Add more inputs to cover the increased capacity
  //   await tx.completeInputsByCapacity(signer);
  // }

  const witnesses: any = [];
  // add empty witness for signer if ckbfs's lock is the same as signer's lock
  if (address.script.hash() === lock.hash()) {
    witnesses.push("0x");
  }
  // add ckbfs witnesses
  witnesses.push(
    ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
  );

  // Add empty witnesses for signer's input
  // This is to ensure that the transaction is valid and can be signed
  for (let i = inputsBefore; i < tx.inputs.length; i++) {
    witnesses.push("0x");
  }
  tx.witnesses = witnesses;

  // Complete fee
  //await tx.completeFeeChangeToLock(signer, address.script, feeRate || 2000);

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
  options: PublishOptions,
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
  options: AppendOptions,
): Promise<Transaction> {
  const tx = await createAppendTransaction(signer, options);
  return signer.signTransaction(tx);
}
