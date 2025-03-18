import { molecule, number } from "@ckb-lumos/codec";
import { blockchain } from "@ckb-lumos/base";
import { ProtocolVersion } from "./constants";

/**
 * Molecule definitions for CKBFS data structures.
 */

// Define the Indexes vector
export const Indexes = molecule.vector(number.Uint32);

// Define the BackLink table structure for V1
export const BackLinkV1 = molecule.table(
  {
    txHash: blockchain.Byte32,
    index: number.Uint32,
    checksum: number.Uint32,
  },
  ["txHash", "index", "checksum"]
);

// Define the BackLink table structure for V2
export const BackLinkV2 = molecule.table(
  {
    txHash: blockchain.Byte32,
    indexes: Indexes,
    checksum: number.Uint32,
  },
  ["txHash", "indexes", "checksum"]
);

// Define the BackLinks vector for V1
export const BackLinksV1 = molecule.vector(BackLinkV1);

// Define the BackLinks vector for V2
export const BackLinksV2 = molecule.vector(BackLinkV2);

// Define the CKBFSData table structure for V1
export const CKBFSDataV1 = molecule.table(
  {
    index: Indexes,
    checksum: number.Uint32,
    contentType: blockchain.Bytes,
    filename: blockchain.Bytes,
    backLinks: BackLinksV1,
  },
  ["index", "checksum", "contentType", "filename", "backLinks"]
);

// Define the CKBFSData table structure for V2
export const CKBFSDataV2 = molecule.table(
  {
    indexes: Indexes,
    checksum: number.Uint32,
    contentType: blockchain.Bytes,
    filename: blockchain.Bytes,
    backLinks: BackLinksV2,
  },
  ["indexes", "checksum", "contentType", "filename", "backLinks"]
);

// Type definitions for TypeScript
export type BackLinkTypeV1 = {
  txHash: string;
  index: number;
  checksum: number;
};

export type BackLinkTypeV2 = {
  txHash: string;
  indexes: number[];
  checksum: number;
};

// Combined type that works with both versions
export type BackLinkType = {
  txHash: string;
  index?: number;
  indexes?: number[];
  checksum: number;
};

// Combined CKBFSData type that works with both versions
export type CKBFSDataType = {
  index?: number[];
  indexes?: number[];
  checksum: number;
  contentType: Uint8Array;
  filename: Uint8Array;
  backLinks: BackLinkType[];
};

// Helper function to safely get either index or indexes
function getIndexes(data: CKBFSDataType): number[] {
  return data.indexes || data.index || [];
}

// Helper function to safely get either index or indexes from BackLinkType
function getBackLinkIndex(bl: BackLinkType): number {
  if (typeof bl.index === 'number') {
    return bl.index;
  }
  if (Array.isArray(bl.indexes) && bl.indexes.length > 0) {
    return bl.indexes[0];
  }
  return 0;
}

// Helper function to safely get indexes array from BackLinkType
function getBackLinkIndexes(bl: BackLinkType): number[] {
  if (Array.isArray(bl.indexes)) {
    return bl.indexes;
  }
  if (typeof bl.index === 'number') {
    return [bl.index];
  }
  return [0];
}

// Helper function to get the right CKBFSData based on version
export const CKBFSData = {
  pack: (data: CKBFSDataType, version: string = ProtocolVersion.V2): Uint8Array => {
    if (version === ProtocolVersion.V1) {
      // V1 formatting
      return CKBFSDataV1.pack({
        index: getIndexes(data),
        checksum: data.checksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks: data.backLinks.map(bl => ({
          txHash: bl.txHash,
          index: getBackLinkIndex(bl),
          checksum: bl.checksum,
        })),
      });
    } else {
      // V2 formatting
      return CKBFSDataV2.pack({
        indexes: getIndexes(data),
        checksum: data.checksum,
        contentType: data.contentType,
        filename: data.filename,
        backLinks: data.backLinks.map(bl => ({
          txHash: bl.txHash,
          indexes: getBackLinkIndexes(bl),
          checksum: bl.checksum,
        })),
      });
    }
  },
  unpack: (buf: Uint8Array, version: string = ProtocolVersion.V2): CKBFSDataType => {
    try {
      if (version === ProtocolVersion.V1) {
        const unpacked = CKBFSDataV1.unpack(buf);
        return {
          index: unpacked.index,
          checksum: unpacked.checksum,
          contentType: new Uint8Array(Buffer.from(unpacked.contentType)),
          filename: new Uint8Array(Buffer.from(unpacked.filename)),
          backLinks: unpacked.backLinks.map(bl => ({
            txHash: bl.txHash,
            index: bl.index,
            checksum: bl.checksum,
          })),
        };
      } else {
        // V2 format
        const unpacked = CKBFSDataV2.unpack(buf);
        return {
          indexes: unpacked.indexes,
          checksum: unpacked.checksum,
          contentType: new Uint8Array(Buffer.from(unpacked.contentType)),
          filename: new Uint8Array(Buffer.from(unpacked.filename)),
          backLinks: unpacked.backLinks.map(bl => ({
            txHash: bl.txHash,
            indexes: bl.indexes,
            checksum: bl.checksum,
          })),
        };
      }
    } catch (error) {
      console.error('Error unpacking CKBFSData:', error);
      throw new Error('Failed to unpack CKBFSData: ' + error);
    }
  }
};

// Constants for CKBFS protocol
export const CKBFS_HEADER = new Uint8Array([0x43, 0x4B, 0x42, 0x46, 0x53]); // "CKBFS" in ASCII
export const CKBFS_HEADER_STRING = "CKBFS"; 