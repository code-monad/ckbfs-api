import { CKBFS, NetworkType, ProtocolVersion, PublishContentOptions } from '../src/index';

// Replace with your actual private key
const privateKey = process.env.CKB_PRIVATE_KEY || 'your-private-key-here';

// Initialize the SDK with network and version options
const ckbfs = new CKBFS(
  privateKey,
  NetworkType.Testnet, // Use testnet
  {
    version: ProtocolVersion.V2, // Use the latest version (V2)
    chunkSize: 30 * 1024, // 30KB chunks
    useTypeID: false // Use code hash instead of type ID
  }
);

/**
 * Example of publishing a file to CKBFS
 */
async function publishExample() {
  try {
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address: ${address.toString()}`);
    
    // Get CKBFS script config
    const config = ckbfs.getCKBFSConfig();
    console.log('Using CKBFS config:', config);
    
    // Publish a text file to CKBFS
    const filePath = './code.png';
    
    // You can provide additional options
    const options = {
      contentType: 'image/png',
      filename: 'code.png',
      // Specify capacity if needed (default is 200 CKB)
      // capacity: 250n * 100000000n
    };
    
    console.log(`Publishing file: ${filePath}`);
    const txHash = await ckbfs.publishFile(filePath, options);
    
    console.log(`File published successfully!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error publishing file:', error);
    throw error;
  }
}

/**
 * Example of publishing content directly (string) to CKBFS
 */
async function publishContentExample() {
  try {
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address for content publish: ${address.toString()}`);
    
    // Define content and options (contentType and filename are required)
    const content = "Hello CKBFS from direct content!";
    const options: PublishContentOptions = {
      contentType: 'text/plain',
      filename: 'direct_content_example.txt',
      // You can optionally specify feeRate, network, version, useTypeID
      // feeRate: 3000 
    };
    
    console.log(`Publishing direct content: "${content}"`);
    const txHash = await ckbfs.publishContent(content, options);
    
    console.log(`Direct content published successfully!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error publishing direct content:', error);
    throw error;
  }
}

/**
 * Main function to run the example
 */
async function main() {
  console.log('Running CKBFS publishing example...');
  console.log('----------------------------------');
  console.log(`Using CKBFS protocol version: ${ProtocolVersion.V2}`);
  
  try {
    await publishExample();
    console.log('----------------------------------');
    await publishContentExample();
    console.log('Example completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 
