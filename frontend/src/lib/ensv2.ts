import { namehash, parseAbi, toHex, type Hex } from 'viem';
import { normalize, packetToBytes } from 'viem/ens';

export const SEPOLIA_CHAIN_ID = 11_155_111;
export const UNIVERSAL_RESOLVER = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' as const;
export const SERVICE_METADATA_KEY = 'service.metadata';
export const ROLE_SET_ADDR = BigInt(1) << BigInt(0);
export const ROLE_SET_TEXT = BigInt(1) << BigInt(4);

export const permissionedResolverAbi = parseAbi([
  'function authorizeTextRoles(bytes toName,string key,address account,bool grant) returns (bool)',
  'function setText(bytes32 node,string key,string value)',
  'function setAddr(bytes32 node,address addr_)',
  'function setAddr(bytes32 node,uint256 coinType,bytes addressBytes)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function roles(uint256 resource,address account) view returns (uint256)',
]);

export function dnsEncodedName(name: string): Hex {
  return toHex(packetToBytes(normalize(name)));
}

export function ensNode(name: string): Hex {
  return namehash(normalize(name));
}

export function isEnsName(value: string): boolean {
  return value.endsWith('.eth') && value.length >= 7;
}

export type EnsWriteKind = 'text' | 'addr' | 'grant' | 'revoke';

export interface EnsPermissionStep {
  kind: EnsWriteKind;
  summary: string;
  allowed: boolean;
}
