import { CrowdfundingState } from '../src/types'

// In-memory crowdfunding state (for demo)
export const crowdfunding: CrowdfundingState = {
  goal: 100,
  raised: 0,
  investors: [],
  isComplete: false
}
