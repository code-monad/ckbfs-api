import { molecule, number } from "@ckb-lumos/codec";
import { ProtocolVersionType } from "./constants";
/**
 * Molecule definitions for CKBFS data structures.
 */
export declare const Indexes: molecule.ArrayLayoutCodec<import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>>;
export declare const BackLinkV1: molecule.ObjectLayoutCodec<{
    index: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
}>;
export declare const BackLinkV2: molecule.ObjectLayoutCodec<{
    indexes: molecule.ArrayLayoutCodec<import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
}>;
export declare const BackLinksV1: molecule.ArrayLayoutCodec<molecule.ObjectLayoutCodec<{
    index: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
}>>;
export declare const BackLinksV2: molecule.ArrayLayoutCodec<molecule.ObjectLayoutCodec<{
    indexes: molecule.ArrayLayoutCodec<import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
}>>;
export declare const CKBFSDataV1: molecule.ObjectLayoutCodec<{
    index: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    contentType: import("@ckb-lumos/codec/lib/base").BytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    filename: import("@ckb-lumos/codec/lib/base").BytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    backLinks: molecule.ArrayLayoutCodec<molecule.ObjectLayoutCodec<{
        index: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
        checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
        txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    }>>;
}>;
export declare const CKBFSDataV2: molecule.ObjectLayoutCodec<{
    indexes: molecule.ArrayLayoutCodec<import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>>;
    checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
    contentType: import("@ckb-lumos/codec/lib/base").BytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    filename: import("@ckb-lumos/codec/lib/base").BytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    backLinks: molecule.ArrayLayoutCodec<molecule.ObjectLayoutCodec<{
        indexes: molecule.ArrayLayoutCodec<import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>>;
        checksum: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<number, number.BIish>;
        txHash: import("@ckb-lumos/codec/lib/base").FixedBytesCodec<string, import("@ckb-lumos/codec").BytesLike>;
    }>>;
}>;
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
export type BackLinkType = {
    index?: number;
    indexes?: number[];
    checksum: number;
    txHash: string;
};
export type CKBFSDataType = {
    index?: number;
    indexes?: number[];
    checksum: number;
    contentType: string;
    filename: string;
    backLinks: BackLinkType[];
};
export declare const CKBFSData: {
    pack: (data: CKBFSDataType, version?: ProtocolVersionType) => Uint8Array;
    unpack: (buf: Uint8Array, version?: ProtocolVersionType) => CKBFSDataType;
};
export declare const CKBFS_HEADER: Uint8Array<ArrayBuffer>;
export declare const CKBFS_HEADER_STRING = "CKBFS";
