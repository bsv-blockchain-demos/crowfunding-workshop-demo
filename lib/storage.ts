import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { CrowdfundingState } from '../src/types'

const DATA_FILE = join(process.cwd(), 'crowdfunding-data.json')

interface StoredData {
  walletIdentity: string
  crowdfunding: CrowdfundingState
}

export function loadCrowdfundingData(walletIdentity: string): CrowdfundingState {
  if (existsSync(DATA_FILE)) {
    try {
      const data = readFileSync(DATA_FILE, 'utf-8')
      const stored: StoredData = JSON.parse(data)

      // Check if wallet matches
      if (stored.walletIdentity === walletIdentity) {
        console.log('Loaded existing crowdfunding data for current wallet')
        return stored.crowdfunding
      } else {
        console.log('Wallet changed - starting fresh crowdfunding')
        console.log(`Old wallet: ${stored.walletIdentity}`)
        console.log(`New wallet: ${walletIdentity}`)
      }
    } catch (error) {
      console.error('Error loading crowdfunding data:', error)
    }
  }

  // Default state
  return {
    goal: 100,
    raised: 0,
    investors: [],
    isComplete: false
  }
}

export function saveCrowdfundingData(walletIdentity: string, state: CrowdfundingState): void {
  try {
    const stored: StoredData = {
      walletIdentity,
      crowdfunding: state
    }
    writeFileSync(DATA_FILE, JSON.stringify(stored, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving crowdfunding data:', error)
  }
}
