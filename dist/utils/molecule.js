"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CKBFS_HEADER_STRING = exports.CKBFS_HEADER = exports.CKBFSData = exports.CKBFSDataV2 = exports.CKBFSDataV1 = exports.BackLinksV2 = exports.BackLinksV1 = exports.BackLinkV2 = exports.BackLinkV1 = exports.Indexes = void 0;
const codec_1 = require("@ckb-lumos/codec");
const base_1 = require("@ckb-lumos/base");
const constants_1 = require("./constants");
const core_1 = require("@ckb-ccc/core");
/**
 * Molecule definitions for CKBFS data structures.
 */
// Define the Indexes vector for V2
exports.Indexes = codec_1.molecule.vector(codec_1.number.Uint32);
// V1: BackLink has index as Uint32, and fields are ordered differently
exports.BackLinkV1 = codec_1.molecule.table({
    index: codec_1.number.Uint32,
    checksum: codec_1.number.Uint32,
    txHash: base_1.blockchain.Byte32,
}, ["index", "checksum", "txHash"]);
// V2: BackLink has indexes as vector of Uint32
exports.BackLinkV2 = codec_1.molecule.table({
    indexes: exports.Indexes,
    checksum: codec_1.number.Uint32,
    txHash: base_1.blockchain.Byte32,
}, ["indexes", "checksum", "txHash"]);
// Define the BackLinks vector for V1 and V2
exports.BackLinksV1 = codec_1.molecule.vector(exports.BackLinkV1);
exports.BackLinksV2 = codec_1.molecule.vector(exports.BackLinkV2);
// V1: CKBFSData has index as optional Uint32
exports.CKBFSDataV1 = codec_1.molecule.table({
    index: codec_1.number.Uint32,
    checksum: codec_1.number.Uint32,
    contentType: base_1.blockchain.Bytes,
    filename: base_1.blockchain.Bytes,
    backLinks: exports.BackLinksV1,
}, ["index", "checksum", "contentType", "filename", "backLinks"]);
// V2: CKBFSData has indexes as vector of Uint32
exports.CKBFSDataV2 = codec_1.molecule.table({
    indexes: exports.Indexes,
    checksum: codec_1.number.Uint32,
    contentType: base_1.blockchain.Bytes,
    filename: base_1.blockchain.Bytes,
    backLinks: exports.BackLinksV2,
}, ["indexes", "checksum", "contentType", "filename", "backLinks"]);
// Helper function to get indexes array from data
function getIndexes(data) {
    if (data.indexes)
        return data.indexes;
    if (typeof data.index === "number")
        return [data.index];
    return [];
}
// Helper function to get single index from data
function getIndex(data) {
    if (typeof data.index === "number")
        return data.index;
    if (data.indexes && data.indexes.length > 0)
        return data.indexes[0];
    return 0;
}
// Helper function to safely get either index or indexes from BackLinkType for V1
function getBackLinkIndex(bl) {
    if (typeof bl.index === "number") {
        return bl.index;
    }
    if (Array.isArray(bl.indexes) && bl.indexes.length > 0) {
        return bl.indexes[0];
    }
    return 0;
}
// Helper function to safely get indexes array from BackLinkType for V2
function getBackLinkIndexes(bl) {
    if (Array.isArray(bl.indexes)) {
        return bl.indexes;
    }
    if (typeof bl.index === "number") {
        return [bl.index];
    }
    return [0];
}
// Helper function to get the right CKBFSData based on version
exports.CKBFSData = {
    pack: (data, version = constants_1.ProtocolVersion.V2) => {
        if (version === constants_1.ProtocolVersion.V1) {
            // V1 formatting - uses single index
            return exports.CKBFSDataV1.pack({
                index: getIndex(data),
                checksum: data.checksum,
                contentType: core_1.ccc.bytesFrom(data.contentType, "utf8"),
                filename: core_1.ccc.bytesFrom(data.filename, "utf8"),
                backLinks: data.backLinks.map((bl) => {
                    // Ensure txHash is in proper format for molecule encoding
                    const txHash = typeof bl.txHash === "string"
                        ? core_1.ccc.bytesFrom(bl.txHash)
                        : bl.txHash;
                    return {
                        index: getBackLinkIndex(bl),
                        checksum: bl.checksum,
                        txHash,
                    };
                }),
            });
        }
        else {
            // V2 formatting - uses indexes array
            return exports.CKBFSDataV2.pack({
                indexes: getIndexes(data),
                checksum: data.checksum,
                contentType: core_1.ccc.bytesFrom(data.contentType, "utf8"),
                filename: core_1.ccc.bytesFrom(data.filename, "utf8"),
                backLinks: data.backLinks.map((bl) => {
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
    unpack: (buf, version = constants_1.ProtocolVersion.V2) => {
        try {
            if (version === constants_1.ProtocolVersion.V1) {
                const unpacked = exports.CKBFSDataV1.unpack(buf);
                return {
                    index: unpacked.index,
                    checksum: unpacked.checksum,
                    contentType: core_1.ccc.bytesTo(unpacked.contentType, "utf8"),
                    filename: core_1.ccc.bytesTo(unpacked.filename, "utf8"),
                    backLinks: unpacked.backLinks.map((bl) => ({
                        index: bl.index,
                        checksum: bl.checksum,
                        txHash: bl.txHash,
                    })),
                };
            }
            else {
                // V2 format
                const unpacked = exports.CKBFSDataV2.unpack(buf);
                return {
                    indexes: unpacked.indexes,
                    checksum: unpacked.checksum,
                    contentType: core_1.ccc.bytesTo(unpacked.contentType, "utf8"),
                    filename: core_1.ccc.bytesTo(unpacked.filename, "utf8"),
                    backLinks: unpacked.backLinks.map((bl) => ({
                        indexes: bl.indexes,
                        checksum: bl.checksum,
                        txHash: bl.txHash,
                    })),
                };
            }
        }
        catch (error) {
            console.error("Error unpacking CKBFSData:", error);
            throw new Error("Failed to unpack CKBFSData: " + error);
        }
    },
};
// Constants for CKBFS protocol
exports.CKBFS_HEADER = new Uint8Array([0x43, 0x4b, 0x42, 0x46, 0x53]); // "CKBFS" in ASCII
exports.CKBFS_HEADER_STRING = "CKBFS";
