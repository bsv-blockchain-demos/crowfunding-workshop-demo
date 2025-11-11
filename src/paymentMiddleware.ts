import { Request, Response, NextFunction } from 'express'
import { AtomicBEEF, createNonce, Utils, verifyNonce, WalletInterface } from '@bsv/sdk'

export interface PaymentMiddlewareOptions {
  calculateRequestPrice?: (req: Request) => number | Promise<number>
  wallet: WalletInterface
}

export function createPaymentMiddleware(options: PaymentMiddlewareOptions) {
  const { calculateRequestPrice = () => 100, wallet } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.identityKey) {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_SERVER_MISCONFIGURED',
        description: 'Payment middleware must run after Auth middleware.'
      })
    }

    const requestPrice = await calculateRequestPrice(req)

    if (requestPrice === 0) {
      req.payment = { satoshisPaid: 0 }
      return next()
    }

    const bsvPaymentHeader = req.headers['x-bsv-payment']
    if (!bsvPaymentHeader) {
      const derivationPrefix = await createNonce(wallet)
      return res.status(402)
        .set({
          'x-bsv-payment-version': '1.0',
          'x-bsv-payment-satoshis-required': String(requestPrice),
          'x-bsv-payment-derivation-prefix': derivationPrefix
        })
        .json({
          status: 'error',
          code: 'ERR_PAYMENT_REQUIRED',
          satoshisRequired: requestPrice,
          description: 'BSV payment required. Provide X-BSV-Payment header.'
        })
    }

    const paymentData = JSON.parse(String(bsvPaymentHeader))
    const valid = await verifyNonce(paymentData.derivationPrefix, wallet)
    if (!valid) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_DERIVATION_PREFIX'
      })
    }

    const { accepted } = await wallet.internalizeAction({
      tx: Utils.toArray(paymentData.transaction, 'base64') as AtomicBEEF,
      outputs: [{
        paymentRemittance: {
          derivationPrefix: paymentData.derivationPrefix,
          derivationSuffix: paymentData.derivationSuffix,
          senderIdentityKey: req.auth.identityKey
        },
        outputIndex: 0,
        protocol: 'wallet payment'
      }],
      description: 'Payment for request'
    })

    req.payment = {
      satoshisPaid: requestPrice,
      accepted,
      tx: paymentData.transaction
    }

    res.set({ 'x-bsv-payment-satoshis-paid': String(requestPrice) })
    next()
  }
}
