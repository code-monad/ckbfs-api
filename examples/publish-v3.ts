import { CKBFS, NetworkType, ProtocolVersion, PublishContentOptions } from '../src/index';

// Replace with your actual private key
const privateKey = process.env.CKB_PRIVATE_KEY || 'your-private-key-here';

// Initialize the SDK for CKBFS v3
const ckbfs = new CKBFS(
  privateKey,
  NetworkType.Testnet, // Use testnet
  {
    version: ProtocolVersion.V3, // Use v3
    chunkSize: 30 * 1024, // 30KB chunks
    useTypeID: false, // Use code hash instead of type ID
    rpcUrl: 'https://ckb-testnet-rpc.nervape.com'
  }
);

/**
 * Example of publishing a file to CKBFS v3
 */
async function publishFileV3Example() {
  try {
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address: ${address.toString()}`);
    
    // Get CKBFS script config
    const config = ckbfs.getCKBFSConfig();
    console.log('Using CKBFS v3 config:', config);
    
    // Publish a text file to CKBFS v3
    const filePath = './examples/example.txt';
    
    // You can provide additional options
    const options = {
      contentType: 'text/plain',
      filename: 'v3-example.txt',
      // Specify capacity if needed (default is 200 CKB)
      // capacity: 250n * 100000000n
    };
    
    console.log(`Publishing file to CKBFS v3: ${filePath}`);
    const txHash = await ckbfs.publishFileV3(filePath, options);
    
    console.log(`File published successfully to CKBFS v3!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error publishing file to v3:', error);
    throw error;
  }
}

/**
 * Example of publishing content directly (string) to CKBFS v3
 */
async function publishContentV3Example() {
  try {
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address for v3 content publish: ${address.toString()}`);
    
    // Define content and options (contentType and filename are required)
    const content = "Hello CKBFS v3 from direct content! This uses witness-based storage with no backlinks in cell data.";
    const options: PublishContentOptions = {
      contentType: 'text/plain',
      filename: 'v3_direct_content_example.txt',
      // You can optionally specify feeRate, network, useTypeID
      // feeRate: 3000 
    };
    
    console.log(`Publishing direct content to CKBFS v3: "${content}"`);
    const txHash = await ckbfs.publishContentV3(content, options);
    
    console.log(`Direct content published successfully to CKBFS v3!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error publishing direct content to v3:', error);
    throw error;
  }
}

/**
 * Example of publishing content using the simplified V3 API
 */
async function publishContentV3WithSimplifiedAPI() {
  try {
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address for v3 content publish: ${address.toString()}`);
    
    // Define content for publishing
    const content = "Hello CKBFS v3! This example shows the simplified publishing API.";
    
    // Send the transaction using the public interface
    console.log('\n=== SENDING TRANSACTION ===');
    const txHash = await ckbfs.publishContentV3(content, {
      contentType: 'text/plain',
      filename: 'v3_tx_example.txt',
    });
    
    console.log(`Transaction sent successfully!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error in detailed v3 publish example:', error);
    throw error;
  }
}

/**
 * Main function to run the v3 publish example
 */
async function main() {
  console.log('Running CKBFS v3 publishing example...');
  console.log('=====================================');
  console.log(`Using CKBFS protocol version: ${ProtocolVersion.V3}`);
  console.log('Key v3 features:');
  console.log('- Witnesses-based storage (lower costs)');
  console.log('- No backlinks in cell data');
  console.log('- Structured witnesses with chaining');
  console.log('=====================================');
  
  try {
    // Run the simplified V3 API example
    await publishContentV3WithSimplifiedAPI();
    console.log('=====================================');
    
    // Uncomment to also test the regular publish method:
    // await publishContentV3Example();
    // console.log('=====================================');
    
    // Uncomment to also test file publishing:
    // await publishFileV3Example();
    console.log('CKBFS v3 example completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('CKBFS v3 example failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}