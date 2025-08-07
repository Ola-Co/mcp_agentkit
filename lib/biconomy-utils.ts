// lib/biconomy-utils.ts
// import { Bundler, IBundler } from '@biconomy/bundler';
import {
  createSmartAccountClient,
  Paymaster,
  DEFAULT_ENTRYPOINT_ADDRESS,
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
  BiconomySmartAccountV2,
} from '@biconomy/account';
import { sepolia } from 'viem/chains';
import type { Wallet } from 'ethers';

// const bundler = new Bundler({
//   bundlerUrl: process.env.BICONOMY_BUNDLER_URL ?? '',
//   chainId: sepolia.id,
// });

const paymaster = new Paymaster({
  paymasterUrl: process.env.BICONOMY_PAYMASTER_URL ?? '',
});

async function createValidationModule(wallet: Wallet) {
  return await ECDSAOwnershipValidationModule.create({
    signer: wallet,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });
}

export async function createOrLoadSmartAccount(
  wallet: Wallet
): Promise<BiconomySmartAccountV2> {
  const validationModule = await createValidationModule(wallet);

  const smartAccount = await createSmartAccountClient({
    signer: wallet,
    chainId: sepolia.id,
    bundlerUrl: process.env.BICONOMY_BUNDLER_URL ?? '',
    paymaster,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    defaultValidationModule: validationModule,
    activeValidationModule: validationModule,
  });

  return smartAccount;
}
