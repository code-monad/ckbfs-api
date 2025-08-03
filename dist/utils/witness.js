"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCKBFSWitness = createCKBFSWitness;
exports.createTextCKBFSWitness = createTextCKBFSWitness;
exports.extractCKBFSWitnessContent = extractCKBFSWitnessContent;
exports.isCKBFSWitness = isCKBFSWitness;
exports.createChunkedCKBFSWitnesses = createChunkedCKBFSWitnesses;
const molecule_1 = require("./molecule");
/**
 * Utility functions for creating and handling CKBFS witnesses
 */
/**
 * Creates a CKBFS witness with content
 * @param content The content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
function createCKBFSWitness(content) {
    // Create witness with CKBFS header, version byte, and content
    // Version byte must always be 0x00 per protocol
    const versionByte = new Uint8Array([0]);
    return Buffer.concat([molecule_1.CKBFS_HEADER, versionByte, content]);
}
/**
 * Creates a CKBFS witness with text content
 * @param text The text content to include in the witness
 * @param version Optional version byte (default is 0)
 * @returns Uint8Array containing the witness data
 */
function createTextCKBFSWitness(text) {
    const textEncoder = new TextEncoder();
    const contentBytes = textEncoder.encode(text);
    return createCKBFSWitness(contentBytes);
}
/**
 * Extracts content from a CKBFS witness
 * @param witness The CKBFS witness data
 * @returns Object containing the extracted version and content bytes
 */
function extractCKBFSWitnessContent(witness) {
    // Ensure the witness has the CKBFS header
    const header = witness.slice(0, 5);
    const headerString = new TextDecoder().decode(header);
    if (headerString !== 'CKBFS') {
        throw new Error('Invalid CKBFS witness: missing CKBFS header');
    }
    // Extract version byte and content
    const version = witness[5];
    const content = witness.slice(6);
    return { version, content };
}
/**
 * Checks if a witness is a valid CKBFS witness
 * @param witness The witness data to check
 * @returns Boolean indicating whether the witness is a valid CKBFS witness
 */
function isCKBFSWitness(witness) {
    if (witness.length < 6) {
        return false;
    }
    const header = witness.slice(0, 5);
    const headerString = new TextDecoder().decode(header);
    return headerString === 'CKBFS';
}
/**
 * Creates an array of witnesses for a CKBFS transaction from content chunks
 * @param contentChunks Array of content chunks
 * @param version Optional version byte (default is 0)
 * @returns Array of Uint8Array witnesses
 */
function createChunkedCKBFSWitnesses(contentChunks) {
    return contentChunks.map(chunk => createCKBFSWitness(chunk));
}
