import type { NextApiRequest, NextApiResponse } from 'next'
import { crowdfunding } from '../../lib/crowdfunding'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    investorCount: crowdfunding.investors.length,
    totalRaised: crowdfunding.raised,
    investors: crowdfunding.investors.map(inv => ({
      identityKey: inv.identityKey,
      amount: inv.amount,
      timestamp: inv.timestamp,
      date: new Date(inv.timestamp).toISOString()
    }))
  })
}
