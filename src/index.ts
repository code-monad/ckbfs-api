import { Script, Signer, Transaction, ClientPublicTestnet, SignerCkbPrivateKey } from "@ckb-ccc/core";
import { 
  calculateChecksum, 
  verifyChecksum, 
  updateChecksum, 
  verifyWitnessChecksum 
} from './utils/checksum';
import {
  createCKBFSCell,
  createPublishTransaction as utilCreatePublishTransaction,
  createAppendTransaction as utilCreateAppendTransaction,
  publishCKBFS as utilPublishCKBFS,
  appendCKBFS as utilAppendCKBFS,
  CKBFSCellOptions,
  PublishOptions,
  AppendOptions
} from './utils/transaction';
import {
  readFile,
  readFileAsText,
  readFileAsUint8Array,
  writeFile,
  getContentType,
  splitFileIntoChunks,
  combineChunksToFile,
  getFileContentFromChain,
  saveFileFromChain
} from './utils/file';
import {
  createCKBFSWitness,
  createTextCKBFSWitness,
  extractCKBFSWitnessContent,
  isCKBFSWitness,
  createChunkedCKBFSWitnesses
} from './utils/witness';
import {
  CKBFSData,
  BackLinkV1,
  BackLinkV2,
  CKBFSDataType,
  BackLinkType,
  CKBFS_HEADER,
  CKBFS_HEADER_STRING
} from './utils/molecule';
import {
  NetworkType,
  ProtocolVersion,
  DEFAULT_NETWORK,
  DEFAULT_VERSION,
  CKBFS_CODE_HASH,
  CKBFS_TYPE_ID,
  ADLER32_CODE_HASH,
  ADLER32_TYPE_ID,
  DEP_GROUP_TX_HASH,
  DEPLOY_TX_HASH,
  getCKBFSScriptConfig,
  CKBFSScriptConfig
} from './utils/constants';
import { ensureHexPrefix } from './utils/transaction';

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
  version?: string;
  useTypeID?: boolean;
}

/**
 * Options required when publishing content directly (string or Uint8Array)
 */
export type PublishContentOptions = Omit<FileOptions, 'capacity' | 'contentType' | 'filename'> & 
  Required<Pick<FileOptions, 'contentType' | 'filename'>> & 
  { capacity?: bigint };

/**
 * Options required when appending content directly (string or Uint8Array)
 */
export type AppendContentOptions = Omit<FileOptions, 'contentType' | 'filename' | 'capacity'> & 
  { capacity?: bigint };

/**
 * Configuration options for the CKBFS SDK
 */
export interface CKBFSOptions {
  chunkSize?: number;
  version?: string;
  useTypeID?: boolean;
  network?: NetworkType;
}

/**
 * Main CKBFS SDK class
 */
export class CKBFS {
  private signer: Signer;
  private chunkSize: number;
  private network: NetworkType;
  private version: string;
  private useTypeID: boolean;
  
  /**
   * Creates a new CKBFS SDK instance
   * @param signerOrPrivateKey The signer instance or CKB private key to use for signing transactions
   * @param networkOrOptions The network type or configuration options
   * @param options Additional configuration options when using privateKey
   */
  constructor(
    signerOrPrivateKey: Signer | string,
    networkOrOptions: NetworkType | CKBFSOptions = DEFAULT_NETWORK,
    options?: CKBFSOptions
  ) {
    // Determine if first parameter is a Signer or privateKey
    if (typeof signerOrPrivateKey === 'string') {
      // Initialize with private key
      const privateKey = signerOrPrivateKey;
      const network = typeof networkOrOptions === 'string' ? networkOrOptions : DEFAULT_NETWORK;
      const opts = options || (typeof networkOrOptions === 'object' ? networkOrOptions : {});
      
      const client = new ClientPublicTestnet();
      this.signer = new SignerCkbPrivateKey(client, privateKey);
      this.network = network;
      this.chunkSize = opts.chunkSize || 30 * 1024;
      this.version = opts.version || DEFAULT_VERSION;
      this.useTypeID = opts.useTypeID || false;
    } else {
      // Initialize with signer
      this.signer = signerOrPrivateKey;
      const opts = typeof networkOrOptions === 'object' ? networkOrOptions : {};
      
      this.network = opts.network || DEFAULT_NETWORK;
      this.chunkSize = opts.chunkSize || 30 * 1024;
      this.version = opts.version || DEFAULT_VERSION;
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
  async publishFile(filePath: string, options: FileOptions = {}): Promise<string> {
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
    
    // Create and sign the transaction using the utility function
    const tx = await utilPublishCKBFS(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID
    });

    console.log('Publish file tx:', tx.stringify());
    
    // Send the transaction
    const txHash = await this.signer.sendTransaction(tx);
    
    return ensureHexPrefix(txHash);
  }

  /**
   * Publishes content (string or Uint8Array) directly to CKBFS
   * @param content The content string or byte array to publish
   * @param options Options for publishing the content (contentType and filename are required)
   * @returns Promise resolving to the transaction hash
   */
  async publishContent(content: string | Uint8Array, options: PublishContentOptions): Promise<string> {
    const contentBytes = typeof content === 'string' ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const lock = await this.getLock();

    // Use provided contentType and filename (required)
    const { contentType, filename } = options;

    const tx = await utilPublishCKBFS(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID
    });

    console.log('Publish content tx:', tx.stringify());

    const txHash = await this.signer.sendTransaction(tx);
    return ensureHexPrefix(txHash);
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
    ckbfsCell: AppendOptions['ckbfsCell'], 
    options: Omit<FileOptions, 'contentType' | 'filename'> = {}
  ): Promise<string> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];
    
    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }
    
    // Create and sign the transaction using the utility function
    const tx = await utilAppendCKBFS(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version
    });

    console.log('Append file tx:', tx.stringify());
    
    // Send the transaction
    const txHash = await this.signer.sendTransaction(tx);
    
    return ensureHexPrefix(txHash);
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
    ckbfsCell: AppendOptions['ckbfsCell'],
    options: AppendContentOptions = {}
  ): Promise<string> {
    const contentBytes = typeof content === 'string' ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const tx = await utilAppendCKBFS(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version
      // No useTypeID option for append
    });

    console.log('Append content tx:', tx.stringify());

    const txHash = await this.signer.sendTransaction(tx);
    return ensureHexPrefix(txHash);
  }
  
  /**
   * Creates a new transaction for publishing a file but doesn't sign or send it
   * @param filePath The path to the file to publish
   * @param options Options for publishing the file
   * @returns Promise resolving to the unsigned transaction
   */
  async createPublishTransaction(filePath: string, options: FileOptions = {}): Promise<Transaction> {
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
    return utilCreatePublishTransaction(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID
    });
  }

  /**
   * Creates a new transaction for publishing content (string or Uint8Array) directly, but doesn't sign or send it
   * @param content The content string or byte array to publish
   * @param options Options for publishing the content (contentType and filename are required)
   * @returns Promise resolving to the unsigned transaction
   */
  async createPublishContentTransaction(content: string | Uint8Array, options: PublishContentOptions): Promise<Transaction> {
    const contentBytes = typeof content === 'string' ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    const lock = await this.getLock();

    // Use provided contentType and filename (required)
    const { contentType, filename } = options;

    return utilCreatePublishTransaction(this.signer, {
      contentChunks,
      contentType,
      filename,
      lock,
      capacity: options.capacity,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version,
      useTypeID: options.useTypeID !== undefined ? options.useTypeID : this.useTypeID
    });
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
    ckbfsCell: AppendOptions['ckbfsCell'],
    options: Omit<FileOptions, 'contentType' | 'filename'> = {}
  ): Promise<Transaction> {
    // Read the file and split into chunks
    const fileContent = readFileAsUint8Array(filePath);
    const contentChunks = [];
    
    for (let i = 0; i < fileContent.length; i += this.chunkSize) {
      contentChunks.push(fileContent.slice(i, i + this.chunkSize));
    }
    
    // Create the transaction using the utility function
    return utilCreateAppendTransaction(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version
    });
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
    ckbfsCell: AppendOptions['ckbfsCell'],
    options: AppendContentOptions = {}
  ): Promise<Transaction> {
    const contentBytes = typeof content === 'string' ? textEncoder.encode(content) : content;
    const contentChunks = [];

    for (let i = 0; i < contentBytes.length; i += this.chunkSize) {
      contentChunks.push(contentBytes.slice(i, i + this.chunkSize));
    }

    return utilCreateAppendTransaction(this.signer, {
      ckbfsCell,
      contentChunks,
      feeRate: options.feeRate,
      network: options.network || this.network,
      version: options.version || this.version
      // No useTypeID option for append
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
  
  // Transaction utilities (Exporting original names from transaction.ts)
  createCKBFSCell,
  utilCreatePublishTransaction as createPublishTransaction,
  utilCreateAppendTransaction as createAppendTransaction,
  utilPublishCKBFS as publishCKBFS,
  utilAppendCKBFS as appendCKBFS,
  
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
  
  // Witness utilities
  createCKBFSWitness,
  createTextCKBFSWitness,
  extractCKBFSWitnessContent,
  isCKBFSWitness,
  createChunkedCKBFSWitnesses,
  
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
  DEFAULT_NETWORK,
  DEFAULT_VERSION,
  CKBFS_CODE_HASH,
  CKBFS_TYPE_ID,
  ADLER32_CODE_HASH,
  ADLER32_TYPE_ID,
  DEP_GROUP_TX_HASH,
  DEPLOY_TX_HASH,
  getCKBFSScriptConfig,
  CKBFSScriptConfig
}; 