import { CKBFS, NetworkType, ProtocolVersion, CKBFSDataType, extractCKBFSWitnessContent, isCKBFSWitness, CKBFSData } from '../src/index';
import { Script, ClientPublicTestnet, Transaction, ccc } from "@ckb-ccc/core";

// Replace with your actual private key
const privateKey = process.env.CKB_PRIVATE_KEY || 'your-private-key-here';

// Parse command line arguments for transaction hash
const txHashArg = process.argv.find(arg => arg.startsWith('--txhash='));
const publishTxHash = txHashArg ? txHashArg.split('=')[1] : process.env.PUBLISH_TX_HASH || '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Ensures a string is prefixed with '0x'
 * @param value The string to ensure is hex prefixed
 * @returns A hex prefixed string
 */
function ensureHexPrefix(value: string): `0x${string}` {
  if (value.startsWith('0x')) {
    return value as `0x${string}`;
  }
  return `0x${value}` as `0x${string}`;
}

// Initialize the SDK with network and version options
const ckbfs = new CKBFS(
  privateKey,
  NetworkType.Testnet, // Use testnet
  {
    version: ProtocolVersion.V2, // Use the latest version (V2)
    chunkSize: 20 * 1024, // 20KB chunks
    useTypeID: false // Use code hash instead of type ID
  }
);

// Initialize CKB client for testnet
const client = new ClientPublicTestnet();

/**
 * Get cell information from a transaction using CKB client
 * @param txHash The transaction hash to get cell information from
 * @returns Promise resolving to the cell information
 */
async function getCellInfoFromTransaction(txHash: string): Promise<{ 
  outPoint: { txHash: string; index: number };
  type: Script; 
  data: CKBFSDataType;
  lock: Script;
  capacity: bigint;
}> {
  console.log(`Retrieving transaction data for: ${txHash}`);
  
  try {
    // Get transaction from RPC
    const txWithStatus = await client.getTransaction(txHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${txHash} not found`);
    }
    
    const tx = Transaction.from(txWithStatus.transaction);
    console.log(`Transaction found with ${tx.outputs.length} outputs`);
    
    // Find the CKBFS cell output (first output with type script)
    let ckbfsCellIndex = 0;
    const output = tx.outputs[ckbfsCellIndex];
    if (!output || !output.type) {
      throw new Error('No CKBFS cell found in the transaction');
    }
    
    console.log(`Found CKBFS cell at index ${ckbfsCellIndex}`);
    console.log(`Cell type script hash: ${output.type.hash()}`);
    
    // Get output data
    const outputData = tx.outputsData[ckbfsCellIndex];
    if (!outputData) {
      throw new Error('Output data not found');
    }
    
    // Parse the output data as CKBFS data
    // First remove 0x prefix if present
    const rawData = outputData.startsWith('0x') 
      ? ccc.bytesFrom(outputData.slice(2), 'hex')
      : Buffer.from(outputData, 'hex');
    
    // Actually unpack the raw data using CKBFSData.unpack
    // Use the same protocol version as configured in the SDK
    const version = ProtocolVersion.V2; // Use V2 as configured in SDK initialization
    console.log(`Using protocol version ${version} for unpacking cell data`);
    
    let ckbfsData: CKBFSDataType;
    try {
      ckbfsData = CKBFSData.unpack(rawData, version);
      
      // Log the actual cell data for transparency
      console.log('Successfully unpacked CKBFS cell data:');
      console.log(`- Checksum: ${ckbfsData.checksum}`);
      console.log(`- File: ${ckbfsData.filename}`);
      console.log(`- Content Type: ${ckbfsData.contentType}`);
      console.log(`- Index: ${ckbfsData.index}`);
      console.log(`- Indexes: ${ckbfsData.indexes}`);
      console.log(`- Backlinks count: ${ckbfsData.backLinks?.length || 0}`);
    } catch (error) {
      console.error('Error unpacking CKBFS data:', error);
      throw new Error(`Failed to unpack CKBFS data: ${error}`);
    }
    
    return {
      outPoint: {
        txHash,
        index: ckbfsCellIndex
      },
      type: output.type,
      lock: output.lock,
      capacity: output.capacity,
      data: ckbfsData
    };
  } catch (error) {
    console.error('Error retrieving transaction data:', error);
    
    // If we can't get or parse the real data, we should fail - not use mock data
    throw new Error(`Failed to retrieve or parse cell data: ${error}`);
  }
}

/**
 * Example of appending content to an existing CKBFS file
 */
async function appendExample() {
  try {
    // Validate transaction hash
    if (publishTxHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('Please provide a valid transaction hash by setting the PUBLISH_TX_HASH environment variable or using --txhash=0x... argument');
    }
    
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address: ${address.toString()}`);
    
    // Get lock script
    const lock = await ckbfs.getLock();
    
    // Get the cell information from the transaction
    console.log(`Getting cell info from transaction: ${publishTxHash}`);
    const ckbfsCell = await getCellInfoFromTransaction(publishTxHash);
    
    // Append content from a file
    const filePath = './append.txt';
    console.log(`Appending file: ${filePath}`);
    
    // Create a sample append.txt file for the demonstration
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'This is content to append to the previously published file.');
      console.log(`Created sample file: ${filePath}`);
    }
    
    console.log('Note: When appending data, the capacity of the cell may need to increase.');
    console.log('The SDK will automatically handle this by adding additional inputs if needed.');
    console.log('Make sure your account has enough CKB to cover the increased capacity and fees.');
    
    const txHash = await ckbfs.appendFile(filePath, ckbfsCell);
    
    console.log(`File appended successfully!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error appending file:', error);
    throw error;
  }
}

/**
 * Main function to run the example
 */
async function main() {
  console.log('Running CKBFS append example...');
  console.log('-------------------------------');
  console.log(`Using CKBFS protocol version: ${ProtocolVersion.V2}`);
  
  try {
    await appendExample();
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