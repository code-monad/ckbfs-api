"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFile = readFile;
exports.readFileAsText = readFileAsText;
exports.readFileAsUint8Array = readFileAsUint8Array;
exports.writeFile = writeFile;
exports.getContentType = getContentType;
exports.splitFileIntoChunks = splitFileIntoChunks;
exports.combineChunksToFile = combineChunksToFile;
exports.getFileContentFromChain = getFileContentFromChain;
exports.saveFileFromChain = saveFileFromChain;
exports.decodeWitnessContent = decodeWitnessContent;
exports.decodeMultipleWitnessContents = decodeMultipleWitnessContents;
exports.extractFileFromWitnesses = extractFileFromWitnesses;
exports.decodeFileFromWitnessData = decodeFileFromWitnessData;
exports.saveFileFromWitnessData = saveFileFromWitnessData;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Utility functions for file operations
 */
/**
 * Reads a file from the file system
 * @param filePath The path to the file to read
 * @returns Buffer containing the file contents
 */
function readFile(filePath) {
    return fs_1.default.readFileSync(filePath);
}
/**
 * Reads a file as text from the file system
 * @param filePath The path to the file to read
 * @returns String containing the file contents
 */
function readFileAsText(filePath) {
    return fs_1.default.readFileSync(filePath, "utf-8");
}
/**
 * Reads a file as Uint8Array from the file system
 * @param filePath The path to the file to read
 * @returns Uint8Array containing the file contents
 */
function readFileAsUint8Array(filePath) {
    const buffer = fs_1.default.readFileSync(filePath);
    return new Uint8Array(buffer);
}
/**
 * Writes data to a file in the file system
 * @param filePath The path to write the file to
 * @param data The data to write to the file
 */
function writeFile(filePath, data) {
    // Ensure the directory exists
    const dirPath = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    fs_1.default.writeFileSync(filePath, data);
}
/**
 * Gets the MIME content type based on file extension
 * @param filePath The path to the file
 * @returns The MIME content type for the file
 */
function getContentType(filePath) {
    const extension = path_1.default.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".txt": "text/plain",
        ".html": "text/html",
        ".htm": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
        ".wav": "audio/wav",
        ".xml": "application/xml",
        ".zip": "application/zip",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
    };
    return mimeTypes[extension] || "application/octet-stream";
}
/**
 * Splits a file into chunks of a specific size
 * @param filePath The path to the file to split
 * @param chunkSize The maximum size of each chunk in bytes
 * @returns Array of Uint8Array chunks
 */
function splitFileIntoChunks(filePath, chunkSize) {
    const fileBuffer = fs_1.default.readFileSync(filePath);
    const chunks = [];
    for (let i = 0; i < fileBuffer.length; i += chunkSize) {
        chunks.push(new Uint8Array(fileBuffer.slice(i, i + chunkSize)));
    }
    return chunks;
}
/**
 * Combines chunks into a single file
 * @param chunks Array of chunks to combine
 * @param outputPath The path to write the combined file to
 */
function combineChunksToFile(chunks, outputPath) {
    const combinedBuffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    writeFile(outputPath, combinedBuffer);
}
/**
 * Utility function to safely decode buffer to string
 * @param buffer The buffer to decode
 * @returns Decoded string or placeholder on error
 */
function safelyDecode(buffer) {
    if (!buffer)
        return "[Unknown]";
    try {
        if (buffer instanceof Uint8Array) {
            return new TextDecoder().decode(buffer);
        }
        else if (typeof buffer === "string") {
            return buffer;
        }
        else {
            return `[Buffer: ${buffer.toString()}]`;
        }
    }
    catch (e) {
        return "[Decode Error]";
    }
}
/**
 * Retrieves complete file content from the blockchain by following backlinks
 * @param client The CKB client to use for blockchain queries
 * @param outPoint The output point of the latest CKBFS cell
 * @param ckbfsData The data from the latest CKBFS cell
 * @returns Promise resolving to the complete file content
 */
async function getFileContentFromChain(client, outPoint, ckbfsData) {
    console.log(`Retrieving file: ${safelyDecode(ckbfsData.filename)}`);
    console.log(`Content type: ${safelyDecode(ckbfsData.contentType)}`);
    // Prepare to collect all content pieces
    const contentPieces = [];
    let currentData = ckbfsData;
    let currentOutPoint = outPoint;
    // Process the current transaction first
    const tx = await client.getTransaction(currentOutPoint.txHash);
    if (!tx || !tx.transaction) {
        throw new Error(`Transaction ${currentOutPoint.txHash} not found`);
    }
    // Get content from witnesses
    const indexes = currentData.indexes ||
        (currentData.index !== undefined ? [currentData.index] : []);
    if (indexes.length > 0) {
        // Get content from each witness index
        for (const idx of indexes) {
            if (idx >= tx.transaction.witnesses.length) {
                console.warn(`Witness index ${idx} out of range`);
                continue;
            }
            const witnessHex = tx.transaction.witnesses[idx];
            const witness = Buffer.from(witnessHex.slice(2), "hex"); // Remove 0x prefix
            // Extract content (skip CKBFS header + version byte)
            if (witness.length >= 6 && witness.slice(0, 5).toString() === "CKBFS") {
                const content = witness.slice(6);
                contentPieces.unshift(content); // Add to beginning of array (we're going backwards)
            }
            else {
                console.warn(`Witness at index ${idx} is not a valid CKBFS witness`);
            }
        }
    }
    // Follow backlinks recursively
    if (currentData.backLinks && currentData.backLinks.length > 0) {
        // Process each backlink, from most recent to oldest
        for (let i = currentData.backLinks.length - 1; i >= 0; i--) {
            const backlink = currentData.backLinks[i];
            // Get the transaction for this backlink
            const backTx = await client.getTransaction(backlink.txHash);
            if (!backTx || !backTx.transaction) {
                console.warn(`Backlink transaction ${backlink.txHash} not found`);
                continue;
            }
            // Get content from backlink witnesses
            const backIndexes = backlink.indexes ||
                (backlink.index !== undefined ? [backlink.index] : []);
            if (backIndexes.length > 0) {
                // Get content from each witness index
                for (const idx of backIndexes) {
                    if (idx >= backTx.transaction.witnesses.length) {
                        console.warn(`Backlink witness index ${idx} out of range`);
                        continue;
                    }
                    const witnessHex = backTx.transaction.witnesses[idx];
                    const witness = Buffer.from(witnessHex.slice(2), "hex"); // Remove 0x prefix
                    // Extract content (skip CKBFS header + version byte)
                    if (witness.length >= 6 &&
                        witness.slice(0, 5).toString() === "CKBFS") {
                        const content = witness.slice(6);
                        contentPieces.unshift(content); // Add to beginning of array (we're going backwards)
                    }
                    else {
                        console.warn(`Backlink witness at index ${idx} is not a valid CKBFS witness`);
                    }
                }
            }
        }
    }
    // Combine all content pieces
    return Buffer.concat(contentPieces);
}
/**
 * Saves file content retrieved from blockchain to disk
 * @param content The file content to save
 * @param ckbfsData The CKBFS cell data containing file metadata
 * @param outputPath Optional path to save the file (defaults to filename in current directory)
 * @returns The path where the file was saved
 */
function saveFileFromChain(content, ckbfsData, outputPath) {
    // Get filename from CKBFS data
    const filename = safelyDecode(ckbfsData.filename);
    // Determine output path
    const filePath = outputPath || filename;
    // Ensure directory exists
    const directory = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(directory)) {
        fs_1.default.mkdirSync(directory, { recursive: true });
    }
    // Write file
    fs_1.default.writeFileSync(filePath, content);
    console.log(`File saved to: ${filePath}`);
    console.log(`Size: ${content.length} bytes`);
    return filePath;
}
/**
 * Decodes content from a single CKBFS witness
 * @param witnessHex The witness data in hex format (with or without 0x prefix)
 * @returns Object containing the decoded content and metadata, or null if not a valid CKBFS witness
 */
function decodeWitnessContent(witnessHex) {
    try {
        // Remove 0x prefix if present
        const hexData = witnessHex.startsWith("0x")
            ? witnessHex.slice(2)
            : witnessHex;
        const witness = Buffer.from(hexData, "hex");
        // Check if it's a valid CKBFS witness
        if (witness.length < 6) {
            return null;
        }
        // Check CKBFS header
        const header = witness.slice(0, 5).toString();
        if (header !== "CKBFS") {
            return null;
        }
        // Extract content (skip CKBFS header + version byte)
        const content = witness.slice(6);
        return {
            content,
            isValid: true,
        };
    }
    catch (error) {
        console.warn("Error decoding witness content:", error);
        return null;
    }
}
/**
 * Decodes and combines content from multiple CKBFS witnesses
 * @param witnessHexArray Array of witness data in hex format
 * @param preserveOrder Whether to preserve the order of witnesses (default: true)
 * @returns Combined content from all valid CKBFS witnesses
 */
function decodeMultipleWitnessContents(witnessHexArray, preserveOrder = true) {
    const contentPieces = [];
    for (let i = 0; i < witnessHexArray.length; i++) {
        const witnessHex = witnessHexArray[i];
        const decoded = decodeWitnessContent(witnessHex);
        if (decoded && decoded.isValid) {
            if (preserveOrder) {
                contentPieces.push(decoded.content);
            }
            else {
                contentPieces.unshift(decoded.content);
            }
        }
        else {
            console.warn(`Witness at index ${i} is not a valid CKBFS witness`);
        }
    }
    return Buffer.concat(contentPieces);
}
/**
 * Extracts complete file content from witnesses using specified indexes
 * @param witnesses Array of all witnesses from a transaction
 * @param indexes Array of witness indexes that contain CKBFS content
 * @returns Combined content from the specified witness indexes
 */
function extractFileFromWitnesses(witnesses, indexes) {
    const relevantWitnesses = [];
    for (const idx of indexes) {
        if (idx >= witnesses.length) {
            console.warn(`Witness index ${idx} out of range (total witnesses: ${witnesses.length})`);
            continue;
        }
        relevantWitnesses.push(witnesses[idx]);
    }
    return decodeMultipleWitnessContents(relevantWitnesses, true);
}
/**
 * Decodes file content directly from witness data without blockchain queries
 * @param witnessData Object containing witness information
 * @returns Object containing the decoded file content and metadata
 */
function decodeFileFromWitnessData(witnessData) {
    const { witnesses, indexes, filename, contentType } = witnessData;
    // Normalize indexes to array
    const indexArray = Array.isArray(indexes) ? indexes : [indexes];
    // Extract content from witnesses
    const content = extractFileFromWitnesses(witnesses, indexArray);
    return {
        content,
        filename,
        contentType,
        size: content.length,
    };
}
/**
 * Saves decoded file content directly from witness data
 * @param witnessData Object containing witness information
 * @param outputPath Optional path to save the file
 * @returns The path where the file was saved
 */
function saveFileFromWitnessData(witnessData, outputPath) {
    const decoded = decodeFileFromWitnessData(witnessData);
    // Determine output path
    const filename = decoded.filename || "decoded_file";
    const filePath = outputPath || filename;
    // Ensure directory exists
    const directory = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(directory)) {
        fs_1.default.mkdirSync(directory, { recursive: true });
    }
    // Write file
    fs_1.default.writeFileSync(filePath, decoded.content);
    console.log(`File saved to: ${filePath}`);
    console.log(`Size: ${decoded.size} bytes`);
    console.log(`Content type: ${decoded.contentType || "unknown"}`);
    return filePath;
}
