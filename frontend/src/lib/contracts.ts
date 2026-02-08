// SessionSettlement contract ABI and addresses

export const SESSION_SETTLEMENT_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_usdc', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  { inputs: [], name: 'EmptyBatch', type: 'error' },
  { inputs: [], name: 'BatchAmountOverflow', type: 'error' },
  {
    inputs: [
      { internalType: 'uint256', name: 'size', type: 'uint256' },
      { internalType: 'uint256', name: 'maxSize', type: 'uint256' },
    ],
    name: 'BatchTooLarge',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'required', type: 'uint256' },
      { internalType: 'uint256', name: 'available', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'required', type: 'uint256' },
      { internalType: 'uint256', name: 'available', type: 'uint256' },
    ],
    name: 'InsufficientAllowance',
    type: 'error',
  },
  { inputs: [], name: 'InvalidAmount', type: 'error' },
  { inputs: [], name: 'InvalidRecipient', type: 'error' },
  { inputs: [], name: 'InvalidUSDCAddress', type: 'error' },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'OwnableInvalidOwner',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
    type: 'error',
  },
  { inputs: [], name: 'ReentrancyGuardReentrantCall', type: 'error' },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'SafeERC20FailedOperation',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'SessionAlreadyExists',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'SessionNotActive',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'SessionAlreadySettled',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'recipientCount', type: 'uint256' },
    ],
    name: 'BatchSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'recipient', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'SessionSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'SessionStarted',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'emergencyWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'finalizeSession',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      {
        components: [
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
        ],
        internalType: 'struct ISessionSettlement.Settlement[]',
        name: 'settlements',
        type: 'tuple[]',
      },
    ],
    name: 'finalizeSessionBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'getSession',
    outputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'isSessionSettled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'startSession',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'usdc',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Contract addresses per chain
export const SESSION_SETTLEMENT_ADDRESSES: Record<number, `0x${string}` | undefined> = {
  // Arc Testnet - TODO: Deploy and update
  4457845: undefined,
  // Sepolia Testnet - DEPLOYED
  11155111: '0xa8876BEc40434958F86Da193505B41423eD9ad8B',
  // Base Sepolia Testnet - DEPLOYED
  84532: '0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2',
  // Base Mainnet - TODO: Deploy and update
  8453: undefined,
  // Mainnet - TODO: Deploy and update
  1: undefined,
};

// USDC addresses per chain
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mainnet
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  11155111: '0x7D8174b67FEf966371f92ED86692f66B69E427A8', // Sepolia - MockUSDC deployed
  84532: '0xc5c8977491c2dc822F4f738356ec0231F7100f52', // Base Sepolia - MockUSDC deployed
};

// ERC20 ABI for USDC interactions (includes MockUSDC mint for testnets)
export const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Testnet chain IDs where MockUSDC mint is available
export const TESTNET_CHAIN_IDS = [11155111, 84532] as const;
