import { CrowdfundingState } from '../src/types'
import { loadCrowdfundingData } from './storage'

// Load persisted crowdfunding state
export const crowdfunding: CrowdfundingState = loadCrowdfundingData()

console.log('Loaded crowdfunding state:', crowdfunding)
