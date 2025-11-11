import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeBackendWallet } from '../../src/wallet'
import { createInvestorToken } from '../../src/pushdrop'
import { crowdfunding } from '../../lib/crowdfunding'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (crowdfunding.isComplete) {
    return res.status(400).json({ error: 'Already completed' })
  }

  if (crowdfunding.raised < crowdfunding.goal) {
    return res.status(400).json({
      error: 'Goal not reached',
      raised: crowdfunding.raised,
      goal: crowdfunding.goal
    })
  }

  try {
    const wallet = await initializeBackendWallet()

    // Create transaction with PushDrop tokens for each investor
    const outputs = []

    for (const investor of crowdfunding.investors) {
      const lockingScript = await createInvestorToken(
        wallet,
        {
          amount: investor.amount,
          investorKey: investor.identityKey
        },
        investor.identityKey
      )

      outputs.push({
        outputDescription: `Token for investor ${investor.identityKey.slice(0, 10)}...`,
        satoshis: 1,
        lockingScript: lockingScript.toHex()
      })
    }

    // Create and broadcast the transaction
    const result = await wallet.createAction({
      description: 'Distribute crowdfunding tokens to investors',
      outputs
    })

    crowdfunding.isComplete = true

    res.status(200).json({
      success: true,
      message: 'Tokens distributed to all investors!',
      txid: result.txid,
      investorCount: crowdfunding.investors.length
    })
  } catch (error: any) {
    console.error('Complete error:', error)
    res.status(500).json({ error: error.message || 'Failed to complete' })
  }
}
