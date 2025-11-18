import type { NextApiRequest, NextApiResponse } from 'next'
import { PublicKey } from '@bsv/sdk'

interface PushDropTokenOutput {
  txid: string
  vout: number
  satoshis: number
  scriptPubKey: string
  scriptAsm: string
  publicKey?: string
  encryptedData?: string
  isPushDrop: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { identityKey, completionTxid } = req.query

    if (!identityKey || typeof identityKey !== 'string') {
      return res.status(400).json({ error: 'Identity key is required' })
    }

    if (!completionTxid || typeof completionTxid !== 'string') {
      return res.status(400).json({
        error: 'No completion transaction found',
        message: 'The crowdfunding campaign has not been completed yet, or the completion transaction was not saved.'
      })
    }

    console.log('Fetching PushDrop tokens from completion transaction:', completionTxid)
    console.log('For investor identity key:', identityKey)

    const network = 'main' // Change to 'test' for testnet

    // Fetch the completion transaction
    const txResponse = await fetch(`https://api.whatsonchain.com/v1/bsv/${network}/tx/${completionTxid}`)

    if (!txResponse.ok) {
      throw new Error(`Failed to fetch completion transaction: ${txResponse.status}`)
    }

    const txData = await txResponse.json()
    console.log(`Transaction has ${txData.vout.length} outputs`)

    const pushDropTokens: PushDropTokenOutput[] = []

    // Look through all outputs for PushDrop tokens
    for (let i = 0; i < txData.vout.length; i++) {
      const output = txData.vout[i]
      const scriptHex = output.scriptPubKey?.hex || ''
      const scriptAsm = output.scriptPubKey?.asm || ''
      const satoshis = Math.round(output.value * 100000000) // Convert BTC to satoshis

      console.log(`Output ${i}: ${satoshis} sats, type: ${output.scriptPubKey?.type}`)

      // PushDrop tokens have these characteristics:
      // 1. Usually 1 satoshi
      // 2. Type is "nonstandard" or "unknown"
      // 3. Script contains OP_2DROP and OP_CHECKSIG
      // 4. Contains a public key

      const hasDropOps = scriptAsm.includes('OP_DROP') || scriptAsm.includes('OP_2DROP')
      const hasCheckSig = scriptAsm.includes('OP_CHECKSIG')
      const isNonStandard = output.scriptPubKey?.type === 'nonstandard' || output.scriptPubKey?.type === 'unknown'

      const isPushDrop = hasDropOps && hasCheckSig && (satoshis <= 100 || isNonStandard)

      if (isPushDrop) {
        console.log(`✅ Found PushDrop token at output ${i}`)

        // Extract public key from script (it's before OP_CHECKSIG)
        const parts = scriptAsm.split(' ')
        let extractedPubKey: string | undefined
        let dataHex: string | undefined

        for (let j = 0; j < parts.length; j++) {
          if (parts[j] === 'OP_CHECKSIG' && j > 0) {
            extractedPubKey = parts[j - 1]
          }
          // The encrypted data is typically the first large hex push
          if (j === 0 && parts[j].length > 60 && !parts[j].startsWith('OP_')) {
            dataHex = parts[j]
          }
        }

        // Normalize both keys for comparison (lowercase, no spaces)
        const normalizedIdentityKey = identityKey.toLowerCase().trim()
        const normalizedExtractedKey = extractedPubKey ? extractedPubKey.toLowerCase().trim() : ''

        console.log(`Comparing keys:`)
        console.log(`  Identity Key: ${normalizedIdentityKey}`)
        console.log(`  Extracted Key: ${normalizedExtractedKey}`)
        console.log(`  Match: ${normalizedExtractedKey === normalizedIdentityKey}`)

        // Check if the extracted public key matches the investor's identity key
        const isMyToken = normalizedExtractedKey === normalizedIdentityKey

        pushDropTokens.push({
          txid: completionTxid,
          vout: i,
          satoshis,
          scriptPubKey: scriptHex,
          scriptAsm,
          publicKey: extractedPubKey,
          encryptedData: dataHex,
          isPushDrop: isMyToken
        })
      }
    }

    console.log(`Found ${pushDropTokens.length} total PushDrop tokens`)
    const myTokens = pushDropTokens.filter(t => t.isPushDrop)
    console.log(`Found ${myTokens.length} tokens for this investor`)

    res.status(200).json({
      identityKey,
      completionTxid,
      tokenCount: myTokens.length,
      allTokenCount: pushDropTokens.length,
      tokens: myTokens.length > 0 ? myTokens : pushDropTokens, // Show all if none match
      txLink: `https://whatsonchain.com/tx/${completionTxid}`
    })
  } catch (error: any) {
    console.error('My tokens API error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch tokens' })
  }
}
