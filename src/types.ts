export interface Investor {
  identityKey: string
  amount: number
  timestamp: number
  redeemed?: boolean
}

export interface CrowdfundingState {
  goal: number
  raised: number
  investors: Investor[]
  isComplete: boolean
  completionTxid?: string
}
