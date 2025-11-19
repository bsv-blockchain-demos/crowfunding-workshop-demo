import { WalletInterface } from '@bsv/sdk'
import { initializeBackendWallet } from '../src/wallet'
import { NextApiRequest, NextApiResponse } from 'next'
import { createAuthMiddleware, AuthRequest } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import { Request, Response, NextFunction } from 'express'

// Extended Next.js API Request with auth and payment data
export interface PaymentRequest extends NextApiRequest {
  payment?: {
    satoshisPaid: number
    derivationPrefix: string
    derivationSuffix: string
    accepted: boolean
    tx: any
  }
  auth?: {
    identityKey: string
  }
}

// Cache the wallet instance to avoid re-initialization
let walletInstance: WalletInterface | null = null

export async function getWalletInstance(): Promise<WalletInterface> {
  if (!walletInstance) {
    walletInstance = await initializeBackendWallet()
  }
  return walletInstance
}

// Price calculator for payment middleware
// For investments, we need to extract the amount from the transaction
// Since we don't have access to it yet, we return 1 sat minimum to trigger payment flow
// The actual amount validation happens after internalization
export function calculateInvestmentPrice(req: any): number {
  // Try to extract amount from payment header if it exists
  const paymentHeader = req.headers['x-bsv-payment']
  if (paymentHeader && typeof paymentHeader === 'string') {
    try {
      const paymentData = JSON.parse(paymentHeader)
      // If we have the amount in a custom field, use it
      if (paymentData.amount && typeof paymentData.amount === 'number') {
        return paymentData.amount
      }
    } catch (e) {
      // Failed to parse, fall back to minimum
    }
  }

  // Return 1 sat minimum to trigger the payment flow
  // The middleware will accept any amount >= 1 sat
  return 1
}

// Derivation parameters for BRC-29
export const BRC29_PROTOCOL_ID: [number, string] = [2, '3241645161d8']
export const DERIVATION_PREFIX = 'crowdfunding'

// Convert Express middleware to Next.js API route handler
export function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (req: Request, res: Response, next: NextFunction) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Extend Next.js response with Express-compatible methods
    const extendedRes: any = res

    // Add Express's res.set() method (alias for setHeader)
    if (!extendedRes.set) {
      extendedRes.set = function(field: string | Record<string, string>, value?: string) {
        if (typeof field === 'string' && value !== undefined) {
          res.setHeader(field, value)
        } else if (typeof field === 'object') {
          Object.entries(field).forEach(([key, val]) => {
            res.setHeader(key, val)
          })
        }
        return extendedRes
      }
    }

    // Add Express's res.get() method
    if (!extendedRes.get) {
      extendedRes.get = function(field: string) {
        return res.getHeader(field)
      }
    }

    // Ensure res.send works (Next.js uses res.send from http.ServerResponse)
    if (!extendedRes.send) {
      extendedRes.send = function(body: any) {
        return res.end(body)
      }
    }

    fn(req as any, extendedRes, (result: any) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

// Create auth middleware instance
let authMiddlewareInstance: ((req: Request, res: Response, next: NextFunction) => void) | null = null

export async function getAuthMiddleware() {
  if (!authMiddlewareInstance) {
    const wallet = await getWalletInstance()
    authMiddlewareInstance = createAuthMiddleware({
      wallet,
      allowUnauthenticated: true, // Allow unauthenticated - we'll get identity from payment
      logger: console,
      logLevel: 'info'
    })
  }
  return authMiddlewareInstance
}

// Create payment middleware instance
let paymentMiddlewareInstance: ((req: Request, res: Response, next: NextFunction) => Promise<void>) | null = null

export async function getPaymentMiddleware() {
  if (!paymentMiddlewareInstance) {
    const wallet = await getWalletInstance()
    paymentMiddlewareInstance = createPaymentMiddleware({
      wallet,
      calculateRequestPrice: calculateInvestmentPrice
    })
  }
  return paymentMiddlewareInstance
}
