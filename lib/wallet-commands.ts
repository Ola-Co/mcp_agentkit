// lib/wallet-commands.ts
export const WALLET_COMMANDS = [
  'connect wallet',
  'get balance',
  'get my balance',
  'check balance',
  'send tokens',
  'send eth',
  'send usdc',
  'swap tokens',
  'get wallet address',
  'wallet info',
  'transfer',
  'buy',
  'sell',
  'stake',
  'unstake',
];

export function isWalletCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return WALLET_COMMANDS.some(
    command =>
      lowerMessage.includes(command.toLowerCase()) ||
      lowerMessage.startsWith(command.toLowerCase())
  );
}

export function generateAuthLink(phoneNumber: string, baseUrl: string): string {
  const encodedPhone = encodeURIComponent(phoneNumber);
  return `${baseUrl}/auth?phone=${encodedPhone}`;
}
