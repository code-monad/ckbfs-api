import {
  parseIdentifier,
  IdentifierType,
  getFileContentFromChainByIdentifier,
  saveFileFromChainByIdentifier,
  decodeFileFromChainByIdentifier,
} from '../src/index';

/**
 * Simple test script to verify generic identifier functionality
 * This script demonstrates parsing and using different identifier formats
 */

// Test identifiers
const testIdentifiers = [
  // Type 1: Pure TypeID hex string
  '0xbce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a',

  // Type 2: CKBFS URI with TypeID
  'ckbfs://bce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a',

  // Type 3: CKBFS URI with transaction hash and index
  'ckbfs://431c9d668c1815d26eb4f7ac6256eb350ab351474daea8d588400146ab228780i0',

  // Invalid formats for testing
  'invalid-identifier',
  'ckbfs://invalid',
  '0xinvalid'
];

/**
 * Test identifier parsing functionality
 */
function testIdentifierParsing() {
  console.log('=== Testing Identifier Parsing ===');

  testIdentifiers.forEach((identifier, index) => {
    console.log(`\nTest ${index + 1}: ${identifier}`);

    try {
      const parsed = parseIdentifier(identifier);
      console.log(`  Type: ${parsed.type}`);

      if (parsed.type === IdentifierType.TypeID) {
        console.log(`  TypeID: ${parsed.typeId}`);
      } else if (parsed.type === IdentifierType.OutPoint) {
        console.log(`  TxHash: ${parsed.txHash}`);
        console.log(`  Index: ${parsed.index}`);
      } else {
        console.log(`  Status: Invalid identifier format`);
      }

      console.log(`  Original: ${parsed.original}`);
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  });
}

/**
 * Test file retrieval with different identifier formats
 * Note: This requires a real CKB client and valid identifiers
 */
async function testFileRetrieval() {
  console.log('\n=== Testing File Retrieval ===');
  console.log('Note: This test requires valid identifiers and network connection');

  // This is a mock test - in real usage you would:
  // 1. Initialize a CKB client
  // 2. Use real identifiers from actual transactions
  // 3. Test the retrieval functions

  const mockClient = null; // Replace with real client
  const validIdentifier = testIdentifiers[0]; // Use a real identifier

  if (!mockClient) {
    console.log('Skipping file retrieval test - no client configured');
    return;
  }

  try {
    console.log(`Testing retrieval with: ${validIdentifier}`);

    // Test generic identifier function
    const fileData = await getFileContentFromChainByIdentifier(
      mockClient,
      validIdentifier,
      {
        network: 'testnet',
        version: '20241025.db973a8e8032',
        useTypeID: false
      }
    );

    if (fileData) {
      console.log(`✓ Retrieved: ${fileData.filename}`);
      console.log(`  Size: ${fileData.size} bytes`);
      console.log(`  Content Type: ${fileData.contentType}`);
      console.log(`  Parsed ID Type: ${fileData.parsedId.type}`);
    } else {
      console.log('✗ File not found');
    }
  } catch (error) {
    console.error(`✗ Error: ${error}`);
  }
}

/**
 * Demonstrate identifier format conversion
 */
function demonstrateFormatConversion() {
  console.log('\n=== Demonstrating Format Conversion ===');

  const typeId = 'bce89252cece632ef819943bed9cd0e2576f8ce26f9f02075b621b1c9a28056a';
  const txHash = '431c9d668c1815d26eb4f7ac6256eb350ab351474daea8d588400146ab228780';
  const index = 0;

  console.log('Creating different formats from the same data:');
  console.log(`1. TypeID hex: 0x${typeId}`);
  console.log(`2. CKBFS TypeID URI: ckbfs://${typeId}`);
  console.log(`3. CKBFS OutPoint URI: ckbfs://${txHash}i${index}`);

  // Parse each format
  const formats = [
    `0x${typeId}`,
    `ckbfs://${typeId}`,
    `ckbfs://${txHash}i${index}`
  ];

  formats.forEach((format, index) => {
    const parsed = parseIdentifier(format);
    console.log(`\nFormat ${index + 1} parsed as: ${parsed.type}`);
  });
}

/**
 * Main test function
 */
async function main() {
  console.log('CKBFS Generic Identifier Test');
  console.log('=============================');

  try {
    // Test identifier parsing
    testIdentifierParsing();

    // Demonstrate format conversion
    demonstrateFormatConversion();

    // Test file retrieval (requires real setup)
    await testFileRetrieval();

    console.log('\n=== Test Summary ===');
    console.log('✓ Identifier parsing test completed');
    console.log('✓ Format conversion demonstration completed');
    console.log('ℹ File retrieval test requires real network setup');

    console.log('\nTo test with real data:');
    console.log('1. Set up a CKB client (testnet or mainnet)');
    console.log('2. Replace mock identifiers with real ones');
    console.log('3. Run the file retrieval tests');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  testIdentifierParsing,
  testFileRetrieval,
  demonstrateFormatConversion
};
