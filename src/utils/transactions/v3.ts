import { ccc, Transaction, Script, Signer } from "@ckb-ccc/core";
import { calculateChecksum, updateChecksum } from "../checksum";
import { CKBFSData, CKBFSDataType, CKBFSDataV3 } from "../molecule";
import { createChunkedCKBFSV3Witnesses, CKBFSV3WitnessOptions } from "../witness";
import {
  getCKBFSScriptConfig,
  NetworkType,
  ProtocolVersion,
  DEFAULT_NETWORK,
} from "../constants";
import { 
  ensureHexPrefix, 
  BaseCKBFSCellOptions, 
  BasePublishOptions, 
  BaseAppendOptions 
} from "./shared";

/**
 * V3 CKBFS transaction utilities - witnesses-based storage with backlinks
 */

/**
 * V3-specific Options for publishing a file to CKBFS
 */
export interface PublishV3Options extends Omit<BaseCKBFSCellOptions, 'version'> {
  contentChunks: Uint8Array[];
  feeRate?: number;
  from?: Transaction;
  version: typeof ProtocolVersion.V3;
}

/**
 * V3-specific Options for appending content to a CKBFS file
 */
export interface AppendV3Options {
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
  version: typeof ProtocolVersion.V3;
  from?: Transaction;
  witnessStartIndex?: number;
  previousTxHash: string;
  previousWitnessIndex: number;
  previousChecksum: number;
}

/**
 * V3-specific Options for transferring a CKBFS file
 */
export interface TransferV3Options {
  ckbfsCell: {
    outPoint: { txHash: string; index: number };
    data: CKBFSDataType;
    type: Script;
    lock: Script;
    capacity: bigint;
  };
  newLock: Script;
  feeRate?: number;
  network?: NetworkType;
  version: typeof ProtocolVersion.V3;
  from?: Transaction;
  previousTxHash: string;
  previousWitnessIndex: number;
  previousChecksum: number;
}

/**
 * Creates a CKBFS v3 cell
 * @param options Options for creating the CKBFS cell
 * @returns The created cell output
 */
export function createCKBFSV3Cell(options: BaseCKBFSCellOptions) {
  const {
    contentType,
    filename,
    capacity,
    lock,
    network = DEFAULT_NETWORK,
    useTypeID = false,
  } = options;

  // Get CKBFS script config for v3
  const config = getCKBFSScriptConfig(network, ProtocolVersion.V3, useTypeID);

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
 * Prepares a transaction for publishing a file to CKBFS v3 without fee and change handling
 * @param options Options for publishing the file
 * @returns Promise resolving to the prepared transaction and the output index of CKBFS Cell
 */
export async function preparePublishV3Transaction(
  options: PublishV3Options,
): Promise<{tx: Transaction, outputIndex: number, emptyTypeID: boolean}> {
  const {
    from,
    contentChunks,
    contentType,
    filename,
    lock,
    capacity,
    network = DEFAULT_NETWORK,
    useTypeID = false,
  } = options;

  // Calculate checksum for the combined content
  const combinedContent = Buffer.concat(contentChunks);
  const checksum = await calculateChecksum(combinedContent);

  // V3 format uses single index (first witness containing content)
  const contentStartIndex = from?.witnesses.length || 1;
  
  // Create CKBFS v3 witnesses (no backlinks for publish operation)
  const ckbfsWitnesses = createChunkedCKBFSV3Witnesses(contentChunks, {
    // For publish operation, all previous fields are zero
    previousTxHash: '0x' + '00'.repeat(32),
    previousWitnessIndex: 0,
    previousChecksum: 0,
    startIndex: contentStartIndex,
  });
  
  // Create CKBFS v3 cell output data
  const outputData = CKBFSData.pack(
    {
      index: contentStartIndex,
      checksum,
      contentType,
      filename,
    },
    ProtocolVersion.V3,
  );

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, ProtocolVersion.V3, useTypeID);

  // Create pre CKBFS type script
  const preCkbfsTypeScript = new Script(
    ensureHexPrefix(config.codeHash),
    config.hashType as any,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );

  // Calculate the required capacity for the output cell
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
            createCKBFSV3Cell({
              contentType,
              filename,
              lock,
              network,
              useTypeID,
              capacity: ckbfsCellSize || capacity,
            }),
          ]
        : [
            ...from.outputs,
            createCKBFSV3Cell({
              contentType,
              filename,
              lock,
              network,
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
          createCKBFSV3Cell({
            contentType,
            filename,
            lock,
            network,
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
 * Creates a transaction for publishing a file to CKBFS v3
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the created transaction
 */
export async function createPublishV3Transaction(
  signer: Signer,
  options: PublishV3Options,
): Promise<Transaction> {
  const {
    feeRate,
    lock,
  } = options;

  // Use preparePublishV3Transaction to create the base transaction
  const { tx: preTx, outputIndex, emptyTypeID } = await preparePublishV3Transaction(options);

  // Complete inputs by capacity
  await preTx.completeInputsByCapacity(signer);

  // Complete fee change to lock
  await preTx.completeFeeChangeToLock(signer, lock, feeRate || 2000);

  // If emptyTypeID is true, we need to create the proper type ID args
  if (emptyTypeID) {
    // Get CKBFS script config
    const config = getCKBFSScriptConfig(options.network || DEFAULT_NETWORK, ProtocolVersion.V3, options.useTypeID || false);
    
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
              ...output,
              type: ckbfsTypeScript,
            }
          : output
      ),
    });

    return tx;
  }

  return preTx;
}

/**
 * Prepares a transaction for appending content to a CKBFS v3 file without fee and change handling
 * @param options Options for appending content
 * @returns Promise resolving to the prepared transaction and the output index of CKBFS Cell
 */
export async function prepareAppendV3Transaction(
  options: AppendV3Options,
): Promise<{tx: Transaction, outputIndex: number}> {
  const {
    from,
    ckbfsCell,
    contentChunks,
    network = DEFAULT_NETWORK,
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
    witnessStartIndex,
  } = options;

  // Calculate new checksum by updating from previous checksum
  const combinedContent = Buffer.concat(contentChunks);
  const newChecksum = await updateChecksum(previousChecksum, combinedContent);

  // Calculate the actual witness indices where our content is placed
  const contentStartIndex = from?.witnesses.length || witnessStartIndex  || 0;

  // Create CKBFS v3 witnesses with backlink info
  const ckbfsWitnesses = createChunkedCKBFSV3Witnesses(contentChunks, {
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
    startIndex: contentStartIndex,
  });
  
  // Create updated CKBFS v3 cell output data
  const outputData = CKBFSData.pack(
    {
      index: contentStartIndex,
      checksum: newChecksum,
      contentType: ckbfsCell.data.contentType,
      filename: ckbfsCell.data.filename,
    },
    ProtocolVersion.V3,
  );

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, ProtocolVersion.V3, false);

  // Calculate the required capacity for the output cell
  const ckbfsCellSize =
    BigInt(outputData.length + ckbfsCell.type.occupiedSize + ckbfsCell.lock.occupiedSize + 8) *
    100000000n;

  // Use the maximum value between calculated size and original capacity
  const outputCapacity = ckbfsCellSize > ckbfsCell.capacity ? ckbfsCellSize : ckbfsCell.capacity;

  // Create initial transaction with the CKBFS cell input
  let preTx: Transaction;
  if (from) {
    // If from is not empty, inject/merge the fields
    preTx = Transaction.from({
      ...from,
      inputs: from.inputs.length === 0
        ? [
            {
              previousOutput: ckbfsCell.outPoint,
              since: "0x0",
            },
          ]
        : [
            ...from.inputs,
            {
              previousOutput: ckbfsCell.outPoint,
              since: "0x0",
            },
          ],
      outputs: from.outputs.length === 0
        ? [
            {
              lock: ckbfsCell.lock,
              type: ckbfsCell.type,
              capacity: outputCapacity,
            },
          ]
        : [
            ...from.outputs,
            {
              lock: ckbfsCell.lock,
              type: ckbfsCell.type,
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
          previousOutput: ckbfsCell.outPoint,
          since: "0x0",
        },
      ],
      outputs: [
        {
          lock: ckbfsCell.lock,
          type: ckbfsCell.type,
          capacity: outputCapacity,
        },
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

  const outputIndex = from ? from.outputs.length : 0;

  return {tx: preTx, outputIndex};
}

/**
 * Creates a transaction for appending content to a CKBFS v3 file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export async function createAppendV3Transaction(
  signer: Signer,
  options: AppendV3Options,
): Promise<Transaction> {
  const {
    ckbfsCell,
    feeRate,
  } = options;
  const { lock } = ckbfsCell;

  // Use prepareAppendV3Transaction to create the base transaction
  const { tx: preTx, outputIndex } = await prepareAppendV3Transaction(options);

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
  var witnessOffsetIndex = 0;
  // add empty witness for signer if ckbfs's lock is the same as signer's lock
  if (address.script.hash() === lock.hash()) {
    witnesses.push("0x");
    witnessOffsetIndex = 1;
  }
  // add ckbfs witnesses (skip the first witness which is for signing)
  witnesses.push(...preTx.witnesses.slice(witnessOffsetIndex));

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
 * Creates a transaction for appending content to a CKBFS v3 file (dry run without fee completion)
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
export async function createAppendV3TransactionDry(
  signer: Signer,
  options: AppendV3Options,
): Promise<Transaction> {
  const {
    ckbfsCell,
    contentChunks,
    network = DEFAULT_NETWORK,
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
  } = options;
  const { lock } = ckbfsCell;

  // Calculate new checksum by updating from previous checksum
  const combinedContent = Buffer.concat(contentChunks);
  const newChecksum = await updateChecksum(previousChecksum, combinedContent);

  // Get the recommended address to ensure lock script cell deps are included
  const address = await signer.getRecommendedAddressObj();

  // Calculate the actual witness indices where our content is placed
  // CKBFS data starts at index 1 if signer's lock script is the same as ckbfs's lock script
  // else CKBFS data starts at index 0
  const contentStartIndex = address.script.hash() === lock.hash() ? 1 : 0;

  // Create CKBFS v3 witnesses with backlink info
  const ckbfsWitnesses = createChunkedCKBFSV3Witnesses(contentChunks, {
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
    startIndex: contentStartIndex,
  });
  
  // Create updated CKBFS v3 cell output data
  const outputData = CKBFSData.pack(
    {
      index: contentStartIndex,
      checksum: newChecksum,
      contentType: ckbfsCell.data.contentType,
      filename: ckbfsCell.data.filename,
    },
    ProtocolVersion.V3,
  );

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, ProtocolVersion.V3, false);

  // Calculate the required capacity for the output cell
  const ckbfsCellSize =
    BigInt(outputData.length + ckbfsCell.type.occupiedSize + ckbfsCell.lock.occupiedSize + 8) *
    100000000n;

  console.log(
    `Original capacity: ${ckbfsCell.capacity}, Calculated size: ${ckbfsCellSize}, Data size: ${outputData.length}`,
  );

  // Use the maximum value between calculated size and original capacity
  const outputCapacity = ckbfsCellSize > ckbfsCell.capacity ? ckbfsCellSize : ckbfsCell.capacity;

  // Create initial transaction with the CKBFS cell input
  const tx = Transaction.from({
    inputs: [
      {
        previousOutput: ckbfsCell.outPoint,
        since: "0x0",
      },
    ],
    outputs: [
      {
        lock: ckbfsCell.lock,
        type: ckbfsCell.type,
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

  return tx;
}

/**
 * Creates a transaction for transferring ownership of a CKBFS v3 file
 * @param signer The signer to use for the transaction
 * @param options Options for transferring the file
 * @returns Promise resolving to the created transaction
 */
export async function createTransferV3Transaction(
  signer: Signer,
  options: TransferV3Options,
): Promise<Transaction> {
  const {
    ckbfsCell,
    newLock,
    feeRate,
    network = DEFAULT_NETWORK,
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
  } = options;

  // Create CKBFS v3 witness with backlink info but no content (transfer only)
  const ckbfsWitnesses = createChunkedCKBFSV3Witnesses([new Uint8Array(0)], {
    previousTxHash,
    previousWitnessIndex,
    previousChecksum,
  });

  // V3 format uses single index (first witness containing backlink)
  const contentStartIndex = 1; // First witness is for signer, backlink at index 1
  
  // Create CKBFS v3 cell output data (unchanged for transfer)
  const outputData = CKBFSData.pack(
    {
      index: contentStartIndex,
      checksum: ckbfsCell.data.checksum, // Checksum unchanged in transfer
      contentType: ckbfsCell.data.contentType,
      filename: ckbfsCell.data.filename,
    },
    ProtocolVersion.V3,
  );

  // Get CKBFS script config
  const config = getCKBFSScriptConfig(network, ProtocolVersion.V3, false);

  // Create transaction
  const tx = Transaction.from({
    inputs: [
      {
        previousOutput: ckbfsCell.outPoint,
        since: "0x0",
      },
    ],
    outputs: [
      {
        lock: newLock,
        type: ckbfsCell.type,
        capacity: ckbfsCell.capacity,
      },
    ],
    witnesses: [
      [], // Empty secp witness for signing
      ...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`),
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

  // Complete inputs by capacity for fees
  await tx.completeInputsByCapacity(signer);

  // Complete fee change to lock
  await tx.completeFeeChangeToLock(signer, newLock, feeRate || 2000);

  return tx;
}

/**
 * Creates a complete transaction for publishing a file to CKBFS v3
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the signed transaction
 */
export async function publishCKBFSV3(
  signer: Signer,
  options: PublishV3Options,
): Promise<Transaction> {
  const tx = await createPublishV3Transaction(signer, options);
  return signer.signTransaction(tx);
}

/**
 * Creates a complete transaction for appending content to a CKBFS v3 file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the signed transaction
 */
export async function appendCKBFSV3(
  signer: Signer,
  options: AppendV3Options,
): Promise<Transaction> {
  const tx = await createAppendV3Transaction(signer, options);
  return signer.signTransaction(tx);
}

/**
 * Creates a complete transaction for transferring ownership of a CKBFS v3 file
 * @param signer The signer to use for the transaction
 * @param options Options for transferring the file
 * @returns Promise resolving to the signed transaction
 */
export async function transferCKBFSV3(
  signer: Signer,
  options: TransferV3Options,
): Promise<Transaction> {
  const tx = await createTransferV3Transaction(signer, options);
  return signer.signTransaction(tx);
}
