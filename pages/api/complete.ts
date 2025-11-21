import type { NextApiRequest, NextApiResponse } from 'next'
import { wallet } from '../../src/wallet'
import { crowdfunding, setCrowdfundingState } from '../../lib/crowdfunding'
import { saveCrowdfundingData, loadCrowdfundingData } from '../../lib/storage'
import { PushDrop, Utils } from '@bsv/sdk'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const walletIdentity = await wallet.getPublicKey({ identityKey: true })
  const loadedState = loadCrowdfundingData(walletIdentity.publicKey)
  setCrowdfundingState(loadedState)

  const { identityKey, paymentKey } = req.body

  if (!identityKey || typeof identityKey !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid identityKey parameter' })
  }

  if (!paymentKey || typeof paymentKey !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid paymentKey parameter' })
  }

  const investor = crowdfunding.investors.find(
    (inv) => inv.identityKey === identityKey
  )

  if (!investor) {
    return res.status(400).json({ error: 'Investor not found' })
  }

  if (investor.redeemed === true) {
    return res.status(400).json({ error: 'Investor already redeemed' })
  }

  if (crowdfunding.raised < crowdfunding.goal) {
    return res.status(400).json({
      error: 'Goal not reached',
      raised: crowdfunding.raised,
      goal: crowdfunding.goal
    })
  }

  try {
    const tokenDescription = `Crowdfunding token for ${investor.amount} sats`
    const pushdrop = new PushDrop(wallet)

    const { ciphertext } = await wallet.encrypt({
      plaintext: Utils.toArray(tokenDescription, 'utf8'),
      protocolID: [0, 'token list'],
      keyID: '1',
      counterparty: 'anyone'
    })

    const lockingScript = await pushdrop.lock(
      [ciphertext],
      [0, 'token list'],
      '1',
      identityKey
    )

    const result = await wallet.createAction({
      description: `Create token: ${tokenDescription}`,
      outputs: [
        {
          lockingScript: lockingScript.toHex(),
          satoshis: 1,
          basket: 'crowdfunding',
          outputDescription: 'Crowdfunding token'
        }
      ],
      options: {
        randomizeOutputs: false
      }
    })

    investor.redeemed = true
    saveCrowdfundingData(walletIdentity.publicKey, crowdfunding)

    const allRedeemed = crowdfunding.investors.every(inv => inv.redeemed)
    if (allRedeemed) {
      crowdfunding.isComplete = true
      crowdfunding.completionTxid = result?.txid
      saveCrowdfundingData(walletIdentity.publicKey, crowdfunding)
    }

    res.status(200).json({
      success: true,
      message: 'Token distributed to investor!',
      txid: result?.txid || 'unknown',
      tx: result.tx,
      investorCount: crowdfunding.investors.length,
      allRedeemed
    })
  } catch (error: any) {
    console.error('Complete error:', error)
    res.status(500).json({ error: error.message || 'Failed to complete' })
  }
}
