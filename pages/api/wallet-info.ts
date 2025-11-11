import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeBackendWallet } from '../../src/wallet'
import { loadCrowdfundingData } from '../../lib/storage'
import { setCrowdfundingState } from '../../lib/crowdfunding'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wallet = await initializeBackendWallet()
  const identityKey = await wallet.getPublicKey({ identityKey: true })

  // Load crowdfunding state for this wallet
  const loadedState = loadCrowdfundingData(identityKey.publicKey)
  setCrowdfundingState(loadedState)

  res.status(200).json({ identityKey: identityKey.publicKey })
}
