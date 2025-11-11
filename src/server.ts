import express, { Request, Response } from 'express'
import { Utils, AtomicBEEF, Transaction } from '@bsv/sdk'
import { createInvestorToken } from './pushdrop.js'
import { CrowdfundingState, Investor } from './types.js'
import { initializeBackendWallet } from './wallet.js'

const app = express()
const PORT = 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Crowdfunding state (in-memory for demo)
const crowdfunding: CrowdfundingState = {
  goal: 100, // 100k satoshis goal
  raised: 0,
  investors: [],
  isComplete: false
}

async function startServer() {
  // Initialize backend wallet
  const wallet = await initializeBackendWallet()

  // Get backend wallet identity for payments
  app.get('/wallet-info', async (_req: Request, res: Response) => {
    const identityKey = await wallet.getPublicKey({ identityKey: true })
    res.json({
      identityKey: identityKey.publicKey
    })
  })

  // Public endpoint - get crowdfunding status
  app.get('/status', (_req: Request, res: Response) => {
    res.json({
      goal: crowdfunding.goal,
      raised: crowdfunding.raised,
      investorCount: crowdfunding.investors.length,
      isComplete: crowdfunding.isComplete,
      percentFunded: Math.round((crowdfunding.raised / crowdfunding.goal) * 100)
    })
  })

  // Invest endpoint - accepts payment transaction
  app.post('/invest',
    async (req: Request, res: Response) => {
      const { transaction, investorKey, derivationPrefix, derivationSuffix } = req.body

      if (!transaction || !investorKey || !derivationPrefix || !derivationSuffix) {
        return res.status(400).json({ error: 'Missing required payment data' })
      }

      if (crowdfunding.isComplete) {
        return res.status(400).json({ error: 'Crowdfunding already complete' })
      }

      try {
        // Parse transaction to get actual amount
        const tx = Utils.toArray(transaction, 'base64') as AtomicBEEF
        const parsedTx = Transaction.fromBEEF(tx)

        // Get the actual satoshi amount from the first output
        const actualAmount = parsedTx.outputs[0].satoshis || 0

        if (actualAmount === 0) {
          return res.status(400).json({ error: 'Invalid transaction amount' })
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

        res.json({
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
  )

  // Complete crowdfunding and distribute tokens
  app.post('/complete',
    async (_req: Request, res: Response) => {
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
          satoshis: 1, // Minimal satoshis for the token
          lockingScript: lockingScript.toHex()
        })
      }

      // Create and broadcast the transaction
      const result = await wallet.createAction({
        description: 'Distribute crowdfunding tokens to investors',
        outputs
      })

      crowdfunding.isComplete = true

      res.json({
        success: true,
        message: 'Tokens distributed to all investors!',
        txid: result.txid,
        investorCount: crowdfunding.investors.length
      })
    }
  )

  app.listen(PORT, () => {
    console.log(`Crowdfunding server running on http://localhost:${PORT}`)
    console.log(`Goal: ${crowdfunding.goal} satoshis`)
  })
}

startServer().catch(console.error)
