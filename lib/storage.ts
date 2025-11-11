import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { CrowdfundingState } from '../src/types'

const DATA_FILE = join(process.cwd(), 'crowdfunding-data.json')

export function loadCrowdfundingData(): CrowdfundingState {
  if (existsSync(DATA_FILE)) {
    try {
      const data = readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(data)
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

export function saveCrowdfundingData(state: CrowdfundingState): void {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving crowdfunding data:', error)
  }
}
