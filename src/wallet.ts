import { PrivateKey, KeyDeriver } from '@bsv/sdk'
import { Wallet, WalletStorageManager, WalletSigner, Services, StorageClient, Chain } from '@bsv/wallet-toolbox'
import { config } from 'dotenv'

config() // Load .env file

export async function initializeBackendWallet(): Promise<Wallet> {
  const privateKeyHex = process.env.PRIVATE_KEY
  const storageUrl = process.env.STORAGE_URL || 'https://storage.babbage.systems'
  const network = (process.env.NETWORK || 'main') as Chain

  if (!privateKeyHex) {
    throw new Error('PRIVATE_KEY not found in .env. Run: npm run setup')
  }

  // Initialize wallet from private key
  const privateKey = PrivateKey.fromHex(privateKeyHex)
  const keyDeriver = new KeyDeriver(privateKey)
  const storageManager = new WalletStorageManager(keyDeriver.identityKey)
  const signer = new WalletSigner(network, keyDeriver, storageManager)
  const services = new Services(network)
  const wallet = new Wallet(signer, services)

  // Setup storage
  const client = new StorageClient(wallet, storageUrl)
  await client.makeAvailable()
  await storageManager.addWalletStorageProvider(client)

  console.log('✓ Backend wallet initialized')
  console.log(`✓ Identity: ${keyDeriver.identityKey}`)

  return wallet
}
