import {
  Script,
  Signer,
  Transaction,
  ClientPublicTestnet,
  SignerCkbPrivateKey,
  ClientPublicMainnet,
} from "@ckb-ccc/core";
import {
  calculateChecksum,
  verifyChecksum,
  updateChecksum,
  verifyWitnessChecksum,
  verifyV3WitnessChecksum,
  verifyV3WitnessChain,
} from "./utils/checksum";
import {
  createCKBFSCell,
  createPublishTransaction as utilCreatePublishTransaction,
  preparePublishTransaction,
  createAppendTransaction as utilCreateAppendTransaction,
  prepareAppendTransaction,
  createAppendTransactionDry,
  publishCKBFS as utilPublishCKBFS,
  appendCKBFS as utilAppendCKBFS,
  CKBFSCellOptions,
  PublishOptions,
  AppendOptions,
  // V3 functions
  PublishV3Options,
  AppendV3Options,
  TransferV3Options,
  publishCKBFSV3,
  appendCKBFSV3,
  transferCKBFSV3,
  createPublishV3Transaction,
  prepareAppendV3Transaction,
  preparePublishV3Transaction,
  createAppendV3Transaction,
  createAppendV3TransactionDry,
  createTransferV3Transaction,
} from "./utils/transaction";
import {
  readFile,
  readFileAsText,
  readFileAsUint8Array,
  writeFile,
  getContentType,
  splitFileIntoChunks,
  combineChunksToFile,
  getFileContentFromChain,
  saveFileFromChain,
  getFileContentFromChainByTypeId,
  saveFileFromChainByTypeId,
  decodeFileFromChainByTypeId,
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
  parseIdentifier,
  IdentifierType,
  decodeWitnessContent,
  decodeMultipleWitnessContents,
  extractFileFromWitnesses,
  decodeFileFromWitnessData,
  saveFileFromWitnessData,
  // V3 file retrieval functions
  getFileContentFromChainV3,
  getFileContentFromChainByIdentifierV3,
  saveFileFromChainByIdentifierV3,
  resolveCKBFSCell
} from "./utils/file";
import {
  createCKBFSWitness,
  createTextCKBFSWitness,
  extractCKBFSWitnessContent,
  isCKBFSWitness,
  createChunkedCKBFSWitnesses,
  createCKBFSV3Witness,
  createChunkedCKBFSV3Witnesses,
  extractCKBFSV3WitnessContent,
  isCKBFSV3Witness,
  CKBFSV3WitnessOptions,
} from "./utils/witness";
import {
  CKBFSData,
  BackLinkV1,
  BackLinkV2,
  CKBFSDataType,
  BackLinkType,
  CKBFS_HEADER,
  CKBFS_HEADER_STRING,
} from "./utils/molecule";
import {
  NetworkType,
  ProtocolVersion,
  ProtocolVersionType,
  DEFAULT_NETWORK,
  DEFAULT_VERSION,
  CKBFS_CODE_HASH,
  CKBFS_TYPE_ID,
  ADLER32_CODE_HASH,
  ADLER32_TYPE_ID,
  DEP_GROUP_TX_HASH,
  DEPLOY_TX_HASH,
  getCKBFSScriptConfig,
  CKBFSScriptConfig,
} from "./utils/constants";
import { ensureHexPrefix } from "./utils/transaction";

// Helper to encode string to Uint8Array
const textEncoder = new TextEncoder();

/**
 * Custom options for file publishing and appending
 */
export interface FileOptions {
  contentType?: string;
  filename?: string;
  capacity?: bigint;
  feeRate?: number;
  network?: NetworkType;
  version?: ProtocolVersionType;
  useTypeID?: boolean;
}

/**
 * Options required when publishing content directly (string or Uint8Array)
 */
export type PublishContentOptions = Omit<
  FileOptions,
  "capacity" | "contentType" | "filename"
> &
  Required<Pick<FileOptions, "contentType" | "filename">> & {
    capacity?: bigint;
  };

/**
 * Options required when appending content directly (string or Uint8Array)
 */
export type AppendContentOptions = Omit<
  FileOptions,
  "contentType" | "filename" | "capacity"
> & { 
  capacity?: bigint;
  witnessStartIndex?: number;
};

/**
 * Configuration options for the CKBFS SDK
 */
export interface CKBFSOptions {
  chunkSize?: number;
  version?: ProtocolVersionType;
  useTypeID?: boolean;
  network?: NetworkType;
  rpcUrl?: string;
}

/**
 * Main CKBFS SDK class
 */
export class CKBFS {
  private signer: Signer;
  private chunkSize: number;
  private network: NetworkType;
  private version: ProtocolVersionType;
  private useTypeID: boolean;
  private rpcUrl: string;

  /**
   * Creates a new CKBFS SDK instance
   * @param signerOrPrivateKey The signer instance or CKB private key to use for signing transactions
   * @param networkOrOptions The network type or configuration options
   * @param options Additional configuration options when using privateKey
   */
  constructor(
    signerOrPrivateKey: Signer | string,
    networkOrOptions: NetworkType | CKBFSOptions = DEFAULT_NETWORK,
    options?: CKBFSOptions,
  ) {
    // Determine if first parameter is a Signer or privateKey
    if (typeof signerOrPrivateKey === "string") {
      // Initialize with private key
      const privateKey = signerOrPrivateKey;
      const network =
        typeof networkOrOptions === "string"
          ? networkOrOptions
          : DEFAULT_NETWORK;
      const opts =
        options ||
        (typeof networkOrOptions === "object" ? networkOrOptions : {});

      const client =
        network === "mainnet"
          ? new ClientPublicMainnet({
            url: opts.rpcUrl,
          })
          : new ClientPublicTestnet({
            url: opts.rpcUrl,
          });
      this.signer = new SignerCkbPrivateKey(client, privateKey);
      this.network = network;
      this.chunkSize = opts.chunkSize || 30 * 1024;
      this.version = opts.version || DEFAULT_VERSION;
      this.useTypeID = opts.useTypeID || false;
      this.rpcUrl = opts.rpcUrl || client.url;
    } else {
      // Initialize with signer
      this.signer = signerOrPrivateKey;
      const opts = typeof networkOrOptions === "object" ? networkOrOptions : {};

      this.network = opts.network || DEFAULT_NETWORK;
      this.chunkSize = opts.chunkSize || 30 * 1024;
      this.version = opts.version || DEFAULT_VERSION;
      this.useTypeID = opts.useTypeID || false;
      this.rpcUrl = opts.rpcUrl || this.signer.client.url;
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
  async getLock(): Promise<Script> {
    const address = await this.getAddress();
    return address.script;
  }

  /**
   * Gets the CKBFS script configuration for the current settings
   * @returns The CKBFS script configuration
   */
  getCKBFSConfig(): CKBFSScriptConfig {
    return getCKBFSScriptConfig(this.network, this.version, this.useTypeID);
  }

  /**
   * Publishes a file to CKBFS
   * @param filePath The path to the file to publish
   * @param options Options for publishing the file
   * @returns Promise resolving to the transaction hash
   */
  async publishFile(
    filePath: string,
    options: FileOptions = {},
  ): Promise<string> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Get the lock script
    const lock = await this.getLock();

    // Determine content type if not provided
    const contentType = options.contentType || getContentType(filePath);

    // Use the filename from the path if not provided
    const pathParts = filePath.split(/[\\\/]/);
    const filename = options.filename || pathParts[pathParts.length - 1];

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 by default, fallback to legacy for older versions
    if (version === ProtocolVersion.V3) {
      const tx = await publishCKBFSV3(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        version: ProtocolVersion.V3,
      });

      console.log("Publish file tx:", tx.stringify());

      // Send the transaction
      const txHash = await this.signer.sendTransaction(tx);

      return ensureHexPrefix(txHash);
    } else {
      // Legacy V1/V2 behavior
      const tx = await utilPublishCKBFS(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      });

      console.log("Publish file tx:", tx.stringify());

      // Send the transaction
      const txHash = await this.signer.sendTransaction(tx);

      return ensureHexPrefix(txHash);
    }
  }

  /**
   * Publishes content (string or Uint8Array) directly to CKBFS
   * @param content The content string or byte array to publish
   * @param options Options for publishing the content (contentType and filename are required)
   * @returns Promise resolving to the transaction hash
   */
  async publishContent(
    content: string | Uint8Array,
    options: PublishContentOptions,
  ): Promise<string> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const lock = await this.getLock();

    // Use provided contentType and filename (required)
    const { contentType, filename } = options;

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 by default, fallback to legacy for older versions
    if (version === ProtocolVersion.V3) {
      const tx = await publishCKBFSV3(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        version: ProtocolVersion.V3,
      });

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    } else {
      // Legacy V1/V2 behavior
      const tx = await utilPublishCKBFS(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      });

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    }
  }

  /**
   * Appends content from a file to an existing CKBFS file
   * @param filePath The path to the file containing the content to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param options Additional options for the append operation
   * @returns Promise resolving to the transaction hash
   */
  async appendFile(
    filePath: string,
    ckbfsCell: AppendOptions["ckbfsCell"],
    options: Omit<FileOptions, "contentType" | "filename"> & {
      // V3 backlink parameters (optional for backward compatibility)
      previousTxHash?: string;
      previousWitnessIndex?: number;
      previousChecksum?: number;
      witnessStartIndex?: number;
    } = {},
  ): Promise<string> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 when backlink parameters are provided or version is V3
    if (version === ProtocolVersion.V3 && 
        options.previousTxHash && 
        options.previousWitnessIndex !== undefined && 
        options.previousChecksum !== undefined) {
      
      const tx = await appendCKBFSV3(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: ProtocolVersion.V3,
        previousTxHash: options.previousTxHash,
        previousWitnessIndex: options.previousWitnessIndex,
        previousChecksum: options.previousChecksum,
      });

      console.log("Append file v3 tx:", tx.stringify());

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    } else {
      // Legacy V1/V2 behavior or when V3 backlink params are missing
      const tx = await utilAppendCKBFS(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: version === ProtocolVersion.V3 ? ProtocolVersion.V2 : version, // Fallback to V2 if V3 but missing backlink params
      });

      console.log("Append file tx:", tx.stringify());

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    }
  }

  /**
   * Appends content (string or Uint8Array) directly to an existing CKBFS file
   * @param content The content string or byte array to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param options Additional options for the append operation
   * @returns Promise resolving to the transaction hash
   */
  async appendContent(
    content: string | Uint8Array,
    ckbfsCell: AppendOptions["ckbfsCell"],
    options: AppendContentOptions = {},
  ): Promise<string> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 when backlink parameters are provided or version is V3
    if (version === ProtocolVersion.V3 && 
        ckbfsCell.outPoint.txHash && 
        ckbfsCell.data.index !== undefined && 
        ckbfsCell.data.checksum !== undefined) {
      
      const tx = await appendCKBFSV3(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: ProtocolVersion.V3,
        previousTxHash: ckbfsCell.outPoint.txHash,
        previousWitnessIndex: ckbfsCell.data.index,
        previousChecksum: ckbfsCell.data.checksum,
      });

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    } else {
      // Legacy V1/V2 behavior or when V3 backlink params are missing
      const tx = await utilAppendCKBFS(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: version === ProtocolVersion.V3 ? ProtocolVersion.V2 : version, // Fallback to V2 if V3 but missing backlink params
        // No useTypeID option for append
      });

      const txHash = await this.signer.sendTransaction(tx);
      return ensureHexPrefix(txHash);
    }
  }

  /**
   * Creates a new transaction for publishing a file but doesn't sign or send it
   * @param filePath The path to the file to publish
   * @param options Options for publishing the file
   * @returns Promise resolving to the unsigned transaction
   */
  async createPublishTransaction(
    filePath: string,
    options: FileOptions = {},
  ): Promise<Transaction> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Get the lock script
    const lock = await this.getLock();

    // Determine content type if not provided
    const contentType = options.contentType || getContentType(filePath);

    // Use the filename from the path if not provided
    const pathParts = filePath.split(/[\\\/]/);
    const filename = options.filename || pathParts[pathParts.length - 1];

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 by default, fallback to legacy for older versions
    if (version === ProtocolVersion.V3) {
      return createPublishV3Transaction(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        version: ProtocolVersion.V3,
      });
    } else {
      // Legacy V1/V2 behavior
      return utilCreatePublishTransaction(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      });
    }
  }

  /**
   * Creates a new transaction for publishing content (string or Uint8Array) directly, but doesn't sign or send it
   * @param content The content string or byte array to publish
   * @param options Options for publishing the content (contentType and filename are required)
   * @returns Promise resolving to the unsigned transaction
   */
  async createPublishContentTransaction(
    content: string | Uint8Array,
    options: PublishContentOptions,
  ): Promise<Transaction> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const lock = await this.getLock();

    // Use provided contentType and filename (required)
    const { contentType, filename } = options;

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 by default, fallback to legacy for older versions
    if (version === ProtocolVersion.V3) {
      return createPublishV3Transaction(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
        version: ProtocolVersion.V3,
      });
    } else {
      // Legacy V1/V2 behavior
      return utilCreatePublishTransaction(this.signer, {
        contentChunks,
        contentType,
        filename,
        lock,
        capacity: options.capacity,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version,
        useTypeID:
          options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      });
    }
  }

  /**
   * Creates a new transaction for appending content from a file but doesn't sign or send it
   * @param filePath The path to the file containing the content to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param options Additional options for the append operation
   * @returns Promise resolving to the unsigned transaction
   */
  async createAppendTransaction(
    filePath: string,
    ckbfsCell: AppendOptions["ckbfsCell"],
    options: Omit<FileOptions, "contentType" | "filename"> & {
      // V3 backlink parameters (optional for backward compatibility)
      previousTxHash?: string;
      previousWitnessIndex?: number;
      previousChecksum?: number;
      witnessStartIndex?: number;
    } = {},
  ): Promise<Transaction> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 when backlink parameters are provided or version is V3
    if (version === ProtocolVersion.V3 && 
        options.previousTxHash && 
        options.previousWitnessIndex !== undefined && 
        options.previousChecksum !== undefined) {
      
      return createAppendV3Transaction(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: ProtocolVersion.V3,
        previousTxHash: options.previousTxHash,
        previousWitnessIndex: options.previousWitnessIndex,
        previousChecksum: options.previousChecksum,
        witnessStartIndex: options.witnessStartIndex,
      });
    } else {
      // Legacy V1/V2 behavior or when V3 backlink params are missing
      return utilCreateAppendTransaction(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: version === ProtocolVersion.V3 ? ProtocolVersion.V2 : version, // Fallback to V2 if V3 but missing backlink params
      });
    }
  }

  /**
   * Creates a new transaction for appending content (string or Uint8Array) directly, but doesn't sign or send it
   * @param content The content string or byte array to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param options Additional options for the append operation
   * @returns Promise resolving to the unsigned transaction
   */
  async createAppendContentTransaction(
    content: string | Uint8Array,
    ckbfsCell: AppendOptions["ckbfsCell"],
    options: AppendContentOptions = {},
  ): Promise<Transaction> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    // Determine version - default to V3, allow override
    const version = options.version || this.version;

    // Use V3 when backlink parameters are provided or version is V3
    if (version === ProtocolVersion.V3 && 
        ckbfsCell.outPoint.txHash && 
        ckbfsCell.data.index !== undefined && 
        ckbfsCell.data.checksum !== undefined) {
      
      return createAppendV3Transaction(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: ProtocolVersion.V3,
        previousTxHash: ckbfsCell.outPoint.txHash,
        previousWitnessIndex: ckbfsCell.data.index,
        previousChecksum: ckbfsCell.data.checksum,
      });
    } else {
      // Legacy V1/V2 behavior or when V3 backlink params are missing
      return utilCreateAppendTransaction(this.signer, {
        ckbfsCell,
        contentChunks,
        feeRate: options.feeRate,
        network: options.network || this.network,
        version: version === ProtocolVersion.V3 ? ProtocolVersion.V2 : version, // Fallback to V2 if V3 but missing backlink params
        // No useTypeID option for append
      });
    }
  }

  // V3 Methods

  /**
   * Publishes a file to CKBFS v3
   * @param filePath The path to the file to publish
   * @param options Options for publishing the file
   * @returns Promise resolving to the transaction hash
   */
  async publishFileV3(
    filePath: string,
    options: Omit<FileOptions, 'version'> = {},
  ): Promise<string> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Get the lock script
    const lock = await this.getLock();

    // Determine content type if not provided
    const contentType = options.contentType || getContentType(filePath);

    // Use the filename from the path if not provided
    const pathParts = filePath.split(/[\\\/]/);
    const filename = options.filename || pathParts[pathParts.length - 1];

    // Create and sign the transaction using the v3 utility function
    const tx = await publishCKBFSV3(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      version: ProtocolVersion.V3,
    });

    console.log("Publish file v3 tx:", tx.stringify());

    // Send the transaction
    const txHash = await this.signer.sendTransaction(tx);

    return ensureHexPrefix(txHash);
  }

  /**
   * Publishes content (string or Uint8Array) directly to CKBFS v3
   * @param content The content string or byte array to publish
   * @param options Options for publishing the content (contentType and filename are required)
   * @returns Promise resolving to the transaction hash
   */
  async publishContentV3(
    content: string | Uint8Array,
    options: PublishContentOptions,
  ): Promise<string> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const lock = await this.getLock();

    // Use provided contentType and filename (required)
    const { contentType, filename } = options;

    const tx = await publishCKBFSV3(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      version: ProtocolVersion.V3,
    });

    const txHash = await this.signer.sendTransaction(tx);
    return ensureHexPrefix(txHash);
  }

  /**
   * Appends content from a file to an existing CKBFS v3 file
   * @param filePath The path to the file containing the content to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param previousTxHash The previous transaction hash for backlink
   * @param previousWitnessIndex The previous witness index for backlink
   * @param previousChecksum The previous checksum for backlink
   * @param options Additional options for the append operation
   * @returns Promise resolving to the transaction hash
   */
  async appendFileV3(
    filePath: string,
    ckbfsCell: AppendV3Options["ckbfsCell"],
    previousTxHash: string,
    previousWitnessIndex: number,
    previousChecksum: number,
    options: Omit<FileOptions, "contentType" | "filename" | "version"> = {},
  ): Promise<string> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Create and sign the transaction using the v3 utility function
    const tx = await appendCKBFSV3(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: ProtocolVersion.V3,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum,
    });

    console.log("Append file v3 tx:", tx.stringify());

    // Send the transaction
    const txHash = await this.signer.sendTransaction(tx);

    return ensureHexPrefix(txHash);
  }

  /**
   * Appends content (string or Uint8Array) directly to an existing CKBFS v3 file
   * @param content The content string or byte array to append
   * @param ckbfsCell The CKBFS cell to append to
   * @param previousTxHash The previous transaction hash for backlink
   * @param previousWitnessIndex The previous witness index for backlink
   * @param previousChecksum The previous checksum for backlink
   * @param options Additional options for the append operation
   * @returns Promise resolving to the transaction hash
   */
  async appendContentV3(
    content: string | Uint8Array,
    ckbfsCell: AppendV3Options["ckbfsCell"],
    previousTxHash: string,
    previousWitnessIndex: number,
    previousChecksum: number,
    options: AppendContentOptions = {},
  ): Promise<string> {
    const contentBytes =
      typeof content === "string" ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const tx = await appendCKBFSV3(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: ProtocolVersion.V3,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum,
    });

    const txHash = await this.signer.sendTransaction(tx);
    return ensureHexPrefix(txHash);
  }

  /**
   * Transfers ownership of a CKBFS v3 file to a new lock script
   * @param ckbfsCell The CKBFS cell to transfer
   * @param newLock The new lock script for the transferred file
   * @param previousTxHash The previous transaction hash for backlink
   * @param previousWitnessIndex The previous witness index for backlink
   * @param previousChecksum The previous checksum for backlink
   * @param options Additional options for the transfer operation
   * @returns Promise resolving to the transaction hash
   */
  async transferFileV3(
    ckbfsCell: TransferV3Options["ckbfsCell"],
    newLock: Script,
    previousTxHash: string,
    previousWitnessIndex: number,
    previousChecksum: number,
    options: Omit<FileOptions, "contentType" | "filename" | "version"> = {},
  ): Promise<string> {
    const tx = await transferCKBFSV3(this.signer, {
      ckbfsCell,
      newLock,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: ProtocolVersion.V3,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum,
    });

    console.log("Transfer file v3 tx:", tx.stringify());

    const txHash = await this.signer.sendTransaction(tx);
    return ensureHexPrefix(txHash);
  }

  /**
   * Creates a new transaction for publishing a file to CKBFS v3 but doesn't sign or send it
   * @param filePath The path to the file to publish
   * @param options Options for publishing the file
   * @returns Promise resolving to the unsigned transaction
   */
  async createPublishV3Transaction(
    filePath: string,
    options: Omit<FileOptions, 'version'> = {},
  ): Promise<Transaction> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];

    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }

    // Get the lock script
    const lock = await this.getLock();

    // Determine content type if not provided
    const contentType = options.contentType || getContentType(filePath);

    // Use the filename from the path if not provided
    const pathParts = filePath.split(/[\\\/]/);
    const filename = options.filename || pathParts[pathParts.length - 1];

    // Create the transaction using the utility function
    return createPublishV3Transaction(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID,
      version: ProtocolVersion.V3,
    });
  }
}

// Export utility functions
export {
  // Checksum utilities
  calculateChecksum,
  verifyChecksum,
  updateChecksum,
  verifyWitnessChecksum,
  verifyV3WitnessChecksum,
  verifyV3WitnessChain,

  // Transaction utilities (Exporting original names from transaction.ts)
  createCKBFSCell,
  utilCreatePublishTransaction as createPublishTransaction,
  preparePublishTransaction,
  utilCreateAppendTransaction as createAppendTransaction,
  prepareAppendTransaction,
  utilPublishCKBFS as publishCKBFS,
  utilAppendCKBFS as appendCKBFS,
  createAppendTransactionDry,
  createAppendV3Transaction,
  // File utilities
  readFile,
  readFileAsText,
  readFileAsUint8Array,
  writeFile,
  getContentType,
  splitFileIntoChunks,
  combineChunksToFile,
  getFileContentFromChain,
  saveFileFromChain,
  getFileContentFromChainByTypeId,
  saveFileFromChainByTypeId,
  decodeFileFromChainByTypeId,
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
  parseIdentifier,
  IdentifierType,
  decodeWitnessContent,
  decodeMultipleWitnessContents,
  extractFileFromWitnesses,
  decodeFileFromWitnessData,
  saveFileFromWitnessData,
  
  // V3 File utilities
  getFileContentFromChainV3,
  getFileContentFromChainByIdentifierV3,
  saveFileFromChainByIdentifierV3,

  // Witness utilities
  createCKBFSWitness,
  createTextCKBFSWitness,
  extractCKBFSWitnessContent,
  isCKBFSWitness,
  createChunkedCKBFSWitnesses,
  
  // V3 Witness utilities
  createCKBFSV3Witness,
  createChunkedCKBFSV3Witnesses,
  extractCKBFSV3WitnessContent,
  isCKBFSV3Witness,
  resolveCKBFSCell,
  CKBFSV3WitnessOptions,

  // Molecule definitions
  CKBFSData,
  BackLinkV1,
  BackLinkV2,

  // Types
  CKBFSDataType,
  BackLinkType,
  CKBFSCellOptions,
  PublishOptions,
  AppendOptions,

  // Constants
  CKBFS_HEADER,
  CKBFS_HEADER_STRING,

  // CKBFS Protocol Constants & Configuration
  NetworkType,
  ProtocolVersion,
  ProtocolVersionType,
  DEFAULT_NETWORK,
  DEFAULT_VERSION,
  CKBFS_CODE_HASH,
  CKBFS_TYPE_ID,
  ADLER32_CODE_HASH,
  ADLER32_TYPE_ID,
  DEP_GROUP_TX_HASH,
  DEPLOY_TX_HASH,
  getCKBFSScriptConfig,
  CKBFSScriptConfig,
};
