import type { NextApiRequest, NextApiResponse } from 'next'
import { crowdfunding } from '../../lib/crowdfunding'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    goal: crowdfunding.goal,
    raised: crowdfunding.raised,
    investorCount: crowdfunding.investors.length,
    isComplete: crowdfunding.isComplete,
    percentFunded: Math.round((crowdfunding.raised / crowdfunding.goal) * 100)
  })
}
