import type { NextApiResponse } from 'next'
import {
  PaymentRequest,
  runMiddleware,
  getAuthMiddleware,
  getPaymentMiddleware
} from '../../lib/middleware'
import { crowdfunding } from '../../lib/crowdfunding'
import { saveCrowdfundingData } from '../../lib/storage'
import { Investor } from '../../src/types'
import { wallet } from '../../src/wallet'

export default async function handler(req: PaymentRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (crowdfunding.isComplete) {
    return res.status(400).json({ error: 'Crowdfunding already complete' })
  }

  try {
    // Run auth middleware first to establish identity
    const authMiddleware = await getAuthMiddleware()
    await runMiddleware(req, res, authMiddleware)

    // For crowdfunding, we need to extract the investor identity from the payment transaction
    // Since we allow unauthenticated requests, we need to manually handle identity
    // The payment middleware will use req.auth.identityKey, so we need to extract it first

    // Check if there's a payment header to extract identity from
    const paymentHeaderRaw = req.headers['x-bsv-payment']
    if (paymentHeaderRaw && typeof paymentHeaderRaw === 'string') {
      try {
        const paymentData = JSON.parse(paymentHeaderRaw)

        // Extract the investor identity from the transaction
        // We need to derive the counterparty from the derivation parameters
        // For now, let's get it from a custom field in the payment header
        if (paymentData.senderIdentityKey) {
          // Override auth identity with the sender from payment
          if (!req.auth) {
            (req as any).auth = {}
          }
          (req as any).auth.identityKey = paymentData.senderIdentityKey
        }
      } catch (e) {
        console.error('Failed to parse payment header for identity:', e)
      }
    }

    // Run payment middleware to handle the BSV payment
    const paymentMiddleware = await getPaymentMiddleware()
    await runMiddleware(req, res, paymentMiddleware)

    // At this point, req.auth.identityKey and req.payment are populated by the middleware
    if (!req.payment?.accepted) {
      return res.status(400).json({ error: 'Payment not accepted' })
    }
    console.log('Payment accepted:', req)
    const actualAmount = req.payment.satoshisPaid
    const investorKey = req.auth?.identityKey

    if (!investorKey || investorKey === 'unknown') {
      return res.status(400).json({ error: 'Investor identity required' })
    }

    if (actualAmount === 0) {
      return res.status(400).json({ error: 'Invalid investment amount' })
    }

    console.log('Investment received via payment middleware:', {
      investorKey: investorKey.slice(0, 16) + '...',
      amount: actualAmount,
      derivationPrefix: req.payment.derivationPrefix,
      derivationSuffix: req.payment.derivationSuffix
    })

    // Check if investor already exists, update amount if so
    const existingInvestor = crowdfunding.investors.find(inv => inv.identityKey === investorKey)

    if (existingInvestor) {
      existingInvestor.amount += actualAmount
      existingInvestor.timestamp = Date.now()
      console.log(`Updated existing investor: ${investorKey.slice(0, 16)}... New total: ${existingInvestor.amount} sats`)
    } else {
      // Record new investment
      const investor: Investor = {
        identityKey: investorKey,
        amount: actualAmount,
        timestamp: Date.now()
      }
      crowdfunding.investors.push(investor)
      console.log(`New investor added: ${investorKey.slice(0, 16)}... Amount: ${actualAmount} sats`)
    }

    crowdfunding.raised += actualAmount
    console.log(`Total investors: ${crowdfunding.investors.length}, Total raised: ${crowdfunding.raised} sats`)

    // Get wallet identity and save to disk
    const identityKey = await wallet.getPublicKey({ identityKey: true })
    saveCrowdfundingData(identityKey.publicKey, crowdfunding)

    console.log('Investment recorded:', {
      amount: actualAmount,
      totalRaised: crowdfunding.raised
    })

    res.status(200).json({
      success: true,
      amount: actualAmount,
      totalRaised: crowdfunding.raised,
      message: 'Investment received! Tokens will be distributed when goal is reached.'
    })
  } catch (error: any) {
    console.error('Investment error:', error)

    // Check if this is a 402 Payment Required response already sent by middleware
    if (res.headersSent) {
      return
    }

    res.status(400).json({ error: error.message || 'Payment failed' })
  }
}
