import { CKBFS, NetworkType, ProtocolVersion, PublishContentOptions } from '../src/index';
import { ClientPublicTestnet, Transaction, ccc } from "@ckb-ccc/core";
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

// Replace with your actual private key
const privateKey = process.env.CKB_PRIVATE_KEY || 'your-private-key-here';

// Configuration for chunked publishing
const CHUNK_SIZE_LIMIT = 490 * 1024; // 490KB configurable limit
const TRANSACTION_CHUNK_SIZE = 31 * 1024; // 31KB per transaction (SDK internal chunking)

// Initialize the SDK with network and version options
const ckbfs = new CKBFS(
  privateKey,
  NetworkType.Testnet, // Use testnet
  {
    version: ProtocolVersion.V2, // Use the latest version (V2)
    chunkSize: TRANSACTION_CHUNK_SIZE,
    useTypeID: false, // Use code hash instead of type ID
  }
);

// Initialize CKB client for transaction confirmation
const client = new ClientPublicTestnet();

/**
 * Wait for transaction confirmation by polling
 * @param txHash The transaction hash to wait for
 * @param maxRetries Maximum number of retries (default: 60)
 * @param retryInterval Interval between retries in milliseconds (default: 5000)
 */
async function waitForTransactionConfirmation(
  txHash: string, 
  maxRetries: number = 60,
  retryInterval: number = 5000
): Promise<boolean> {
  console.log(`Waiting for transaction confirmation: ${txHash}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const txWithStatus = await client.getTransaction(txHash);
      if (txWithStatus && txWithStatus.status === 'committed') {
        console.log(`✅ Transaction confirmed after ${i + 1} attempts`);
        return true;
      }
      
      console.log(`⏳ Attempt ${i + 1}/${maxRetries} - Transaction status: ${txWithStatus?.status || 'unknown'}`);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    } catch (error) {
      console.log(`❌ Error checking transaction status (attempt ${i + 1}/${maxRetries}):`, error);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }
  
  console.log(`❌ Transaction not confirmed after ${maxRetries} attempts`);
  return false;
}

/**
 * Get file information from a transaction (needed for append operations)
 * @param txHash The transaction hash
 */
async function getCellInfoFromTransaction(txHash: string) {
  try {
    const txWithStatus = await client.getTransaction(txHash);
    if (!txWithStatus || !txWithStatus.transaction) {
      throw new Error(`Transaction ${txHash} not found`);
    }
    
    const tx = Transaction.from(txWithStatus.transaction);
    const output = tx.outputs[0]; // First output should be CKBFS cell
    
    if (!output || !output.type) {
      throw new Error('No CKBFS cell found in the transaction');
    }
    
    // Parse output data using CKBFS utilities
    const outputData = tx.outputsData[0];
    const rawData = outputData.startsWith('0x') 
      ? ccc.bytesFrom(outputData.slice(2), 'hex')
      : Buffer.from(outputData, 'hex');
    
    // Import CKBFSData utility for proper parsing
    const { CKBFSData } = await import('../src/utils/molecule');
    
    // Try to unpack CKBFS data with both protocol versions
    let ckbfsData: any;
    try {
      ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V2);
    } catch (error) {
      try {
        ckbfsData = CKBFSData.unpack(rawData, ProtocolVersion.V1);
      } catch (v1Error) {
        throw new Error(`Failed to unpack CKBFS data: V2(${error}), V1(${v1Error})`);
      }
    }
    
    return {
      outPoint: {
        txHash,
        index: 0
      },
      type: output.type,
      lock: output.lock,
      capacity: output.capacity,
      data: ckbfsData // Now properly parsed CKBFSDataType
    };
  } catch (error) {
    console.error('Error retrieving cell info:', error);
    throw error;
  }
}

/**
 * Publish a large file using chunked approach
 * @param filePath Path to the file to publish
 * @param options Publishing options
 */
async function publishLargeFile(
  filePath: string, 
  options: {
    contentType?: string;
    filename?: string;
    maxChunkSize?: number;
  } = {}
): Promise<string> {
  try {
    // Check if file exists and get its size
    const fileStats = statSync(filePath);
    const fileSize = fileStats.size;
    const maxChunkSize = options.maxChunkSize || CHUNK_SIZE_LIMIT;
    
    console.log(`📁 File: ${filePath}`);
    console.log(`📏 Size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`🔧 Chunk size limit: ${maxChunkSize} bytes (${(maxChunkSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Get address info
    const address = await ckbfs.getAddress();
    console.log(`💼 Using address: ${address.toString()}`);
    
    // Determine content type and filename
    const filename = options.filename || filePath.split(/[\\\/]/).pop() || 'unknown';
    const contentType = options.contentType || 'application/octet-stream';
    
    if (fileSize <= maxChunkSize) {
      console.log('📤 File size is within limit - publishing directly...');
      
      const txHash = await ckbfs.publishFile(filePath, {
        contentType,
        filename
      });
      
      console.log(`✅ File published successfully in single transaction!`);
      console.log(`📋 Transaction Hash: ${txHash}`);
      console.log(`🔗 View at: https://pudge.explorer.nervos.org/transaction/${txHash}`);
      
      return txHash;
    } else {
      console.log('📦 File is too large - using chunked publishing...');
      console.log(`🔢 Will split into ${Math.ceil(fileSize / maxChunkSize)} chunks`);
      
      // Read file content
      const fileContent = readFileSync(filePath);
      
      // Calculate number of chunks needed
      const numChunks = Math.ceil(fileSize / maxChunkSize);
      let lastTxHash = '';
      let ckbfsCell: any = null;
      
      for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        const start = chunkIndex * maxChunkSize;
        const end = Math.min(start + maxChunkSize, fileSize);
        const chunkContent = fileContent.slice(start, end);
        
        console.log(`\n🔄 Processing chunk ${chunkIndex + 1}/${numChunks}`);
        console.log(`📏 Chunk size: ${chunkContent.length} bytes`);
        
        if (chunkIndex === 0) {
          // First chunk - publish as new file
          console.log('📤 Publishing first chunk...');
          
          lastTxHash = await ckbfs.publishContent(chunkContent, {
            contentType,
            filename
          });
          
          console.log(`✅ First chunk published: ${lastTxHash}`);
          
        } else {
          // Subsequent chunks - append to existing file
          console.log('➕ Appending chunk...');
          
          // Wait for previous transaction to be confirmed before appending
          const isConfirmed = await waitForTransactionConfirmation(lastTxHash);
          if (!isConfirmed) {
            throw new Error(`Previous transaction ${lastTxHash} was not confirmed`);
          }
          
          // Get cell info from the last transaction
          ckbfsCell = await getCellInfoFromTransaction(lastTxHash);
          
          lastTxHash = await ckbfs.appendContent(chunkContent, ckbfsCell);
          
          console.log(`✅ Chunk ${chunkIndex + 1} appended: ${lastTxHash}`);
        }
        
        console.log(`🔗 View chunk ${chunkIndex + 1} at: https://pudge.explorer.nervos.org/transaction/${lastTxHash}`);
      }
      
      // Wait for final transaction confirmation
      console.log('\n⏳ Waiting for final transaction confirmation...');
      const finalConfirmed = await waitForTransactionConfirmation(lastTxHash);
      if (!finalConfirmed) {
        console.log('⚠️  Warning: Final transaction was not confirmed within timeout');
      }
      
      console.log(`\n🎉 Large file published successfully using ${numChunks} chunks!`);
      console.log(`📋 Final Transaction Hash: ${lastTxHash}`);
      console.log(`🔗 View final result at: https://pudge.explorer.nervos.org/transaction/${lastTxHash}`);
      
      return lastTxHash;
    }
  } catch (error) {
    console.error('❌ Error publishing large file:', error);
    throw error;
  }
}

/**
 * Example demonstrating chunked file publishing
 */
async function chunkedPublishExample() {
  try {
    // Example 1: Small file (should publish directly)
    console.log('\n=== Example 1: Small File (Direct Publishing) ===');
    const smallFilePath = './small-example.txt';
    
    // Create a small test file
    const fs = require('fs');
    if (!fs.existsSync(smallFilePath)) {
      fs.writeFileSync(smallFilePath, 'This is a small test file that should be published directly.');
      console.log(`Created test file: ${smallFilePath}`);
    }
    
    console.log('\n=== Example 2: Large File (Chunked Publishing) ===');
    
    // For demonstration purposes, create a larger file or use an existing one
    const largeFilePath = '/mnt/old/nvme_data/ヨルシカ - 春泥棒（OFFICIAL VIDEO） [Sw1Flgub9s8].mp4';
    
    // Create a large test file (6MB) if it doesn't exist
    if (!fs.existsSync(largeFilePath)) {
      console.log('Creating large test file (6MB) for demonstration...');
      const largeContent = Buffer.alloc(6 * 1024 * 1024, 0x41); // 6MB of 'A' characters
      fs.writeFileSync(largeFilePath, largeContent);
      console.log(`Created large test file: ${largeFilePath}`);
    }
    
    await publishLargeFile(largeFilePath, {
      contentType: 'video/mp4',
      filename: 'ヨルシカ - 春泥棒（OFFICIAL VIDEO).mp4',
      maxChunkSize: CHUNK_SIZE_LIMIT // 4MB chunks
    });
    
  } catch (error) {
    console.error('Example failed:', error);
    throw error;
  }
}

/**
 * Main function to run the chunked publishing example
 */
async function main() {
  console.log('🚀 Running CKBFS Chunked Publishing Example...');
  console.log('===============================================');
  console.log(`📋 Protocol Version: ${ProtocolVersion.V2}`);
  console.log(`📏 Chunk Size Limit: ${(CHUNK_SIZE_LIMIT / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔧 Transaction Chunk Size: ${(TRANSACTION_CHUNK_SIZE / 1024).toFixed(2)} KB`);
  
  try {
    await chunkedPublishExample();
    console.log('\n🎉 All examples completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Examples failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  publishLargeFile,
  waitForTransactionConfirmation,
  getCellInfoFromTransaction,
  CHUNK_SIZE_LIMIT,
  TRANSACTION_CHUNK_SIZE
};