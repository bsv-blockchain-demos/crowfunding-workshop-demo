export interface Investor {
  identityKey: string
  amount: number
  timestamp: number
}

export interface CrowdfundingState {
  goal: number
  raised: number
  investors: Investor[]
  isComplete: boolean
}
