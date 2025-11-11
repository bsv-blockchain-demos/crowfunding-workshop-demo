import { CrowdfundingState } from '../src/types'

// Crowdfunding state - will be initialized when wallet loads
export let crowdfunding: CrowdfundingState = {
  goal: 100,
  raised: 0,
  investors: [],
  isComplete: false
}

export function setCrowdfundingState(state: CrowdfundingState) {
  crowdfunding = state
}
