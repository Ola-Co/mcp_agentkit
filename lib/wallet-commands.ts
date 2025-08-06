// // lib/wallet-commands.ts
// export const WALLET_COMMANDS = [
//   'connect wallet',
//   'get balance',
//   'get my balance',
//   'check balance',
//   'send tokens',
//   'send eth',
//   'send usdc',
//   'swap tokens',
//   'get wallet address',
//   'wallet info',
//   'transfer',
//   'buy',
//   'sell',
//   'stake',
//   'unstake',
// ];

// export function isWalletCommand(message: string): boolean {
//   const lowerMessage = message.toLowerCase().trim();
//   return WALLET_COMMANDS.some(
//     command =>
//       lowerMessage.includes(command.toLowerCase()) ||
//       lowerMessage.startsWith(command.toLowerCase())
//   );
// }

// export function generateAuthLink(phoneNumber: string, baseUrl: string): string {
//   const encodedPhone = encodeURIComponent(phoneNumber);
//   return `${baseUrl}/auth?phone=${encodedPhone}`;
// }
export const WALLET_COMMANDS = [
  'connect wallet',
  'get balance',
  'get my balance',
  'check balance',
  'send tokens',
  'send eth',
  'send usdc',
  'send usdt',
  'swap tokens',
  'swap usdc usdt',
  'swap usdt usdc',
  'get wallet address',
  'wallet info',
  'transfer',
  'deposit',
  'withdraw',
  'buy crypto',
  'sell crypto',
];

export function isWalletCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return WALLET_COMMANDS.some(
    command =>
      lowerMessage.includes(command.toLowerCase()) ||
      lowerMessage.startsWith(command.toLowerCase()) ||
      // Pattern matching for send commands
      /send\s+[\d.]+\s+(eth|usdc|usdt)/i.test(lowerMessage) ||
      // Pattern matching for swap commands
      /swap\s+[\d.]+\s+(usdc|usdt)\s+(for|to)\s+(usdc|usdt|eth)/i.test(
        lowerMessage
      )
  );
}

export function parseWalletCommand(message: string) {
  const lowerMessage = message.toLowerCase().trim();

  // Parse send command: "send 0.1 ETH to 0x..."
  const sendMatch = lowerMessage.match(
    /send\s+([\d.]+)\s+(eth|usdc|usdt)\s+to\s+(0x[a-f0-9]{40})/i
  );
  if (sendMatch) {
    return {
      type: 'send',
      amount: sendMatch[1],
      token: sendMatch[2].toUpperCase(),
      recipient: sendMatch[3],
    };
  }

  // Parse swap command: "swap 100 USDC for ETH"
  const swapMatch = lowerMessage.match(
    /swap\s+([\d.]+)\s+(usdc|usdt|eth)\s+(for|to)\s+(usdc|usdt|eth)/i
  );
  if (swapMatch) {
    return {
      type: 'swap',
      amount: swapMatch[1],
      fromToken: swapMatch[2].toUpperCase(),
      toToken: swapMatch[4].toUpperCase(),
    };
  }

  // Simple command matching
  if (lowerMessage.includes('balance')) return { type: 'balance' };
  if (lowerMessage.includes('wallet address')) return { type: 'address' };
  if (lowerMessage.includes('wallet info')) return { type: 'info' };

  return { type: 'unknown' };
}

export function generateAuthLink(phoneNumber: string, baseUrl: string): string {
  const encodedPhone = encodeURIComponent(phoneNumber);
  return `${baseUrl}/auth?phone=${encodedPhone}`;
}
