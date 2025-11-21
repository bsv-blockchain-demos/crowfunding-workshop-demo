import type { NextApiRequest, NextApiResponse } from 'next'
import { wallet } from '../../src/wallet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get wallet balance from UTXOs
    const result = await wallet.listOutputs({
      basket: 'default',
      //includeEnvelope: false
    })
    const utxos = Array.isArray(result) ? result : (result.outputs || [])
    const balance = utxos.reduce((sum: number, utxo: any) => sum + (utxo.satoshis || 0), 0)

    res.status(200).json({
      balance,
      confirmed: balance,
      utxoCount: utxos.length
    })
  } catch (error: any) {
    console.error('Balance error:', error)
    res.status(500).json({ error: error.message || 'Failed to get balance' })
  }
}
