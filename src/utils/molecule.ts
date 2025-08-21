import { molecule, number } from "@ckb-lumos/codec";
import { blockchain } from "@ckb-lumos/base";
import { ProtocolVersion, ProtocolVersionType } from "./constants";
import { ccc } from "@ckb-ccc/core";

/**
 * Molecule definitions for CKBFS data structures.
 */

// Define the Indexes vector for V2
export const Indexes = molecule.vector(number.Uint32);

// V1: BackLink has index as Uint32, and fields are ordered differently
export const BackLinkV1 = molecule.table(
  {
    index: number.Uint32,
    checksum: number.Uint32,
    txHash: blockchain.Byte32,
  },
  ["index", "checksum", "txHash"],
);

// V2: BackLink has indexes as vector of Uint32
export const BackLinkV2 = molecule.table(
  {
    indexes: Indexes,
    checksum: number.Uint32,
    txHash: blockchain.Byte32,
  },
  ["indexes", "checksum", "txHash"],
);

// Define the BackLinks vector for V1 and V2
export const BackLinksV1 = molecule.vector(BackLinkV1);
export const BackLinksV2 = molecule.vector(BackLinkV2);

// V1: CKBFSData has index as optional Uint32
export const CKBFSDataV1 = molecule.table(
  {
    index: number.Uint32,
    checksum: number.Uint32,
    contentType: blockchain.Bytes,
    filename: blockchain.Bytes,
    backLinks: BackLinksV1,
  },
  ["index", "checksum", "contentType", "filename", "backLinks"],
);

// V2: CKBFSData has indexes as vector of Uint32
export const CKBFSDataV2 = molecule.table(
  {
    indexes: Indexes,
    checksum: number.Uint32,
    contentType: blockchain.Bytes,
    filename: blockchain.Bytes,
    backLinks: BackLinksV2,
  },
  ["indexes", "checksum", "contentType", "filename", "backLinks"],
);

// V3: CKBFSData has no backLinks (moved to witnesses)
export const CKBFSDataV3 = molecule.table(
  {
    index: number.Uint32,
    checksum: number.Uint32,
    contentType: blockchain.Bytes,
    filename: blockchain.Bytes,
  },
  ["index", "checksum", "contentType", "filename"],
);

// Type definitions for TypeScript
export type BackLinkTypeV1 = {
  index: number;
  checksum: number;
  txHash: string;
};

export type BackLinkTypeV2 = {
  indexes: number[];
  checksum: number;
  txHash: string;
};

// Combined type that works with both versions
export type BackLinkType = {
  index?: number;
  indexes?: number[];
  checksum: number;
  txHash: string;
};

// V3 specific type
export type CKBFSDataTypeV3 = {
  index: number;
  checksum: number;
  contentType: string;
  filename: string;
};

// Combined CKBFSData type that works with all versions
export type CKBFSDataType = {
  index?: number;
  indexes?: number[];
  checksum: number;
  contentType: string;
  filename: string;
  backLinks?: BackLinkType[];
};

// Helper function to get indexes array from data
function getIndexes(data: CKBFSDataType): number[] {
  if (data.indexes) return data.indexes;
  if (typeof data.index === "number") return [data.index];
  return [];
}

// Helper function to get single index from data
function getIndex(data: CKBFSDataType): number {
  if (typeof data.index === "number") return data.index;
  if (data.indexes && data.indexes.length > 0) return data.indexes[0];
  return 0;
}

// Helper function to safely get either index or indexes from BackLinkType for V1
function getBackLinkIndex(bl: BackLinkType): number {
  if (typeof bl.index === "number") {
    return bl.index;
  }
  if (Array.isArray(bl.indexes) && bl.indexes.length > 0) {
    return bl.indexes[0];
  }
  return 0;
}

// Helper function to safely get indexes array from BackLinkType for V2
function getBackLinkIndexes(bl: BackLinkType): number[] {
  if (Array.isArray(bl.indexes)) {
    return bl.indexes;
  }
  if (typeof bl.index === "number") {
    return [bl.index];
  }
  return [0];
}

// Helper function to get the right CKBFSData based on version
export const CKBFSData = {
  pack: (
    data: CKBFSDataType,
    version: ProtocolVersionType = ProtocolVersion.V2,
  ): Uint8Array => {
    if (version === ProtocolVersion.V3) {
      // V3 formatting - no backLinks, uses single index
      return CKBFSDataV3.pack({
        index: getIndex(data),
        checksum: data.checksum,
        contentType: ccc.bytesFrom(data.contentType, "utf8"),
        filename: ccc.bytesFrom(data.filename, "utf8"),
      });
    } else if (version === ProtocolVersion.V1) {
      // V1 formatting - uses single index
      return CKBFSDataV1.pack({
        index: getIndex(data),
        checksum: data.checksum,
        contentType: ccc.bytesFrom(data.contentType, "utf8"),
        filename: ccc.bytesFrom(data.filename, "utf8"),
        backLinks: (data.backLinks || []).map((bl) => {
          // Ensure txHash is in proper format for molecule encoding
          const txHash =
            typeof bl.txHash === "string"
              ? ccc.bytesFrom(bl.txHash)
              : bl.txHash;

          return {
            index: getBackLinkIndex(bl),
            checksum: bl.checksum,
            txHash,
          };
        }),
      });
    } else {
      // V2 formatting - uses indexes array
      return CKBFSDataV2.pack({
        indexes: getIndexes(data),
        checksum: data.checksum,
        contentType: ccc.bytesFrom(data.contentType, "utf8"),
        filename: ccc.bytesFrom(data.filename, "utf8"),
        backLinks: (data.backLinks || []).map((bl) => {
          // Ensure txHash is in proper format for molecule encoding
          const txHash = typeof bl.txHash === "string" ? bl.txHash : bl.txHash;

          return {
            indexes: getBackLinkIndexes(bl),
            checksum: bl.checksum,
            txHash,
          };
        }),
      });
    }
  },
  unpack: (
    buf: Uint8Array,
    version: ProtocolVersionType = ProtocolVersion.V2,
  ): CKBFSDataType => {
    try {
      if (version === ProtocolVersion.V3) {
        // V3 format - no backLinks
        const unpacked = CKBFSDataV3.unpack(buf);
        return {
          index: unpacked.index,
          checksum: unpacked.checksum,
          contentType: ccc.bytesTo(unpacked.contentType, "utf8"),
          filename: ccc.bytesTo(unpacked.filename, "utf8"),
          backLinks: [], // V3 has no backLinks in cell data
        };
      } else if (version === ProtocolVersion.V1) {
        const unpacked = CKBFSDataV1.unpack(buf);
        return {
          index: unpacked.index,
          checksum: unpacked.checksum,
          contentType: ccc.bytesTo(unpacked.contentType, "utf8"),
          filename: ccc.bytesTo(unpacked.filename, "utf8"),
          backLinks: unpacked.backLinks.map((bl) => ({
            index: bl.index,
            checksum: bl.checksum,
            txHash: bl.txHash,
          })),
        };
      } else {
        // V2 format
        const unpacked = CKBFSDataV2.unpack(buf);
        return {
          indexes: unpacked.indexes,
          checksum: unpacked.checksum,
          contentType: ccc.bytesTo(unpacked.contentType, "utf8"),
          filename: ccc.bytesTo(unpacked.filename, "utf8"),
          backLinks: unpacked.backLinks.map((bl) => ({
            indexes: bl.indexes,
            checksum: bl.checksum,
            txHash: bl.txHash,
          })),
        };
      }
    } catch (error) {
      console.error("Error unpacking CKBFSData:", error);
      throw new Error("Failed to unpack CKBFSData: " + error);
    }
  },
};

// Constants for CKBFS protocol
export const CKBFS_HEADER = new Uint8Array([0x43, 0x4b, 0x42, 0x46, 0x53]); // "CKBFS" in ASCII
export const CKBFS_HEADER_STRING = "CKBFS";
