import { writeFileSync } from 'fs'
import { PrivateKey, WalletClient, WalletProtocol, PublicKey, P2PKH, KeyDeriver, Utils } from '@bsv/sdk'
import { Wallet, WalletStorageManager, WalletSigner, Services, StorageClient } from '@bsv/wallet-toolbox'

const AMOUNT = 10
const NETWORK = 'main'
const STORAGE_URL = 'https://storage.babbage.systems'
const brc29ProtocolID: WalletProtocol = [2, '3241645161d8']

async function create() {
  const privateKey = PrivateKey.fromRandom()
  const publicKey = privateKey.toPublicKey()
  const address = publicKey.toAddress()
  writeFileSync('.env', `PRIVATE_KEY=${privateKey.toHex()}\nSTORAGE_URL=${STORAGE_URL}\nNETWORK=${NETWORK}\n`)
  const keyDeriver = new KeyDeriver(privateKey)
  const storageManager = new WalletStorageManager(keyDeriver.identityKey)
  const signer = new WalletSigner(NETWORK, keyDeriver, storageManager)
  const services = new Services(NETWORK)
  const wallet = new Wallet(signer, services)
  const client = new StorageClient(wallet, STORAGE_URL)
  await client.makeAvailable()
  await storageManager.addWalletStorageProvider(client)
  const localWallet = new WalletClient('json-api', 'localhost')
  await localWallet.connectToSubstrate()
  const derivationPrefix = Utils.toBase64(Utils.toArray('keyID', 'utf8'))
  const derivationSuffix = Utils.toBase64(Utils.toArray('somethingIwontforget', 'utf8'))
  const { publicKey: payer } = await localWallet.getPublicKey({ identityKey: true })
  console.log({ payer })
  const payee = publicKey.toString()
  console.log({ payee })
  const { publicKey: derivedPublicKey } = await localWallet.getPublicKey({
    counterparty: payee,
    protocolID: brc29ProtocolID,
    keyID: `${derivationPrefix} ${derivationSuffix}`
  })
  const lockingScript = new P2PKH().lock(PublicKey.fromString(derivedPublicKey).toAddress()).toHex()
  const transaction = await localWallet.createAction({
    outputs: [{
      lockingScript,
      satoshis: AMOUNT,
      outputDescription: 'Fund backend wallet'
    }],
    description: 'Funding backend wallet'
  })
  console.log({ transaction })
  if (!transaction.tx) throw new Error('No transaction created')
  const atomicBEEF = transaction.tx
  await wallet.internalizeAction({
    tx: atomicBEEF,
    outputs: [{
      outputIndex: 0,
      protocol: 'wallet payment',
      paymentRemittance: {
        derivationPrefix,
        derivationSuffix,
        senderIdentityKey: payer
      }
    }],
    description: 'Incoming wallet funding'
  })
  console.log(`Address: ${address}\nTXID: ${transaction.txid}\nhttps://whatsonchain.com/tx/${transaction.txid}`)
}

create().catch(console.error)
