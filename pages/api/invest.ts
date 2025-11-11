import type { NextApiRequest, NextApiResponse } from 'next'
import { Utils, AtomicBEEF, Transaction } from '@bsv/sdk'
import { initializeBackendWallet } from '../../src/wallet'
import { crowdfunding } from '../../lib/crowdfunding'
import { Investor } from '../../src/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { transaction, investorKey, derivationPrefix, derivationSuffix } = req.body

  if (!transaction || !investorKey || !derivationPrefix || !derivationSuffix) {
    return res.status(400).json({ error: 'Missing required payment data' })
  }

  if (crowdfunding.isComplete) {
    return res.status(400).json({ error: 'Crowdfunding already complete' })
  }

  try {
    const wallet = await initializeBackendWallet()

    // Parse transaction to get actual amount
    const tx = Utils.toArray(transaction, 'base64') as AtomicBEEF
    const parsedTx = Transaction.fromBEEF(tx)

    // Get the actual satoshi amount from the first output
    const actualAmount = parsedTx.outputs[0].satoshis || 0

    if (actualAmount === 0) {
      return res.status(400).json({ error: 'Invalid transaction amount' })
    }

    console.log('Internalizing payment:', {
      amount: actualAmount,
      investorKey,
      derivationPrefix,
      derivationSuffix
    })

    // Let's check what key the backend expects
    try {
      const backendKey = await wallet.getPublicKey({
        protocolID: [2, '3241645161d8'],
        keyID: `${derivationPrefix} ${derivationSuffix}`,
        counterparty: investorKey,
        forSelf: true
      })
      console.log('Backend expects this key:', backendKey.publicKey)

      // Check what's in the transaction
      console.log('Transaction output script:', parsedTx.outputs[0].lockingScript.toHex())
    } catch (e) {
      console.log('Error deriving backend key:', e)
    }

    // Internalize the payment
    const result = await wallet.internalizeAction({
      tx,
      outputs: [{
        outputIndex: 0,
        protocol: 'wallet payment',
        paymentRemittance: {
          derivationPrefix,
          derivationSuffix,
          senderIdentityKey: investorKey
        }
      }],
      description: 'Crowdfunding investment'
    })

    console.log('Internalization result:', result)

    if (!result.accepted) {
      return res.status(400).json({ error: 'Payment not accepted' })
    }

    // Check if investor already exists, update amount if so
    const existingInvestor = crowdfunding.investors.find(inv => inv.identityKey === investorKey)

    if (existingInvestor) {
      existingInvestor.amount += actualAmount
      existingInvestor.timestamp = Date.now()
    } else {
      // Record new investment
      const investor: Investor = {
        identityKey: investorKey,
        amount: actualAmount,
        timestamp: Date.now()
      }
      crowdfunding.investors.push(investor)
    }

    crowdfunding.raised += actualAmount

    res.status(200).json({
      success: true,
      amount: actualAmount,
      totalRaised: crowdfunding.raised,
      message: 'Investment received! Tokens will be distributed when goal is reached.'
    })
  } catch (error: any) {
    console.error('Investment error:', error)
    res.status(400).json({ error: error.message || 'Payment failed' })
  }
}
