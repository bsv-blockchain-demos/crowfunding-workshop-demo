import express, { Request, Response } from 'express'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from './paymentMiddleware.js'
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
  goal: 100000, // 100k satoshis goal
  raised: 0,
  investors: [],
  isComplete: false
}

async function startServer() {
  // Initialize backend wallet
  const wallet = await initializeBackendWallet()

  // Auth middleware
  const authMiddleware = createAuthMiddleware({
    allowUnauthenticated: false,
    wallet
  })

  // Public endpoint - get crowdfunding status
  app.get('/status', (req: Request, res: Response) => {
    res.json({
      goal: crowdfunding.goal,
      raised: crowdfunding.raised,
      investorCount: crowdfunding.investors.length,
      isComplete: crowdfunding.isComplete,
      percentFunded: Math.round((crowdfunding.raised / crowdfunding.goal) * 100)
    })
  })

  // Protected endpoint - invest in crowdfunding
  app.post('/invest',
    authMiddleware,
    createPaymentMiddleware({
      wallet,
      calculateRequestPrice: async (req: Request) => {
        return req.body.amount || 1000 // Minimum 1000 satoshis
      }
    }),
    async (req: Request, res: Response) => {
      const amount = req.payment?.satoshisPaid || 0
      const investorKey = req.auth?.identityKey

      if (!investorKey) {
        return res.status(400).json({ error: 'No identity key found' })
      }

      if (crowdfunding.isComplete) {
        return res.status(400).json({ error: 'Crowdfunding already complete' })
      }

      // Record the investment
      const investor: Investor = {
        identityKey: investorKey,
        amount,
        timestamp: Date.now()
      }

      crowdfunding.investors.push(investor)
      crowdfunding.raised += amount

      res.json({
        success: true,
        amount,
        totalRaised: crowdfunding.raised,
        message: 'Investment recorded! Tokens will be distributed when goal is reached.'
      })
    }
  )

  // Protected endpoint - complete crowdfunding and distribute tokens
  app.post('/complete',
    authMiddleware,
    async (req: Request, res: Response) => {
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
