# CKBFS API

A TypeScript SDK for the CKBFS (CKB File System) protocol on the Nervos CKB blockchain. This library provides a high-level interface for publishing, appending, and retrieving files on the decentralized CKB network.

## Overview

CKBFS is a file system protocol built on top of the CKB blockchain that enables decentralized file storage with content integrity verification. Files are stored in transaction witnesses with Adler32 checksums for data integrity and support for file versioning through backlinks.

## Features

- **File Publishing**: Store files of any type on the CKB blockchain
- **File Appending**: Add content to existing files with automatic checksum updates
- **Content Integrity**: Adler32 checksum verification for all file operations
- **Protocol Versions**: Support for both V1 and V2 CKBFS protocol versions
- **Network Support**: Compatible with CKB mainnet and testnet
- **Chunked Storage**: Automatic file chunking for large files
- **TypeScript**: Full type safety with comprehensive type definitions

## Installation

```bash
npm install @ckbfs/api
```

## Quick Start

```typescript
import { CKBFS, NetworkType, ProtocolVersion } from '@ckbfs/api';

// Initialize with private key
const ckbfs = new CKBFS(
  'your-private-key-here',
  NetworkType.Testnet,
  {
    version: ProtocolVersion.V2,
    chunkSize: 30 * 1024, // 30KB chunks
    useTypeID: false
  }
);

// Publish a file
const txHash = await ckbfs.publishFile('./example.txt', {
  contentType: 'text/plain',
  filename: 'example.txt'
});

console.log(`File published: ${txHash}`);
```

## API Reference

### CKBFS Class

#### Constructor

```typescript
new CKBFS(signerOrPrivateKey, networkOrOptions?, options?)
```

**Parameters:**
- `signerOrPrivateKey`: `Signer | string` - CKB signer instance or private key
- `networkOrOptions`: `NetworkType | CKBFSOptions` - Network type or configuration options
- `options`: `CKBFSOptions` - Additional configuration when using private key

**CKBFSOptions:**
```typescript
interface CKBFSOptions {
  chunkSize?: number;     // Default: 30KB
  version?: string;       // Default: V2
  useTypeID?: boolean;    // Default: false
  network?: NetworkType;  // Default: Testnet
}
```

#### Methods

##### publishFile(filePath, options?)

Publishes a file to CKBFS from the file system.

```typescript
async publishFile(filePath: string, options?: FileOptions): Promise<string>
```

##### publishContent(content, options)

Publishes content directly without reading from file system.

```typescript
async publishContent(
  content: string | Uint8Array, 
  options: PublishContentOptions
): Promise<string>
```

##### appendFile(filePath, ckbfsCell, options?)

Appends content from a file to an existing CKBFS file.

```typescript
async appendFile(
  filePath: string,
  ckbfsCell: AppendOptions['ckbfsCell'],
  options?: Omit<FileOptions, 'contentType' | 'filename'>
): Promise<string>
```

##### appendContent(content, ckbfsCell, options?)

Appends content directly to an existing CKBFS file.

```typescript
async appendContent(
  content: string | Uint8Array,
  ckbfsCell: AppendOptions['ckbfsCell'],
  options?: AppendContentOptions
): Promise<string>
```

##### Transaction Creation Methods

Create unsigned transactions for custom signing workflows:

- `createPublishTransaction(filePath, options?)`
- `createPublishContentTransaction(content, options)`
- `createAppendTransaction(filePath, ckbfsCell, options?)`
- `createAppendContentTransaction(content, ckbfsCell, options?)`

### Types

#### FileOptions

```typescript
interface FileOptions {
  contentType?: string;
  filename?: string;
  capacity?: bigint;
  feeRate?: number;
  network?: NetworkType;
  version?: string;
  useTypeID?: boolean;
}
```

#### PublishContentOptions

```typescript
type PublishContentOptions = Omit<FileOptions, 'capacity' | 'contentType' | 'filename'> & 
  Required<Pick<FileOptions, 'contentType' | 'filename'>> & 
  { capacity?: bigint };
```

#### NetworkType

```typescript
enum NetworkType {
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

#### Protocol Versions

```typescript
const ProtocolVersion = {
  V1: '20240906.ce6724722cf6',  // Original version
  V2: '20241025.db973a8e8032'   // Enhanced version with multi-witness support
} as const;
```

## Examples

### Publishing a File

```typescript
import { CKBFS, NetworkType, ProtocolVersion } from '@ckbfs/api';

const ckbfs = new CKBFS('your-private-key', NetworkType.Testnet);

// Publish with automatic content type detection
const txHash = await ckbfs.publishFile('./document.pdf');

// Publish with custom options
const txHash2 = await ckbfs.publishFile('./data.json', {
  contentType: 'application/json',
  filename: 'my-data.json',
  capacity: 300n * 100000000n // 300 CKB
});
```

### Publishing Content Directly

```typescript
const content = "Hello, CKBFS!";
const txHash = await ckbfs.publishContent(content, {
  contentType: 'text/plain',
  filename: 'greeting.txt'
});
```

### Appending to a File

```typescript
// First, get the CKBFS cell information from a previous transaction
const ckbfsCell = await getCellInfoFromTransaction(previousTxHash);

// Append content from a file
const appendTxHash = await ckbfs.appendFile('./additional-content.txt', ckbfsCell);

// Or append content directly
const appendTxHash2 = await ckbfs.appendContent(
  "Additional content to append",
  ckbfsCell
);
```

### Retrieving Files

```typescript
import { getFileContentFromChain, saveFileFromChain } from '@ckbfs/api';
import { ClientPublicTestnet } from '@ckb-ccc/core';

const client = new ClientPublicTestnet();

// Get file content from blockchain
const content = await getFileContentFromChain(
  client,
  { txHash: 'transaction-hash', index: 0 },
  ckbfsData
);

// Save to disk
const savedPath = saveFileFromChain(content, ckbfsData, './downloaded-file.txt');
```

## Utility Functions

The SDK exports various utility functions for advanced use cases:

### Checksum Operations

```typescript
import { calculateChecksum, verifyChecksum, updateChecksum } from '@ckbfs/api';

const checksum = await calculateChecksum(fileData);
const isValid = await verifyChecksum(fileData, expectedChecksum);
const newChecksum = await updateChecksum(oldChecksum, appendedData);
```

### File Operations

```typescript
import { 
  readFileAsUint8Array, 
  getContentType, 
  splitFileIntoChunks 
} from '@ckbfs/api';

const fileData = readFileAsUint8Array('./file.txt');
const mimeType = getContentType('./file.txt');
const chunks = splitFileIntoChunks('./large-file.bin', 30 * 1024);
```

### Witness Operations

```typescript
import { 
  createCKBFSWitness, 
  extractCKBFSWitnessContent, 
  isCKBFSWitness 
} from '@ckbfs/api';

const witness = createCKBFSWitness(contentBytes);
const { version, content } = extractCKBFSWitnessContent(witness);
const isValid = isCKBFSWitness(witness);
```

## Protocol Details

### CKBFS Data Structure

CKBFS uses a molecule-encoded data structure stored in cell output data:

**V1 Format:**
```
{
  index: number,           // Single witness index
  checksum: number,        // Adler32 checksum
  contentType: string,     // MIME type
  filename: string,        // Original filename
  backLinks: BackLink[]    // Previous versions
}
```

**V2 Format:**
```
{
  indexes: number[],       // Multiple witness indexes
  checksum: number,        // Adler32 checksum
  contentType: string,     // MIME type
  filename: string,        // Original filename
  backLinks: BackLink[]    // Previous versions
}
```

### Witness Format

CKBFS witnesses contain:
- 5-byte header: "CKBFS" (0x43, 0x4B, 0x42, 0x46, 0x53)
- 1-byte version: 0x00
- Variable-length content data

### Checksum Algorithm

CKBFS uses Adler32 for content integrity verification. When appending content, the checksum is updated using the rolling Adler32 algorithm to maintain cumulative integrity across all file versions.

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running Examples

```bash
# Publish example
npm run example:publish

# Append example (requires existing transaction hash)
npm run example:append -- --txhash=0x123456...

# All examples
npm run example
```

## Environment Variables

- `CKB_PRIVATE_KEY`: Your CKB private key for examples
- `PUBLISH_TX_HASH`: Transaction hash for append examples

## Network Configuration

The SDK supports both CKB mainnet and testnet with different deployed contract addresses:

### Testnet (Default)
- CKBFS V1: `0xe8905ad29a02cf8befa9c258f4f941773839a618d75a64afc22059de9413f712`
- CKBFS V2: `0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a`

### Mainnet
- CKBFS V2: `0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a`

## License

MIT

## Contributing

Contributions are welcome. Please ensure all tests pass and follow the existing code style.

## Support

For issues and questions, please use the GitHub issue tracker.