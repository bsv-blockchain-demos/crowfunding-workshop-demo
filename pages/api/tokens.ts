import type { NextApiRequest, NextApiResponse } from 'next'
import { PublicKey } from '@bsv/sdk'

interface WhatsOnChainTx {
  tx_hash: string
  height: number
}

interface WhatsOnChainUtxo {
  height: number
  tx_pos: number
  tx_hash: string
  value: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the identity key from query parameter (investor's key)
    const { identityKey } = req.query

    if (!identityKey || typeof identityKey !== 'string') {
      return res.status(400).json({ error: 'Identity key is required' })
    }

    // Derive the BSV address from the identity key
    const publicKey = PublicKey.fromString(identityKey)
    const address = publicKey.toAddress().toString()

    console.log('Investor Identity Key:', identityKey)
    console.log('Derived Address:', address)

    const network = 'main' // Change to 'test' for testnet

    // Fetch both unspent outputs and transaction history
    const [unspentResponse, historyResponse] = await Promise.all([
      fetch(`https://api.whatsonchain.com/v1/bsv/${network}/address/${address}/unspent`),
      fetch(`https://api.whatsonchain.com/v1/bsv/${network}/address/${address}/history`)
    ])

    if (!unspentResponse.ok) {
      throw new Error(`WhatsOnChain API error: ${unspentResponse.status} ${unspentResponse.statusText}`)
    }

    const utxos: WhatsOnChainUtxo[] = await unspentResponse.json()
    const history: WhatsOnChainTx[] = historyResponse.ok ? await historyResponse.json() : []

    console.log(`Found ${utxos.length} UTXOs and ${history.length} transactions for address ${address}`)

    // Fetch detailed transaction data for all UTXOs
    const allOutputs = []

    for (const utxo of utxos) {
      try {
        const txResponse = await fetch(`https://api.whatsonchain.com/v1/bsv/${network}/tx/${utxo.tx_hash}`)

        if (txResponse.ok) {
          const txData = await txResponse.json()
          const output = txData.vout[utxo.tx_pos]

          const scriptHex = output.scriptPubKey?.hex || ''
          const scriptAsm = output.scriptPubKey?.asm || ''

          console.log(`TX ${utxo.tx_hash} output ${utxo.tx_pos}: ${output.value} BTC (${utxo.value} sats)`)
          console.log(`Script ASM: ${scriptAsm}`)

          // Detect PushDrop tokens by checking for:
          // 1. Small satoshi amounts (typically 1 sat)
          // 2. Long hex scripts (containing encrypted data)
          // 3. Script patterns that include data pushes
          const isPushDrop = utxo.value <= 100 || scriptHex.length > 100
          const isStandardP2PKH = scriptAsm.startsWith('OP_DUP OP_HASH160') && scriptAsm.endsWith('OP_EQUALVERIFY OP_CHECKSIG')

          allOutputs.push({
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value,
            scriptPubKey: scriptHex,
            scriptAsm: scriptAsm,
            height: txData.blockheight || utxo.height || 0,
            confirmations: txData.confirmations || 0,
            time: txData.time || txData.blocktime || 0,
            address: output.scriptPubKey?.addresses?.[0] || address,
            type: isStandardP2PKH ? 'P2PKH' : 'Unknown',
            isPushDrop: isPushDrop
          })
        }
      } catch (err) {
        console.error(`Error fetching tx ${utxo.tx_hash}:`, err)
      }
    }

    console.log(`Found ${allOutputs.length} total outputs, ${allOutputs.filter(o => o.isPushDrop).length} likely PushDrop tokens`)

    // IMPORTANT: PushDrop tokens use P2PK (Pay-to-Public-Key), not P2PKH!
    // P2PK outputs do NOT have an address - they lock to the raw public key
    // This means we CANNOT find P2PK tokens by searching for an address!
    //
    // The outputs found here are P2PKH outputs (payments TO the investor)
    // PushDrop tokens sent to this investor would NOT appear in this address search!

    res.status(200).json({
      address,
      identityKey,
      tokenCount: allOutputs.filter(o => o.isPushDrop).length,
      totalUtxos: utxos.length,
      totalTransactions: history.length,
      tokens: allOutputs,
      warning: 'P2PK PushDrop tokens cannot be found by address - you need the TXID from the completion transaction'
    })
  } catch (error: any) {
    console.error('Tokens API error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch tokens' })
  }
}
