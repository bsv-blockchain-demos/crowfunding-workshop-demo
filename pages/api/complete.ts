import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeBackendWallet } from '../../src/wallet'
import { createInvestorToken } from '../../src/pushdrop'
import { crowdfunding } from '../../lib/crowdfunding'
import { saveCrowdfundingData } from '../../lib/storage'

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

    console.log('Distributing tokens to investors:', crowdfunding.investors)

    // Create transaction with PushDrop tokens for each investor
    const outputs = []

    for (const investor of crowdfunding.investors) {
      console.log(`Creating token for investor: ${investor.identityKey.slice(0, 16)}... Amount: ${investor.amount} sats`)

      const lockingScript = await createInvestorToken(
        wallet,
        {
          amount: investor.amount,
          investorKey: investor.identityKey
        },
        investor.identityKey
      )

      outputs.push({
        outputDescription: `Token for investor ${investor.identityKey.slice(0, 10)}... - ${investor.amount} sats`,
        satoshis: 1,
        lockingScript: lockingScript.toHex()
      })
    }

    console.log(`Created ${outputs.length} PushDrop token outputs`)

    if (outputs.length === 0) {
      return res.status(400).json({ error: 'No outputs to create' })
    }

    // Create and broadcast the transaction
    console.log('Creating transaction with outputs:', outputs.map(o => ({ desc: o.outputDescription, sats: o.satoshis })))

    let result: any
    try {
      result = await Promise.race([
        wallet.createAction({
          description: 'Distribute crowdfunding tokens to investors',
          outputs
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction creation timeout')), 30000)
        )
      ]) as any

      console.log('Transaction result:', result)
      console.log(`Tokens distributed! TXID: ${result.txid}`)
    } catch (createError: any) {
      console.error('createAction error:', createError)
      throw new Error(`Failed to create transaction: ${createError.message}`)
    }

    crowdfunding.isComplete = true

    // Save final state
    saveCrowdfundingData(crowdfunding)

    res.status(200).json({
      success: true,
      message: 'Tokens distributed to all investors!',
      txid: result?.txid || 'unknown',
      investorCount: crowdfunding.investors.length
    })
  } catch (error: any) {
    console.error('Complete error:', error)
    res.status(500).json({ error: error.message || 'Failed to complete' })
  }
}
