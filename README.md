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

#### Traditional Method (with blockchain queries)

```typescript
import { getFileContentFromChain, saveFileFromChain } from '@ckbfs/api';
import { ClientPublicTestnet } from '@ckb-ccc/core';

const client = new ClientPublicTestnet();

// Get file content from blockchain (follows backlinks automatically)
const content = await getFileContentFromChain(
  client,
  { txHash: 'transaction-hash', index: 0 },
  ckbfsData
);

// Save to disk
const savedPath = saveFileFromChain(content, ckbfsData, './downloaded-file.txt');
```

#### Generic Identifier Retrieval (flexible interface)

```typescript
import { 
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
  parseIdentifier,
  IdentifierType
} from '@ckbfs/api';
import { ClientPublicTestnet } from '@ckb-ccc/core';

const client = new ClientPublicTestnet();

// Supported identifier formats:
const typeIdHex = '0xbce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a';
const ckbfsTypeIdUri = 'ckbfs://bce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a';
const ckbfsOutPointUri = 'ckbfs://431c9d668c1815d26eb4f7ac6256eb350ab351474daea8d588400146ab228780i0';

// Parse identifier to see what type it is
const parsed = parseIdentifier(ckbfsTypeIdUri);
console.log(`Type: ${parsed.type}`); // "typeId" or "outPoint"

// Get file content using any identifier format (follows backlinks automatically)
const fileData = await getFileContentFromChainByIdentifier(client, ckbfsTypeIdUri, {
  network: 'testnet',
  version: ProtocolVersion.V2,
  useTypeID: false
});

if (fileData) {
  console.log(`File: ${fileData.filename}`);
  console.log(`Size: ${fileData.size} bytes`);
  console.log(`Content type: ${fileData.contentType}`);
  console.log(`Parsed as: ${fileData.parsedId.type}`);
}

// Save file using outPoint format
const savedPath = await saveFileFromChainByIdentifier(
  client, 
  ckbfsOutPointUri, 
  './downloaded-file.txt'
);

// Decode using direct witness method with TypeID hex
const decodedData = await decodeFileFromChainByIdentifier(client, typeIdHex);
```

#### TypeID-based Retrieval (legacy interface)

```typescript
import { 
  getFileContentFromChainByTypeId,
  saveFileFromChainByTypeId,
  decodeFileFromChainByTypeId 
} from '@ckbfs/api';

// Legacy functions still work with TypeID strings
const fileData = await getFileContentFromChainByTypeId(client, typeId);
const savedPath = await saveFileFromChainByTypeId(client, typeId, './file.txt');
const decodedData = await decodeFileFromChainByTypeId(client, typeId);
```

#### Direct Witness Decoding (new method)

```typescript
import { 
  decodeWitnessContent,
  decodeFileFromWitnessData,
  saveFileFromWitnessData 
} from '@ckbfs/api';

// Decode individual witness
const decoded = decodeWitnessContent(witnessHex);
if (decoded && decoded.isValid) {
  console.log(`Content: ${decoded.content.length} bytes`);
}

// Decode complete file from witness data
const file = decodeFileFromWitnessData({
  witnesses: tx.witnesses,
  indexes: [1, 2, 3], // witness indexes containing content
  filename: 'example.txt',
  contentType: 'text/plain'
});

// Save directly from witness data
const savedPath = saveFileFromWitnessData({
  witnesses: tx.witnesses,
  indexes: [1, 2, 3],
  filename: 'example.txt',
  contentType: 'text/plain'
}, './decoded-file.txt');
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
  splitFileIntoChunks,
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
  parseIdentifier,
  IdentifierType
} from '@ckbfs/api';

const fileData = readFileAsUint8Array('./file.txt');
const mimeType = getContentType('./file.txt');
const chunks = splitFileIntoChunks('./large-file.bin', 30 * 1024);

// Generic identifier-based file operations
const client = new ClientPublicTestnet();
const identifier = 'ckbfs://bce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a';
const parsed = parseIdentifier(identifier);
const fileContent = await getFileContentFromChainByIdentifier(client, identifier);
const savedPath = await saveFileFromChainByIdentifier(client, identifier, './output.txt');
const decodedFile = await decodeFileFromChainByIdentifier(client, identifier);
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

## Identifier Formats

CKBFS supports multiple identifier formats for flexible file access:

### 1. TypeID Hex String
```
0xbce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a
```
Direct TypeID from the CKBFS cell's type script args.

### 2. CKBFS TypeID URI
```
ckbfs://bce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a
```
CKBFS URI format using TypeID (without 0x prefix).

### 3. CKBFS OutPoint URI
```
ckbfs://431c9d668c1815d26eb4f7ac6256eb350ab351474daea8d588400146ab228780i0
```
CKBFS URI format using transaction hash and output index: `ckbfs://{txHash}i{index}`

### Identifier Detection

```typescript
import { parseIdentifier, IdentifierType } from '@ckbfs/api';

const parsed = parseIdentifier('ckbfs://abc123...i0');
console.log(parsed.type); // IdentifierType.OutPoint
console.log(parsed.txHash); // '0xabc123...'
console.log(parsed.index); // 0
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

# Retrieve example (demonstrates witness decoding and generic identifier APIs)
npm run example:retrieve -- --txhash=0x123456...

# All examples
npm run example
```

## Environment Variables

- `CKB_PRIVATE_KEY`: Your CKB private key for examples
- `PUBLISH_TX_HASH`: Transaction hash for append examples
- `TARGET_TX_HASH`: Transaction hash for retrieve examples

## Advanced Usage

### Working with Different Identifier Formats

```typescript
import { 
  getFileContentFromChainByIdentifier,
  parseIdentifier,
  IdentifierType 
} from '@ckbfs/api';

// Example identifiers
const identifiers = [
  '0xabc123...', // TypeID hex
  'ckbfs://abc123...', // CKBFS TypeID URI
  'ckbfs://def456...i0' // CKBFS OutPoint URI
];

// Process any identifier format
for (const id of identifiers) {
  const parsed = parseIdentifier(id);
  console.log(`Processing ${parsed.type} identifier`);
  
  const fileData = await getFileContentFromChainByIdentifier(client, id);
  if (fileData) {
    console.log(`Retrieved: ${fileData.filename}`);
  }
}
```

### Batch File Operations

```typescript
// Retrieve multiple files using different identifier formats
const fileIdentifiers = [
  'ckbfs://file1-typeid...',
  'ckbfs://tx-hash1...i0',
  '0xfile2-typeid...'
];

const files = await Promise.all(
  fileIdentifiers.map(id => 
    getFileContentFromChainByIdentifier(client, id)
  )
);

files.forEach((file, index) => {
  if (file) {
    console.log(`File ${index + 1}: ${file.filename} (${file.size} bytes)`);
  }
});
```

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
