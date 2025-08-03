"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCKBFSScriptConfig = exports.DEPLOY_TX_HASH = exports.DEP_GROUP_TX_HASH = exports.ADLER32_TYPE_ID = exports.ADLER32_CODE_HASH = exports.CKBFS_TYPE_ID = exports.CKBFS_CODE_HASH = exports.DEFAULT_VERSION = exports.DEFAULT_NETWORK = exports.ProtocolVersion = exports.NetworkType = exports.CKBFS_HEADER_STRING = exports.CKBFS_HEADER = exports.BackLinkV2 = exports.BackLinkV1 = exports.CKBFSData = exports.createChunkedCKBFSWitnesses = exports.isCKBFSWitness = exports.extractCKBFSWitnessContent = exports.createTextCKBFSWitness = exports.createCKBFSWitness = exports.saveFileFromChain = exports.getFileContentFromChain = exports.combineChunksToFile = exports.splitFileIntoChunks = exports.getContentType = exports.writeFile = exports.readFileAsUint8Array = exports.readFileAsText = exports.readFile = exports.appendCKBFS = exports.publishCKBFS = exports.createAppendTransaction = exports.createPublishTransaction = exports.createCKBFSCell = exports.verifyWitnessChecksum = exports.updateChecksum = exports.verifyChecksum = exports.calculateChecksum = exports.CKBFS = void 0;
const core_1 = require("@ckb-ccc/core");
const checksum_1 = require("./utils/checksum");
Object.defineProperty(exports, "calculateChecksum", { enumerable: true, get: function () { return checksum_1.calculateChecksum; } });
Object.defineProperty(exports, "verifyChecksum", { enumerable: true, get: function () { return checksum_1.verifyChecksum; } });
Object.defineProperty(exports, "updateChecksum", { enumerable: true, get: function () { return checksum_1.updateChecksum; } });
Object.defineProperty(exports, "verifyWitnessChecksum", { enumerable: true, get: function () { return checksum_1.verifyWitnessChecksum; } });
const transaction_1 = require("./utils/transaction");
Object.defineProperty(exports, "createCKBFSCell", { enumerable: true, get: function () { return transaction_1.createCKBFSCell; } });
Object.defineProperty(exports, "createPublishTransaction", { enumerable: true, get: function () { return transaction_1.createPublishTransaction; } });
Object.defineProperty(exports, "createAppendTransaction", { enumerable: true, get: function () { return transaction_1.createAppendTransaction; } });
Object.defineProperty(exports, "publishCKBFS", { enumerable: true, get: function () { return transaction_1.publishCKBFS; } });
Object.defineProperty(exports, "appendCKBFS", { enumerable: true, get: function () { return transaction_1.appendCKBFS; } });
const file_1 = require("./utils/file");
Object.defineProperty(exports, "readFile", { enumerable: true, get: function () { return file_1.readFile; } });
Object.defineProperty(exports, "readFileAsText", { enumerable: true, get: function () { return file_1.readFileAsText; } });
Object.defineProperty(exports, "readFileAsUint8Array", { enumerable: true, get: function () { return file_1.readFileAsUint8Array; } });
Object.defineProperty(exports, "writeFile", { enumerable: true, get: function () { return file_1.writeFile; } });
Object.defineProperty(exports, "getContentType", { enumerable: true, get: function () { return file_1.getContentType; } });
Object.defineProperty(exports, "splitFileIntoChunks", { enumerable: true, get: function () { return file_1.splitFileIntoChunks; } });
Object.defineProperty(exports, "combineChunksToFile", { enumerable: true, get: function () { return file_1.combineChunksToFile; } });
Object.defineProperty(exports, "getFileContentFromChain", { enumerable: true, get: function () { return file_1.getFileContentFromChain; } });
Object.defineProperty(exports, "saveFileFromChain", { enumerable: true, get: function () { return file_1.saveFileFromChain; } });
const witness_1 = require("./utils/witness");
Object.defineProperty(exports, "createCKBFSWitness", { enumerable: true, get: function () { return witness_1.createCKBFSWitness; } });
Object.defineProperty(exports, "createTextCKBFSWitness", { enumerable: true, get: function () { return witness_1.createTextCKBFSWitness; } });
Object.defineProperty(exports, "extractCKBFSWitnessContent", { enumerable: true, get: function () { return witness_1.extractCKBFSWitnessContent; } });
Object.defineProperty(exports, "isCKBFSWitness", { enumerable: true, get: function () { return witness_1.isCKBFSWitness; } });
Object.defineProperty(exports, "createChunkedCKBFSWitnesses", { enumerable: true, get: function () { return witness_1.createChunkedCKBFSWitnesses; } });
const molecule_1 = require("./utils/molecule");
Object.defineProperty(exports, "CKBFSData", { enumerable: true, get: function () { return molecule_1.CKBFSData; } });
Object.defineProperty(exports, "BackLinkV1", { enumerable: true, get: function () { return molecule_1.BackLinkV1; } });
Object.defineProperty(exports, "BackLinkV2", { enumerable: true, get: function () { return molecule_1.BackLinkV2; } });
Object.defineProperty(exports, "CKBFS_HEADER", { enumerable: true, get: function () { return molecule_1.CKBFS_HEADER; } });
Object.defineProperty(exports, "CKBFS_HEADER_STRING", { enumerable: true, get: function () { return molecule_1.CKBFS_HEADER_STRING; } });
const constants_1 = require("./utils/constants");
Object.defineProperty(exports, "NetworkType", { enumerable: true, get: function () { return constants_1.NetworkType; } });
Object.defineProperty(exports, "ProtocolVersion", { enumerable: true, get: function () { return constants_1.ProtocolVersion; } });
Object.defineProperty(exports, "DEFAULT_NETWORK", { enumerable: true, get: function () { return constants_1.DEFAULT_NETWORK; } });
Object.defineProperty(exports, "DEFAULT_VERSION", { enumerable: true, get: function () { return constants_1.DEFAULT_VERSION; } });
Object.defineProperty(exports, "CKBFS_CODE_HASH", { enumerable: true, get: function () { return constants_1.CKBFS_CODE_HASH; } });
Object.defineProperty(exports, "CKBFS_TYPE_ID", { enumerable: true, get: function () { return constants_1.CKBFS_TYPE_ID; } });
Object.defineProperty(exports, "ADLER32_CODE_HASH", { enumerable: true, get: function () { return constants_1.ADLER32_CODE_HASH; } });
Object.defineProperty(exports, "ADLER32_TYPE_ID", { enumerable: true, get: function () { return constants_1.ADLER32_TYPE_ID; } });
Object.defineProperty(exports, "DEP_GROUP_TX_HASH", { enumerable: true, get: function () { return constants_1.DEP_GROUP_TX_HASH; } });
Object.defineProperty(exports, "DEPLOY_TX_HASH", { enumerable: true, get: function () { return constants_1.DEPLOY_TX_HASH; } });
Object.defineProperty(exports, "getCKBFSScriptConfig", { enumerable: true, get: function () { return constants_1.getCKBFSScriptConfig; } });
const transaction_2 = require("./utils/transaction");
// Helper to encode string to Uint8Array
const textEncoder = new TextEncoder();
/**
 * Main CKBFS SDK class
 */
class CKBFS {
    /**
     * Creates a new CKBFS SDK instance
     * @param signerOrPrivateKey The signer instance or CKB private key to use for signing transactions
     * @param networkOrOptions The network type or configuration options
     * @param options Additional configuration options when using privateKey
     */
    constructor(signerOrPrivateKey, networkOrOptions = constants_1.DEFAULT_NETWORK, options) {
        // Determine if first parameter is a Signer or privateKey
        if (typeof signerOrPrivateKey === "string") {
            // Initialize with private key
            const privateKey = signerOrPrivateKey;
            const network = typeof networkOrOptions === "string"
                ? networkOrOptions
                : constants_1.DEFAULT_NETWORK;
            const opts = options ||
                (typeof networkOrOptions === "object" ? networkOrOptions : {});
            const client = new core_1.ClientPublicTestnet();
            this.signer = new core_1.SignerCkbPrivateKey(client, privateKey);
            this.network = network;
            this.chunkSize = opts.chunkSize || 30 * 1024;
            this.version = opts.version || constants_1.DEFAULT_VERSION;
            this.useTypeID = opts.useTypeID || false;
        }
        else {
            // Initialize with signer
            this.signer = signerOrPrivateKey;
            const opts = typeof networkOrOptions === "object" ? networkOrOptions : {};
            this.network = opts.network || constants_1.DEFAULT_NETWORK;
            this.chunkSize = opts.chunkSize || 30 * 1024;
            this.version = opts.version || constants_1.DEFAULT_VERSION;
            this.useTypeID = opts.useTypeID || false;
        }
    }
    /**
     * Gets the recommended address object for the signer
     * @returns Promise resolving to the address object
     */
    async getAddress() {
        return this.signer.getRecommendedAddressObj();
    }
    /**
     * Gets the lock script for the signer
     * @returns Promise resolving to the lock script
     */
    async getLock() {
        const address = await this.getAddress();
        return address.script;
    }
    /**
     * Gets the CKBFS script configuration for the current settings
     * @returns The CKBFS script configuration
     */
    getCKBFSConfig() {
        return (0, constants_1.getCKBFSScriptConfig)(this.network, this.version, this.useTypeID);
    }
    /**
     * Publishes a file to CKBFS
     * @param filePath The path to the file to publish
     * @param options Options for publishing the file
     * @returns Promise resolving to the transaction hash
     */
    async publishFile(filePath, options = {}) {
        // Read the file and split into chunks
        const fileContent = (0, file_1.readFileAsUint8Array)(filePath);
        const contentChunks = [];
        for (let i = 0; i < fileContent.length; i += this.chunkSize) {
            contentChunks.push(fileContent.slice(i, i + this.chunkSize));
        }
        // Get the lock script
        const lock = await this.getLock();
        // Determine content type if not provided
        const contentType = options.contentType || (0, file_1.getContentType)(filePath);
        // Use the filename from the path if not provided
        const pathParts = filePath.split(/[\\\/]/);
        const filename = options.filename || pathParts[pathParts.length - 1];
        // Create and sign the transaction using the utility function
        const tx = await (0, transaction_1.publishCKBFS)(this.signer, {
            contentChunks,
            contentType,
            filename,
            lock,
            capacity: options.capacity,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        });
        console.log("Publish file tx:", tx.stringify());
        // Send the transaction
        const txHash = await this.signer.sendTransaction(tx);
        return (0, transaction_2.ensureHexPrefix)(txHash);
    }
    /**
     * Publishes content (string or Uint8Array) directly to CKBFS
     * @param content The content string or byte array to publish
     * @param options Options for publishing the content (contentType and filename are required)
     * @returns Promise resolving to the transaction hash
     */
    async publishContent(content, options) {
        const contentBytes = typeof content === "string" ? textEncoder.encode(content) : content;
        const contentChunks = [];
        for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
            contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
        }
        const lock = await this.getLock();
        // Use provided contentType and filename (required)
        const { contentType, filename } = options;
        const tx = await (0, transaction_1.publishCKBFS)(this.signer, {
            contentChunks,
            contentType,
            filename,
            lock,
            capacity: options.capacity,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        });
        console.log("Publish content tx:", tx.stringify());
        const txHash = await this.signer.sendTransaction(tx);
        return (0, transaction_2.ensureHexPrefix)(txHash);
    }
    /**
     * Appends content from a file to an existing CKBFS file
     * @param filePath The path to the file containing the content to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the transaction hash
     */
    async appendFile(filePath, ckbfsCell, options = {}) {
        // Read the file and split into chunks
        const fileContent = (0, file_1.readFileAsUint8Array)(filePath);
        const contentChunks = [];
        for (let i = 0; i < fileContent.length; i += this.chunkSize) {
            contentChunks.push(fileContent.slice(i, i + this.chunkSize));
        }
        // Create and sign the transaction using the utility function
        const tx = await (0, transaction_1.appendCKBFS)(this.signer, {
            ckbfsCell,
            contentChunks,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
        });
        console.log("Append file tx:", tx.stringify());
        // Send the transaction
        const txHash = await this.signer.sendTransaction(tx);
        return (0, transaction_2.ensureHexPrefix)(txHash);
    }
    /**
     * Appends content (string or Uint8Array) directly to an existing CKBFS file
     * @param content The content string or byte array to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the transaction hash
     */
    async appendContent(content, ckbfsCell, options = {}) {
        const contentBytes = typeof content === "string" ? textEncoder.encode(content) : content;
        const contentChunks = [];
        for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
            contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
        }
        const tx = await (0, transaction_1.appendCKBFS)(this.signer, {
            ckbfsCell,
            contentChunks,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            // No useTypeID option for append
        });
        console.log("Append content tx:", tx.stringify());
        const txHash = await this.signer.sendTransaction(tx);
        return (0, transaction_2.ensureHexPrefix)(txHash);
    }
    /**
     * Creates a new transaction for publishing a file but doesn't sign or send it
     * @param filePath The path to the file to publish
     * @param options Options for publishing the file
     * @returns Promise resolving to the unsigned transaction
     */
    async createPublishTransaction(filePath, options = {}) {
        // Read the file and split into chunks
        const fileContent = (0, file_1.readFileAsUint8Array)(filePath);
        const contentChunks = [];
        for (let i = 0; i < fileContent.length; i += this.chunkSize) {
            contentChunks.push(fileContent.slice(i, i + this.chunkSize));
        }
        // Get the lock script
        const lock = await this.getLock();
        // Determine content type if not provided
        const contentType = options.contentType || (0, file_1.getContentType)(filePath);
        // Use the filename from the path if not provided
        const pathParts = filePath.split(/[\\\/]/);
        const filename = options.filename || pathParts[pathParts.length - 1];
        // Create the transaction using the utility function
        return (0, transaction_1.createPublishTransaction)(this.signer, {
            contentChunks,
            contentType,
            filename,
            lock,
            capacity: options.capacity,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        });
    }
    /**
     * Creates a new transaction for publishing content (string or Uint8Array) directly, but doesn't sign or send it
     * @param content The content string or byte array to publish
     * @param options Options for publishing the content (contentType and filename are required)
     * @returns Promise resolving to the unsigned transaction
     */
    async createPublishContentTransaction(content, options) {
        const contentBytes = typeof content === "string" ? textEncoder.encode(content) : content;
        const contentChunks = [];
        for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
            contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
        }
        const lock = await this.getLock();
        // Use provided contentType and filename (required)
        const { contentType, filename } = options;
        return (0, transaction_1.createPublishTransaction)(this.signer, {
            contentChunks,
            contentType,
            filename,
            lock,
            capacity: options.capacity,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        });
    }
    /**
     * Creates a new transaction for appending content from a file but doesn't sign or send it
     * @param filePath The path to the file containing the content to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the unsigned transaction
     */
    async createAppendTransaction(filePath, ckbfsCell, options = {}) {
        // Read the file and split into chunks
        const fileContent = (0, file_1.readFileAsUint8Array)(filePath);
        const contentChunks = [];
        for (let i = 0; i < fileContent.length; i += this.chunkSize) {
            contentChunks.push(fileContent.slice(i, i + this.chunkSize));
        }
        // Create the transaction using the utility function
        return (0, transaction_1.createAppendTransaction)(this.signer, {
            ckbfsCell,
            contentChunks,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
        });
    }
    /**
     * Creates a new transaction for appending content (string or Uint8Array) directly, but doesn't sign or send it
     * @param content The content string or byte array to append
     * @param ckbfsCell The CKBFS cell to append to
     * @param options Additional options for the append operation
     * @returns Promise resolving to the unsigned transaction
     */
    async createAppendContentTransaction(content, ckbfsCell, options = {}) {
        const contentBytes = typeof content === "string" ? textEncoder.encode(content) : content;
        const contentChunks = [];
        for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
            contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
        }
        return (0, transaction_1.createAppendTransaction)(this.signer, {
            ckbfsCell,
            contentChunks,
            feeRate: options.feeRate,
            network: options.network || this.network,
            version: options.version || this.version,
            // No useTypeID option for append
        });
    }
}
exports.CKBFS = CKBFS;
