import { PrivateKey, KeyDeriver, WalletInterface } from '@bsv/sdk'
import { Wallet, WalletStorageManager, WalletSigner, Services, StorageClient, Chain } from '@bsv/wallet-toolbox'
import { config } from 'dotenv'

config() // Load .env file

// Initialize wallet configuration
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
const walletInstance = new Wallet(signer, services)

// Setup storage
const client = new StorageClient(walletInstance, storageUrl)
await client.makeAvailable()
await storageManager.addWalletStorageProvider(client)

console.log('✓ Backend wallet initialized')
console.log(`✓ Identity: ${keyDeriver.identityKey}`)

export const wallet: WalletInterface = walletInstance
