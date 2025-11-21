import type { NextApiRequest, NextApiResponse } from 'next'
import { wallet } from '../../src/wallet'
import { crowdfunding, setCrowdfundingState } from '../../lib/crowdfunding'
import { saveCrowdfundingData, loadCrowdfundingData } from '../../lib/storage'
import { PushDrop, Utils } from '@bsv/sdk'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Load the latest crowdfunding state from disk
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

  // Buscar el investor por identityKey
  const investor = crowdfunding.investors.find(
    (inv) => inv.identityKey === identityKey
  )

  if (!investor) {
    return res.status(400).json({ error: 'Investor not found' })
  }

  if (investor.redeemed === true) {
    return res.status(400).json({ error: 'Investor already redeemed' })
  }

  /* if (crowdfunding.isComplete) {
    return res.status(400).json({ error: 'Already completed' })
  } */

  if (crowdfunding.raised < crowdfunding.goal) {
    return res.status(400).json({
      error: 'Goal not reached',
      raised: crowdfunding.raised,
      goal: crowdfunding.goal
    })
  }

  try {
    console.log('Distributing tokens to investors:', crowdfunding.investors)

    /* // Create transaction with PushDrop tokens for each investor
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
      result = await wallet.createAction({
        description: 'Distribute crowdfunding tokens to investors',
        outputs,
        options: {
          randomizeOutputs: false
        }
      })

      console.log('Transaction result:', result)
      console.log(`Tokens distributed! TXID: ${result.txid}`)
    } catch (createError: any) {
      console.error('createAction error:', createError)
      throw new Error(`Failed to create transaction: ${createError.message}`)
    }

    crowdfunding.isComplete = true
    crowdfunding.completionTxid = result?.txid

    // Get wallet identity and save final state
    const identityKey = await wallet.getPublicKey({ identityKey: true })
    saveCrowdfundingData(identityKey.publicKey, crowdfunding) */

    const tokenDescription = `Crowdfunding token for ${investor.amount} sats`;
    const pushdrop = new PushDrop(wallet);
    const { ciphertext } = await wallet.encrypt({
      plaintext: Utils.toArray(tokenDescription, 'utf8'),
      protocolID: [0, 'token list'],
      keyID: '1',
      counterparty: identityKey // Encrypt for the investor
    })
    const lockingScript = await pushdrop.lock(
      [ciphertext], // Token field 0: encrypted task text
      [0, 'token list'], // Protocol ID
      '1', // Key ID
      identityKey // Lock to investor's public key
    )

    const result = await wallet.createAction({
      description: `Create a new token: ${tokenDescription}`,
      outputs: [
        {
          lockingScript: lockingScript.toHex(), // Convert script to hex format
          satoshis: 1, // Amount of satoshis to lock
          basket: 'crowdfunding', // Categorize output
          outputDescription: 'Create crowdfunding token' // Output description
        }
      ],
      options: {
        randomizeOutputs: false,
      }
    })

    console.log(`✅ Completion transaction saved: ${result?.txid}`)

    // Mark investor as redeemed
    investor.redeemed = true

    // Get wallet identity and save the updated state
    const senderIdentity = await wallet.getPublicKey({ identityKey: true })
    saveCrowdfundingData(senderIdentity.publicKey, crowdfunding)

    // Check if all investors have redeemed
    const allRedeemed = crowdfunding.investors.every(inv => inv.redeemed)
    if (allRedeemed) {
      crowdfunding.isComplete = true
      crowdfunding.completionTxid = result?.txid
      saveCrowdfundingData(senderIdentity.publicKey, crowdfunding)
    }

    res.status(200).json({
      success: true,
      senderIdentity: senderIdentity.publicKey,
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
