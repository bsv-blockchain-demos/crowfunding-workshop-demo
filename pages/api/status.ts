import type { NextApiRequest, NextApiResponse } from 'next'
import { crowdfunding, setCrowdfundingState } from '../../lib/crowdfunding'
import { initializeBackendWallet } from '../../src/wallet'
import { loadCrowdfundingData } from '../../lib/storage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let actualBalance = 0
    let walletIdentity = ''

    // Try to get actual wallet balance from UTXOs
    try {
      const wallet = await initializeBackendWallet()
      const identityKey = await wallet.getPublicKey({ identityKey: true })
      walletIdentity = identityKey.publicKey

      // Load crowdfunding state for this wallet
      const loadedState = loadCrowdfundingData(walletIdentity)
      setCrowdfundingState(loadedState)

      const result = await wallet.listOutputs({
        basket: 'default',
        includeEnvelope: false
      })

      // listOutputs returns an object with outputs array
      const utxos = Array.isArray(result) ? result : (result.outputs || [])

      // Sum up all unspent outputs
      actualBalance = utxos.reduce((sum: number, utxo: any) => sum + (utxo.satoshis || 0), 0)
    } catch (balanceError) {
      console.error('Could not get wallet balance:', balanceError)
      // Continue without balance
    }

    res.status(200).json({
      goal: crowdfunding.goal,
      raised: crowdfunding.raised,
      actualBalance,
      investorCount: crowdfunding.investors.length,
      isComplete: crowdfunding.isComplete,
      percentFunded: Math.round((crowdfunding.raised / crowdfunding.goal) * 100),
      investors: crowdfunding.investors.map(inv => ({
        identityKey: inv.identityKey.slice(0, 16) + '...',
        amount: inv.amount,
        timestamp: inv.timestamp
      }))
    })
  } catch (error: any) {
    console.error('Status error:', error)
    res.status(500).json({ error: error.message || 'Failed to get status' })
  }
}
