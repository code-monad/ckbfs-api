import {
  decodeWitnessContent,
  decodeMultipleWitnessContents,
  extractFileFromWitnesses,
  decodeFileFromWitnessData,
  saveFileFromWitnessData
} from '../src/index';

/**
 * Simple demonstration of the new witness decoding APIs
 * This script shows how to use the new methods with mock data
 */

// Mock witness data for demonstration
const mockWitnesses = [
  '0x', // Empty witness (typical for secp256k1 signature)
  '0x434b42465300486f6c6c6f2c20574b424653212054686973206973206120746573742066696c652e', // CKBFS witness with "Hello, CKBFS! This is a test file."
  '0x434b42465300204d6f726520636f6e74656e7420696e207365636f6e64206368756e6b2e', // CKBFS witness with " More content in second chunk."
  '0x434b42465300204c61737420636875726b206f662074686520746573742066696c652e' // CKBFS witness with " Last chunk of the test file."
];

const mockIndexes = [1, 2, 3]; // Indexes of CKBFS witnesses
const mockFilename = 'demo-file.txt';
const mockContentType = 'text/plain';

/**
 * Demo 1: Decode individual witnesses
 */
function demo1_DecodeIndividualWitnesses() {
  console.log('=== Demo 1: Decode Individual Witnesses ===');

  for (let i = 0; i < mockWitnesses.length; i++) {
    const witness = mockWitnesses[i];
    const decoded = decodeWitnessContent(witness);

    if (decoded && decoded.isValid) {
      const contentText = new TextDecoder().decode(decoded.content);
      console.log(`Witness ${i}: "${contentText}" (${decoded.content.length} bytes)`);
    } else {
      console.log(`Witness ${i}: Not a CKBFS witness or invalid`);
    }
  }
  console.log('');
}

/**
 * Demo 2: Decode multiple witnesses at once
 */
function demo2_DecodeMultipleWitnesses() {
  console.log('=== Demo 2: Decode Multiple Witnesses ===');

  // Get only the CKBFS witnesses
  const ckbfsWitnesses = mockIndexes.map(idx => mockWitnesses[idx]);

  const combinedContent = decodeMultipleWitnessContents(ckbfsWitnesses, true);
  const contentText = new TextDecoder().decode(combinedContent);

  console.log(`Combined content from ${ckbfsWitnesses.length} witnesses:`);
  console.log(`"${contentText}"`);
  console.log(`Total size: ${combinedContent.length} bytes`);
  console.log('');
}

/**
 * Demo 3: Extract file using witness indexes
 */
function demo3_ExtractFileFromWitnesses() {
  console.log('=== Demo 3: Extract File Using Indexes ===');

  const extractedContent = extractFileFromWitnesses(mockWitnesses, mockIndexes);
  const contentText = new TextDecoder().decode(extractedContent);

  console.log(`Extracted content using indexes [${mockIndexes.join(', ')}]:`);
  console.log(`"${contentText}"`);
  console.log(`Size: ${extractedContent.length} bytes`);
  console.log('');
}

/**
 * Demo 4: High-level decode with metadata
 */
function demo4_DecodeWithMetadata() {
  console.log('=== Demo 4: Decode with Metadata ===');

  const decodedFile = decodeFileFromWitnessData({
    witnesses: mockWitnesses,
    indexes: mockIndexes,
    filename: mockFilename,
    contentType: mockContentType
  });

  console.log('Decoded file information:');
  console.log(`- Filename: ${decodedFile.filename}`);
  console.log(`- Content Type: ${decodedFile.contentType}`);
  console.log(`- Size: ${decodedFile.size} bytes`);

  const contentText = new TextDecoder().decode(decodedFile.content);
  console.log(`- Content: "${contentText}"`);
  console.log('');
}

/**
 * Demo 5: Save file from witness data
 */
function demo5_SaveFileFromWitnessData() {
  console.log('=== Demo 5: Save File from Witness Data ===');

  try {
    const savedPath = saveFileFromWitnessData({
      witnesses: mockWitnesses,
      indexes: mockIndexes,
      filename: mockFilename,
      contentType: mockContentType
    }, './demo-output.txt');

    console.log(`File saved successfully to: ${savedPath}`);

    // Verify the saved file
    const fs = require('fs');
    if (fs.existsSync(savedPath)) {
      const savedContent = fs.readFileSync(savedPath, 'utf-8');
      console.log(`Verified saved content: "${savedContent}"`);
    }
  } catch (error) {
    console.error('Error saving file:', error);
  }
  console.log('');
}

/**
 * Demo 6: Error handling with invalid data
 */
function demo6_ErrorHandling() {
  console.log('=== Demo 6: Error Handling ===');

  // Test with invalid witness
  const invalidWitness = '0x1234567890abcdef'; // Not a CKBFS witness
  const decoded = decodeWitnessContent(invalidWitness);
  console.log(`Invalid witness result: ${decoded ? 'Valid' : 'Invalid (expected)'}`);

  // Test with out-of-range indexes
  const outOfRangeIndexes = [1, 2, 10]; // Index 10 doesn't exist
  try {
    const content = extractFileFromWitnesses(mockWitnesses, outOfRangeIndexes);
    console.log(`Out-of-range handling: Successfully extracted ${content.length} bytes (partial content)`);
  } catch (error) {
    console.log(`Out-of-range handling: Error caught - ${error}`);
  }

  console.log('');
}

/**
 * Main demo function
 */
function main() {
  console.log('CKBFS Witness Decoding APIs Demonstration');
  console.log('==========================================');
  console.log('');

  console.log('Mock data:');
  console.log(`- Total witnesses: ${mockWitnesses.length}`);
  console.log(`- CKBFS witness indexes: [${mockIndexes.join(', ')}]`);
  console.log(`- Expected filename: ${mockFilename}`);
  console.log(`- Expected content type: ${mockContentType}`);
  console.log('');

  // Run all demos
  demo1_DecodeIndividualWitnesses();
  demo2_DecodeMultipleWitnesses();
  demo3_ExtractFileFromWitnesses();
  demo4_DecodeWithMetadata();
  demo5_SaveFileFromWitnessData();
  demo6_ErrorHandling();

  console.log('=== Summary ===');
  console.log('All demos completed successfully!');
  console.log('');
  console.log('Key benefits of the new witness decoding APIs:');
  console.log('- Direct access to witness content without blockchain queries');
  console.log('- Flexible handling of individual or multiple witnesses');
  console.log('- Built-in error handling for invalid data');
  console.log('- Metadata preservation and file operations');
  console.log('- Suitable for offline processing and caching scenarios');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main();
}
