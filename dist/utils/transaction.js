"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureHexPrefix = ensureHexPrefix;
exports.createCKBFSCell = createCKBFSCell;
exports.createPublishTransaction = createPublishTransaction;
exports.createAppendTransaction = createAppendTransaction;
exports.publishCKBFS = publishCKBFS;
exports.appendCKBFS = appendCKBFS;
const core_1 = require("@ckb-ccc/core");
const checksum_1 = require("./checksum");
const molecule_1 = require("./molecule");
const witness_1 = require("./witness");
const constants_1 = require("./constants");
/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
function ensureHexPrefix(value) {
    if (value.startsWith("0x")) {
        return value;
    }
    return `0x${value}`;
}
/**
 * Creates a CKBFS cell
 * @param options Options for creating the CKBFS cell
 * @returns The created cell output
 */
function createCKBFSCell(options) {
    const { contentType, filename, capacity, lock, network = constants_1.DEFAULT_NETWORK, version = constants_1.DEFAULT_VERSION, useTypeID = false, } = options;
    // Get CKBFS script config
    const config = (0, constants_1.getCKBFSScriptConfig)(network, version, useTypeID);
    // Create pre CKBFS type script
    const preCkbfsTypeScript = new core_1.Script(ensureHexPrefix(config.codeHash), config.hashType, "0x0000000000000000000000000000000000000000000000000000000000000000");
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
async function createPublishTransaction(signer, options) {
    const { contentChunks, contentType, filename, lock, capacity, feeRate, network = constants_1.DEFAULT_NETWORK, version = constants_1.DEFAULT_VERSION, useTypeID = false, } = options;
    // Calculate checksum for the combined content
    const textEncoder = new TextEncoder();
    const combinedContent = Buffer.concat(contentChunks);
    const checksum = await (0, checksum_1.calculateChecksum)(combinedContent);
    // Create CKBFS witnesses - each chunk already includes the CKBFS header
    // Pass 0 as version byte - this is the protocol version byte in the witness header
    // not to be confused with the Protocol Version (V1 vs V2)
    const ckbfsWitnesses = (0, witness_1.createChunkedCKBFSWitnesses)(contentChunks);
    // Calculate the actual witness indices where our content is placed
    // Index 0 is reserved for the secp256k1 witness for signing
    // So our CKBFS data starts at index 1
    const contentStartIndex = 1;
    const witnessIndices = Array.from({ length: contentChunks.length }, (_, i) => contentStartIndex + i);
    // Create CKBFS cell output data based on version
    let outputData;
    if (version === constants_1.ProtocolVersion.V1) {
        // V1 format: Single index field (a single number, not an array)
        // For V1, use the first index where content is placed
        outputData = molecule_1.CKBFSData.pack({
            index: contentStartIndex,
            checksum,
            contentType: contentType,
            filename: filename,
            backLinks: [],
        }, version);
    }
    else {
        // V2 format: Multiple indexes (array of numbers)
        // For V2, use all the indices where content is placed
        outputData = molecule_1.CKBFSData.pack({
            indexes: witnessIndices,
            checksum,
            contentType,
            filename,
            backLinks: [],
        }, version);
    }
    // Get CKBFS script config
    const config = (0, constants_1.getCKBFSScriptConfig)(network, version, useTypeID);
    const preCkbfsTypeScript = new core_1.Script(ensureHexPrefix(config.codeHash), config.hashType, "0x0000000000000000000000000000000000000000000000000000000000000000");
    const ckbfsCellSize = BigInt(outputData.length +
        preCkbfsTypeScript.occupiedSize +
        lock.occupiedSize +
        8) * 100000000n;
    // Create pre transaction without cell deps initially
    const preTx = core_1.Transaction.from({
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
    // Add the CKBFS dep group cell dependency
    preTx.addCellDeps({
        outPoint: {
            txHash: ensureHexPrefix(config.depTxHash),
            index: config.depIndex || 0,
        },
        depType: "depGroup",
    });
    // Get the recommended address to ensure lock script cell deps are included
    const address = await signer.getRecommendedAddressObj();
    // Complete inputs by capacity
    await preTx.completeInputsByCapacity(signer);
    // Complete fee change to lock
    await preTx.completeFeeChangeToLock(signer, lock, feeRate || 2000);
    // Create type ID args
    const args = core_1.ccc.hashTypeId(preTx.inputs[0], 0x0);
    // Create CKBFS type script with type ID
    const ckbfsTypeScript = new core_1.Script(ensureHexPrefix(config.codeHash), config.hashType, args);
    // Create final transaction with same cell deps as preTx
    const tx = core_1.Transaction.from({
        cellDeps: preTx.cellDeps,
        witnesses: [
            [], // Reset first witness for signing
            ...preTx.witnesses.slice(1),
        ],
        outputsData: preTx.outputsData,
        inputs: preTx.inputs,
        outputs: [
            {
                lock,
                type: ckbfsTypeScript,
                capacity: preTx.outputs[0].capacity,
            },
            ...preTx.outputs.slice(1), // Include rest of outputs (e.g., change)
        ],
    });
    return tx;
}
/**
 * Creates a transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the created transaction
 */
async function createAppendTransaction(signer, options) {
    const { ckbfsCell, contentChunks, feeRate, network = constants_1.DEFAULT_NETWORK, version = constants_1.DEFAULT_VERSION, } = options;
    const { outPoint, data, type, lock, capacity } = ckbfsCell;
    // Get CKBFS script config early to use version info
    const config = (0, constants_1.getCKBFSScriptConfig)(network, version);
    // Create CKBFS witnesses - each chunk already includes the CKBFS header
    // Pass 0 as version byte - this is the protocol version byte in the witness header
    // not to be confused with the Protocol Version (V1 vs V2)
    const ckbfsWitnesses = (0, witness_1.createChunkedCKBFSWitnesses)(contentChunks);
    // Combine the new content chunks for checksum calculation
    const combinedContent = Buffer.concat(contentChunks);
    // Update the existing checksum with the new content - this matches Adler32's
    // cumulative nature as required by Rule 11 in the RFC
    const contentChecksum = await (0, checksum_1.updateChecksum)(data.checksum, combinedContent);
    console.log(`Updated checksum from ${data.checksum} to ${contentChecksum} for appended content`);
    // Get the recommended address to ensure lock script cell deps are included
    const address = await signer.getRecommendedAddressObj();
    // Calculate the actual witness indices where our content is placed
    // CKBFS data starts at index 1 if signer's lock script is the same as ckbfs's lock script
    // else CKBFS data starts at index 0
    const contentStartIndex = address.script.hash() === lock.hash() ? 1 : 0;
    const witnessIndices = Array.from({ length: contentChunks.length }, (_, i) => contentStartIndex + i);
    // Create backlink for the current state based on version
    let newBackLink;
    if (version === constants_1.ProtocolVersion.V1) {
        // V1 format: Use index field (single number)
        newBackLink = {
            // In V1, field order is index, checksum, txHash
            // and index is a single number value, not an array
            index: data.index ||
                (data.indexes && data.indexes.length > 0 ? data.indexes[0] : 0),
            checksum: data.checksum,
            txHash: outPoint.txHash,
        };
    }
    else {
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
    let outputData;
    if (version === constants_1.ProtocolVersion.V1) {
        // In V1, index is a single number, not an array
        // The first witness index is used (V1 can only reference one witness)
        outputData = molecule_1.CKBFSData.pack({
            index: witnessIndices[0], // Use only the first index as a number
            checksum: contentChecksum,
            contentType: data.contentType,
            filename: data.filename,
            backLinks,
        }, constants_1.ProtocolVersion.V1); // Explicitly use V1 for packing
    }
    else {
        // In V2, indexes is an array of witness indices
        outputData = molecule_1.CKBFSData.pack({
            indexes: witnessIndices,
            checksum: contentChecksum,
            contentType: data.contentType,
            filename: data.filename,
            backLinks,
        }, constants_1.ProtocolVersion.V2); // Explicitly use V2 for packing
    }
    // Pack the original data to get its size - use the appropriate version
    const originalData = molecule_1.CKBFSData.pack(data, version);
    const originalDataSize = originalData.length;
    // Get sizes and calculate capacity requirements
    const newDataSize = outputData.length;
    // Calculate the required capacity for the output cell
    // This accounts for:
    // 1. The output data size
    // 2. The type script's occupied size
    // 3. The lock script's occupied size
    // 4. A constant of 8 bytes (for header overhead)
    const ckbfsCellSize = BigInt(outputData.length + type.occupiedSize + lock.occupiedSize + 8) *
        100000000n;
    console.log(`Original capacity: ${capacity}, Calculated size: ${ckbfsCellSize}, Data size: ${outputData.length}`);
    // Use the maximum value between calculated size and original capacity
    // to ensure we have enough capacity but don't decrease capacity unnecessarily
    const outputCapacity = ckbfsCellSize > capacity ? ckbfsCellSize : capacity;
    // Create initial transaction with the CKBFS cell input
    const tx = core_1.Transaction.from({
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
    // If we need more capacity than the original cell had, add additional inputs
    if (outputCapacity > capacity) {
        console.log(`Need additional capacity: ${outputCapacity - capacity} shannons`);
        // Add more inputs to cover the increased capacity
        await tx.completeInputsByCapacity(signer);
    }
    const witnesses = [];
    // add empty witness for signer if ckbfs's lock is the same as signer's lock
    if (address.script.hash() === lock.hash()) {
        witnesses.push("0x");
    }
    // add ckbfs witnesses
    witnesses.push(...ckbfsWitnesses.map((w) => `0x${Buffer.from(w).toString("hex")}`));
    // Add empty witnesses for signer's input
    // This is to ensure that the transaction is valid and can be signed
    for (let i = inputsBefore; i < tx.inputs.length; i++) {
        witnesses.push("0x");
    }
    tx.witnesses = witnesses;
    // Complete fee
    await tx.completeFeeChangeToLock(signer, address.script, feeRate || 2000);
    return tx;
}
/**
 * Creates a complete transaction for publishing a file to CKBFS
 * @param signer The signer to use for the transaction
 * @param options Options for publishing the file
 * @returns Promise resolving to the signed transaction
 */
async function publishCKBFS(signer, options) {
    const tx = await createPublishTransaction(signer, options);
    return signer.signTransaction(tx);
}
/**
 * Creates a complete transaction for appending content to a CKBFS file
 * @param signer The signer to use for the transaction
 * @param options Options for appending content
 * @returns Promise resolving to the signed transaction
 */
async function appendCKBFS(signer, options) {
    const tx = await createAppendTransaction(signer, options);
    return signer.signTransaction(tx);
}
