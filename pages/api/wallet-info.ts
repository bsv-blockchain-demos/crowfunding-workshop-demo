import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeBackendWallet } from '../../src/wallet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wallet = await initializeBackendWallet()
  const identityKey = await wallet.getPublicKey({ identityKey: true })
  res.status(200).json({ identityKey: identityKey.publicKey })
}
