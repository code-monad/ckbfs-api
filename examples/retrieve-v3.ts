import { 
  getFileContentFromChainByIdentifierV3, 
  saveFileFromChainByIdentifierV3,
  NetworkType, 
  ProtocolVersion,
  ClientPublicTestnet,
  ClientPublicMainnet 
} from '../src/index';

// Initialize the CKB client
const client = new ClientPublicTestnet(); // Use testnet

/**
 * Example of retrieving a file from CKBFS v3 using TypeID
 */
async function retrieveFileByTypeIdV3Example() {
  try {
    // Example TypeID (replace with actual TypeID from a v3 published file)
    const typeId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    console.log(`Retrieving CKBFS v3 file by TypeID: ${typeId}`);
    
    const fileData = await getFileContentFromChainByIdentifierV3(
      client,
      typeId,
      {
        network: "testnet",
        version: ProtocolVersion.V3,
        useTypeID: false
      }
    );

    if (!fileData) {
      console.log('File not found or failed to retrieve');
      return;
    }

    console.log('CKBFS v3 file retrieved successfully!');
    console.log(`Filename: ${fileData.filename}`);
    console.log(`Content type: ${fileData.contentType}`);
    console.log(`Size: ${fileData.size} bytes`);
    console.log(`Checksum: ${fileData.checksum}`);
    console.log(`Content preview: ${fileData.content.slice(0, 100)}...`);
    
    return fileData;
  } catch (error) {
    console.error('Error retrieving file by TypeID from v3:', error);
    throw error;
  }
}

/**
 * Example of retrieving and saving a file from CKBFS v3
 */
async function retrieveAndSaveFileV3Example() {
  try {
    // Example TypeID (replace with actual TypeID from a v3 published file)
    const typeId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    console.log(`Retrieving and saving CKBFS v3 file by TypeID: ${typeId}`);
    
    const savedPath = await saveFileFromChainByIdentifierV3(
      client,
      typeId,
      './retrieved_v3_file.txt', // Optional output path
      {
        network: "testnet",
        version: ProtocolVersion.V3,
        useTypeID: false
      }
    );

    if (!savedPath) {
      console.log('File not found or failed to save');
      return;
    }

    console.log(`CKBFS v3 file saved successfully to: ${savedPath}`);
    
    return savedPath;
  } catch (error) {
    console.error('Error retrieving and saving file from v3:', error);
    throw error;
  }
}

/**
 * Example of retrieving a file using CKBFS URI format
 */
async function retrieveFileByURIV3Example() {
  try {
    // Example CKBFS URI (replace with actual URI)
    const ckbfsUri = "ckbfs://1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    console.log(`Retrieving CKBFS v3 file by URI: ${ckbfsUri}`);
    
    const fileData = await getFileContentFromChainByIdentifierV3(
      client,
      ckbfsUri,
      {
        network: "testnet",
        version: ProtocolVersion.V3,
        useTypeID: false
      }
    );

    if (!fileData) {
      console.log('File not found or failed to retrieve');
      return;
    }

    console.log('CKBFS v3 file retrieved successfully using URI!');
    console.log(`Filename: ${fileData.filename}`);
    console.log(`Content type: ${fileData.contentType}`);
    console.log(`Size: ${fileData.size} bytes`);
    console.log(`Checksum: ${fileData.checksum}`);
    
    return fileData;
  } catch (error) {
    console.error('Error retrieving file by URI from v3:', error);
    throw error;
  }
}

/**
 * Example of retrieving a file using OutPoint format
 */
async function retrieveFileByOutPointV3Example() {
  try {
    // Example OutPoint URI (replace with actual transaction hash and index)
    const outPointUri = "ckbfs://1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefi0";
    
    console.log(`Retrieving CKBFS v3 file by OutPoint: ${outPointUri}`);
    
    const fileData = await getFileContentFromChainByIdentifierV3(
      client,
      outPointUri,
      {
        network: "testnet",
        version: ProtocolVersion.V3,
        useTypeID: false
      }
    );

    if (!fileData) {
      console.log('File not found or failed to retrieve');
      return;
    }

    console.log('CKBFS v3 file retrieved successfully using OutPoint!');
    console.log(`Filename: ${fileData.filename}`);
    console.log(`Content type: ${fileData.contentType}`);
    console.log(`Size: ${fileData.size} bytes`);
    console.log(`Checksum: ${fileData.checksum}`);
    
    return fileData;
  } catch (error) {
    console.error('Error retrieving file by OutPoint from v3:', error);
    throw error;
  }
}

/**
 * Main function to run the v3 retrieval examples
 */
async function main() {
  console.log('Running CKBFS v3 file retrieval examples...');
  console.log('============================================');
  console.log(`Using CKBFS protocol version: ${ProtocolVersion.V3}`);
  console.log('Key v3 retrieval features:');
  console.log('- Follows witness-based backlink chain');
  console.log('- Reconstructs file from witness content');
  console.log('- Supports TypeID, URI, and OutPoint formats');
  console.log('============================================');
  
  try {
    console.log('Note: These examples require existing CKBFS v3 files.');
    console.log('Please run publish-v3.ts first to create v3 files,');
    console.log('then update the identifiers in this example.');
    console.log('');
    console.log('Supported identifier formats:');
    console.log('- TypeID: 0x1234...abcdef');
    console.log('- CKBFS URI: ckbfs://1234...abcdef');
    console.log('- OutPoint URI: ckbfs://1234...abcdefi0');
    console.log('');
    
    // Uncomment to test different retrieval methods:
    // await retrieveFileByTypeIdV3Example();
    // await retrieveAndSaveFileV3Example();
    // await retrieveFileByURIV3Example();
    // await retrieveFileByOutPointV3Example();
    
    console.log('Retrieval example structure completed successfully!');
    console.log('Update the identifiers and uncomment methods to test.');
    process.exit(0);
  } catch (error) {
    console.error('CKBFS v3 retrieval examples failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}