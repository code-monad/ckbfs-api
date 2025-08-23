/**
 * CKBFS protocol deployment constants
 */

export enum NetworkType {
  Mainnet = "mainnet",
  Testnet = "testnet",
}

// Use string literals for version values to avoid TypeScript indexing issues
export const ProtocolVersion = {
  V1: "20240906.ce6724722cf6", // Original version, compact and simple, suitable for small files
  V2: "20241025.db973a8e8032", // New version, more features and can do complex operations
  V3: "20250821.4ee6689bf7ec", // Witnesses-based storage, no backlinks in cell data, more affordable
} as const;

export type ProtocolVersionType =
  | (typeof ProtocolVersion)[keyof typeof ProtocolVersion]
  | string;

// CKBFS Type Script Constants
export const CKBFS_CODE_HASH: Record<NetworkType, Record<string, string>> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]:
      "0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a",
    [ProtocolVersion.V3]:
      "0xb5d13ffe0547c78021c01fe24dce2e959a1ed8edbca3cb93dd2e9f57fb56d695",
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]:
      "0xe8905ad29a02cf8befa9c258f4f941773839a618d75a64afc22059de9413f712",
    [ProtocolVersion.V2]:
      "0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a",
    [ProtocolVersion.V3]:
      "0xb5d13ffe0547c78021c01fe24dce2e959a1ed8edbca3cb93dd2e9f57fb56d695",
  },
};

export const CKBFS_TYPE_ID: Record<NetworkType, Record<string, string>> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]:
      "0xfd2058c9a0c0183354cf637e25d2707ffa9bb6fa2ba9b29f4ebc6be3e54ad7eb",
    [ProtocolVersion.V3]:
      "0xcc5411e8b70e551d7a3dd806256533cff6bc12118b48dd7b2d5d2292c3651add",
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]:
      "0x88ef4d436af35684a27edda0d44dd8771318330285f90f02d13606e095aea86f",
    [ProtocolVersion.V2]:
      "0x7c6dcab8268201f064dc8676b5eafa60ca2569e5c6209dcbab0eb64a9cb3aaa3",
    [ProtocolVersion.V3]:
      "0xaebf5a7b541da9603c2066a9768d3d18fea2e7f3c1943821611545155fecc671",
  },
};

// Adler32 Hasher Constants
export const ADLER32_CODE_HASH: Record<NetworkType, Record<string, string>> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]:
      "0x2138683f76944437c0c643664120d620bdb5858dd6c9d1d156805e279c2c536f",
    [ProtocolVersion.V3]:
      "0xbd944c8c5aa127270b591d50ab899c9a2a3e4429300db4ea3d7523aa592c1db1",
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]:
      "0x8af42cd329cf1bcffb4c73b48252e99cb32346fdbc1cdaa5ae1d000232d47e84",
    [ProtocolVersion.V2]:
      "0x2138683f76944437c0c643664120d620bdb5858dd6c9d1d156805e279c2c536f",
    [ProtocolVersion.V3]:
      "0xbd944c8c5aa127270b591d50ab899c9a2a3e4429300db4ea3d7523aa592c1db1",
  },
};

export const ADLER32_TYPE_ID: Record<NetworkType, Record<string, string>> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]:
      "0x641c01d590833a3f5471bd441651d9f2a8a200141949cdfeef2d68d8094c5876",
    [ProtocolVersion.V3]:
      "0x01b150adbbcba724a3917aefec6453ce4dbf70072d31ad42d0f3429ea32c692b",
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]:
      "0xccf29a0d8e860044a3d2f6a6e709f6572f77e4fe245fadd212fc342337048d60",
    [ProtocolVersion.V2]:
      "0x5f73f128be76e397f5a3b56c94ca16883a8ee91b498bc0ee80473818318c05ac",
    [ProtocolVersion.V3]:
      "0x552e2a5e679f45bca7834b03a1f8613f2a910b64a7bafb51986cfc6f1b6cb31c",
  },
};

// Dep Group Transaction Constants
export const DEP_GROUP_TX_HASH: Record<NetworkType, Record<string, string>> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]:
      "0xfab07962ed7178ed88d450774e2a6ecd50bae856bdb9b692980be8c5147d1bfa",
    [ProtocolVersion.V3]:
      "0x03deba7f8206c81981d6f6a2d61b67dde75b4df91cbcfaf2e2fb041ba50c4719",
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]:
      "0xc8fd44aba36f0c4b37536b6c7ea3b88df65fa97e02f77cd33b9bf20bf241a09b",
    [ProtocolVersion.V2]:
      "0x469af0d961dcaaedd872968a9388b546717a6ccfa47b3165b3f9c981e9d66aaa",
    [ProtocolVersion.V3]:
      "0x47cfa8d554cccffe7796f93b58437269de1f98f029d0a52b6b146381f3e95e61",
  },
};

// Deploy Transaction Constants
export const DEPLOY_TX_HASH: Record<
  NetworkType,
  Record<string, { ckbfs: string; adler32: string }>
> = {
  [NetworkType.Mainnet]: {
    [ProtocolVersion.V2]: {
      ckbfs:
        "0xc9b6698f44c3b80e7e1c48823b2714e432b93f0206ffaf9df885d23267ed2ebc",
      adler32:
        "0xc9b6698f44c3b80e7e1c48823b2714e432b93f0206ffaf9df885d23267ed2ebc",
    },
    [ProtocolVersion.V3]: {
      ckbfs:
        "0xd25f2c32f56c28c630d4f91955f1b3c9cd53e26fa0745d540d934e8e3d3c2853",
      adler32:
        "0xd25f2c32f56c28c630d4f91955f1b3c9cd53e26fa0745d540d934e8e3d3c2853",
    },
  },
  [NetworkType.Testnet]: {
    [ProtocolVersion.V1]: {
      ckbfs:
        "0xde8eb09151fbcdcba398423159ce348cc89a38a736de3fd0960b18b084465382",
      adler32:
        "0x042f264d7397a181437b51ff9981cf536f252ab5740b61ce52ce31ada04ed54b",
    },
    [ProtocolVersion.V2]: {
      ckbfs:
        "0x2c8c9ad3134743368b5a79977648f96c5bd0aba187021a72fb624301064d3616",
      adler32:
        "0x2c8c9ad3134743368b5a79977648f96c5bd0aba187021a72fb624301064d3616",
    },
    [ProtocolVersion.V3]: {
      ckbfs:
        "0x1488b592b0946589730c906c6d9a46fb82c1181156fc1a4251adce14002a9cfb",
      adler32:
        "0x8d6bd7ea704f9b19af5b83b81544c34982515a825e6185d88faf47583a542671",
    },
  },
};

// Default values - V3 is now the default
export const DEFAULT_VERSION = ProtocolVersion.V3;
export const DEFAULT_NETWORK = NetworkType.Testnet;

// Helper function to get CKBFS script configuration
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
export function getCKBFSScriptConfig(
  network: NetworkType = DEFAULT_NETWORK,
  version: ProtocolVersionType = DEFAULT_VERSION,
  useTypeID: boolean = false,
): CKBFSScriptConfig {
  return {
    codeHash: useTypeID
      ? CKBFS_TYPE_ID[network][version]
      : CKBFS_CODE_HASH[network][version],
    hashType: useTypeID ? "type" : "data1",
    depTxHash: DEP_GROUP_TX_HASH[network][version],
    depIndex: 0,
  };
}

import { Hex, HashType, CellDepInfo, ScriptInfo } from "@ckb-ccc/core";

export class CKBFSScriptInfo extends ScriptInfo {
  constructor(codeHash: Hex, hashType: HashType, cellDeps: CellDepInfo[]) {
    super(codeHash, hashType, cellDeps);
  }
}
