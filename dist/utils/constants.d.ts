/**
 * CKBFS protocol deployment constants
 */
export declare enum NetworkType {
    Mainnet = "mainnet",
    Testnet = "testnet"
}
export declare const ProtocolVersion: {
    readonly V1: "20240906.ce6724722cf6";
    readonly V2: "20241025.db973a8e8032";
};
export type ProtocolVersionType = (typeof ProtocolVersion)[keyof typeof ProtocolVersion];
export declare const CKBFS_CODE_HASH: Record<NetworkType, Record<string, string>>;
export declare const CKBFS_TYPE_ID: Record<NetworkType, Record<string, string>>;
export declare const ADLER32_CODE_HASH: Record<NetworkType, Record<string, string>>;
export declare const ADLER32_TYPE_ID: Record<NetworkType, Record<string, string>>;
export declare const DEP_GROUP_TX_HASH: Record<NetworkType, Record<string, string>>;
export declare const DEPLOY_TX_HASH: Record<NetworkType, Record<string, {
    ckbfs: string;
    adler32: string;
}>>;
export declare const DEFAULT_VERSION: "20241025.db973a8e8032";
export declare const DEFAULT_NETWORK = NetworkType.Testnet;
export interface CKBFSScriptConfig {
    codeHash: string;
    hashType: "data1" | "type";
    depTxHash: string;
    depIndex?: number;
}
/**
 * Get CKBFS script configuration for a specific network and version
 * @param network Network type (mainnet or testnet)
 * @param version Protocol version (default: latest version)
 * @param useTypeID Whether to use type ID instead of code hash (default: false)
 * @returns CKBFS script configuration
 */
export declare function getCKBFSScriptConfig(network?: NetworkType, version?: ProtocolVersionType, useTypeID?: boolean): CKBFSScriptConfig;
