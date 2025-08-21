import { CKBFS, NetworkType, ProtocolVersion, CKBFSDataType, extractCKBFSV3WitnessContent, isCKBFSV3Witness, CKBFSData } from '../src/index';
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

// Initialize the SDK for CKBFS v3
const ckbfs = new CKBFS(
  privateKey,
  NetworkType.Testnet, // Use testnet
  {
    version: ProtocolVersion.V3, // Use v3
    chunkSize: 20 * 1024, // 20KB chunks
    useTypeID: false, // Use code hash instead of type ID
  }
);

// Initialize CKB client for testnet
const client = new ClientPublicTestnet();

/**
 * Get cell information from a v3 transaction using CKB client
 * @param txHash The transaction hash to get cell information from
 * @returns Promise resolving to the cell information including v3 backlink data
 */
async function getCellInfoFromV3Transaction(txHash: string): Promise<{ 
  outPoint: { txHash: string; index: number };
  type: Script; 
  data: CKBFSDataType;
  lock: Script;
  capacity: bigint;
  previousTxHash: string;
  previousWitnessIndex: number;
  previousChecksum: number;
}> {
  console.log(`Retrieving v3 transaction data for: ${txHash}`);
  
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
    
    console.log(`Found CKBFS v3 cell at index ${ckbfsCellIndex}`);
    console.log(`Cell type script hash: ${output.type.hash()}`);
    
    // Get output data
    const outputData = tx.outputsData[ckbfsCellIndex];
    if (!outputData) {
      throw new Error('Output data not found');
    }
    
    // Parse the output data as CKBFS v3 data
    const rawData = outputData.startsWith('0x') 
      ? ccc.bytesFrom(outputData.slice(2), 'hex')
      : Buffer.from(outputData, 'hex');
    
    // Unpack the raw data using v3 format
    const version = ProtocolVersion.V3;
    console.log(`Using protocol version ${version} for unpacking v3 cell data`);
    
    let ckbfsData: CKBFSDataType;
    try {
      ckbfsData = CKBFSData.unpack(rawData, version);
      
      console.log('Successfully unpacked CKBFS v3 cell data:');
      console.log(`- Checksum: ${ckbfsData.checksum}`);
      console.log(`- File: ${ckbfsData.filename}`);
      console.log(`- Content Type: ${ckbfsData.contentType}`);
      console.log(`- Index: ${ckbfsData.index}`);
    } catch (error) {
      console.error('Error unpacking CKBFS v3 data:', error);
      throw new Error(`Failed to unpack CKBFS v3 data: ${error}`);
    }
    
    // Extract backlink information from v3 witness
    let previousTxHash = '0x' + '00'.repeat(32);
    let previousWitnessIndex = 0;
    let previousChecksum = 0;
    
    if (ckbfsData.index !== undefined && ckbfsData.index < tx.witnesses.length) {
      const witnessHex = tx.witnesses[ckbfsData.index];
      const witness = Buffer.from(witnessHex.slice(2), 'hex');
      
      if (isCKBFSV3Witness(witness)) {
        try {
          const witnessData = extractCKBFSV3WitnessContent(witness, true);
          previousTxHash = witnessData.previousTxHash || previousTxHash;
          previousWitnessIndex = witnessData.previousWitnessIndex || 0;
          previousChecksum = witnessData.previousChecksum || 0;
          
          console.log('Extracted v3 backlink information:');
          console.log(`- Previous TX Hash: ${previousTxHash}`);
          console.log(`- Previous Witness Index: ${previousWitnessIndex}`);
          console.log(`- Previous Checksum: ${previousChecksum}`);
        } catch (error) {
          console.warn('Could not extract backlink info from witness:', error);
        }
      }
    }
    
    return {
      outPoint: {
        txHash,
        index: ckbfsCellIndex
      },
      type: output.type,
      lock: output.lock,
      capacity: output.capacity,
      data: ckbfsData,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum
    };
  } catch (error) {
    console.error('Error retrieving v3 transaction data:', error);
    throw new Error(`Failed to retrieve or parse v3 cell data: ${error}`);
  }
}

/**
 * Example of appending content to an existing CKBFS v3 file
 */
async function appendContentV3Example() {
  try {
    // Validate transaction hash
    if (publishTxHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('Please provide a valid transaction hash by setting the PUBLISH_TX_HASH environment variable or using --txhash=0x... argument');
    }
    
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`Using address: ${address.toString()}`);
    
    // Get the cell information from the v3 transaction
    console.log(`Getting v3 cell info from transaction: ${publishTxHash}`);
    const cellInfo = await getCellInfoFromV3Transaction(publishTxHash);
    
    // Create the CKBFS v3 cell structure
    const ckbfsCell = {
      outPoint: cellInfo.outPoint,
      data: cellInfo.data,
      type: cellInfo.type,
      lock: cellInfo.lock,
      capacity: cellInfo.capacity
    };
    
    // Content to append
    const contentToAppend = "\n\nThis content was appended using CKBFS v3!";
    console.log(`Appending content to CKBFS v3 file: "${contentToAppend}"`);
    
    console.log('Note: CKBFS v3 append requires backlink information from the previous transaction.');
    console.log('The SDK will create witnesses with structured backlinks.');
    console.log('Make sure your account has enough CKB to cover the fees.');
    
    const txHash = await ckbfs.appendContentV3(
      contentToAppend,
      ckbfsCell,
      publishTxHash,
      cellInfo.data.index!,
      cellInfo.data.checksum!,
      {
        feeRate: 2000,
      }
    );
    
    console.log(`Content appended successfully to CKBFS v3!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error appending content to v3:', error);
    throw error;
  }
}

/**
 * Example of transferring ownership of a CKBFS v3 file
 */
async function transferFileV3Example() {
  try {
    // Example CKBFS v3 cell (you need to replace with actual values)
    const ckbfsCell = {
      outPoint: {
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        index: 0
      },
      data: {
        index: 1,
        checksum: 12345678,
        contentType: "text/plain",
        filename: "v3-example.txt"
      },
      type: Script.from({
        codeHash: "0x25a6d8a4017d675e457b76e9228bfc3942ddbf8227f8624db4fcf315e49a6b07",
        hashType: "data1",
        args: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      }),
      lock: Script.from({
        codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
        hashType: "type",
        args: "0x1234567890abcdef1234567890abcdef12345678"
      }),
      capacity: 200n * 100000000n
    };

    // New lock script for the transferred file
    const newLock = Script.from({
      codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      hashType: "type",
      args: "0xfedcba0987654321fedcba0987654321fedcba09" // New owner's lock args
    });

    // V3 backlink information (from previous transaction)
    const previousTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const previousWitnessIndex = 1;
    const previousChecksum = 12345678; // Same checksum (transfer doesn't change content)

    console.log(`Transferring CKBFS v3 file ownership...`);
    
    const txHash = await ckbfs.transferFileV3(
      ckbfsCell,
      newLock,
      previousTxHash,
      previousWitnessIndex,
      previousChecksum,
      {
        feeRate: 2000,
      }
    );
    
    console.log(`File ownership transferred successfully in CKBFS v3!`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error('Error transferring v3 file:', error);
    throw error;
  }
}

/**
 * Main function to run the v3 append/transfer example
 */
async function main() {
  console.log('Running CKBFS v3 append/transfer example...');
  console.log('==========================================');
  console.log(`Using CKBFS protocol version: ${ProtocolVersion.V3}`);
  console.log('Key v3 operations:');
  console.log('- Append: Add content with backlink chain');
  console.log('- Transfer: Change ownership with backlink');
  console.log('- Backlinks stored in witnesses, not cell data');
  console.log('==========================================');
  
  try {
    console.log('Note: This example requires an existing CKBFS v3 cell.');
    console.log('Please run publish-v3.ts first to create a v3 file,');
    console.log('then update the cell details in this example.');
    console.log('');
    console.log('Uncomment the desired operation below:');
    console.log('');
    
    // Uncomment to test append:
    await appendContentV3Example();
    
    // Uncomment to test transfer:
    // await transferFileV3Example();
    
    console.log('Example structure completed successfully!');
    console.log('Update the cell details and uncomment operations to test.');
    process.exit(0);
  } catch (error) {
    console.error('CKBFS v3 append/transfer example failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}