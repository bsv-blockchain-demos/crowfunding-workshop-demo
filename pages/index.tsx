'use client'
import { useState, useEffect } from 'react'
import { P2PKH, PublicKey, Utils, WalletProtocol, Random } from '@bsv/sdk'
import Link from 'next/link'
import styles from '../styles/Home.module.css'
import { useWallet } from '@/lib/wallet'

const brc29ProtocolID: WalletProtocol = [2, '3241645161d8']

export default function Home() {
  const { wallet } = useWallet()
  const [backendIdentityKey, setBackendIdentityKey] = useState<string | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [amount, setAmount] = useState(1000)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)

  async function getWalletInfo() {
    const response = await fetch('/api/wallet-info')
    const data = await response.json()
    setBackendIdentityKey(data.identityKey)
  }

  async function getStatus() {
    const response = await fetch('/api/status')
    const data = await response.json()
    setStatus(data)
  }

  useEffect(() => {
    getWalletInfo()
    getStatus()
  }, [])

  async function invest() {
    console.time('invest')
    if (!wallet || !backendIdentityKey) {
      showMessage('Wallet not connected', 'error')
      return
    }

    if (amount < 1) {
      showMessage('Please enter a valid amount', 'error')
      return
    }

    setLoading(true)

    try {
      showMessage('Preparing investment...', 'info')

      const { publicKey: investorKey } = await wallet.getPublicKey({ identityKey: true })

      console.log('Making initial request to /api/invest...')

      // Step 1: Make initial request (will receive 402 with derivation prefix)
      let response = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      // Step 2: If we get a 402, the middleware is asking for payment
      if (response.status === 402) {
        const derivationPrefix = response.headers.get('x-bsv-payment-derivation-prefix')
        const satoshisRequired = response.headers.get('x-bsv-payment-satoshis-required')

        console.log('402 Payment Required received:', {
          derivationPrefix,
          satoshisRequired,
          investorWantsToSend: amount
        })

        if (!derivationPrefix) {
          throw new Error('Missing payment derivation prefix from server')
        }

        // Use the user's chosen amount, not the server's minimum
        const investmentAmount = amount

        // Create derivation suffix
        const derivationSuffix = Utils.toBase64(Utils.toArray('investment' + Date.now(), 'utf8'))

        console.log('Creating payment transaction:', {
          investorKey,
          backendIdentityKey,
          derivationPrefix,
          derivationSuffix,
          amount: investmentAmount
        })

        // Derive the payment key using BRC-29
        const { publicKey: derivedPublicKey } = await wallet.getPublicKey({
          counterparty: backendIdentityKey,
          protocolID: brc29ProtocolID,
          keyID: `${derivationPrefix} ${derivationSuffix}`,
          forSelf: false
        })

        const lockingScript = new P2PKH().lock(PublicKey.fromString(derivedPublicKey).toAddress()).toHex()

        showMessage(`Creating transaction for ${investmentAmount} sats...`, 'info')

        // Create the payment transaction
        const result = await wallet.createAction({
          outputs: [{
            lockingScript,
            satoshis: investmentAmount,
            outputDescription: 'Crowdfunding investment'
          }],
          description: 'Investment in crowdfunding',
          options: {
            randomizeOutputs: false
          }
        })

        console.log('Transaction created:', result.txid)

        if (!result.tx) {
          throw new Error('Transaction creation failed')
        }

        // Step 3: Retry the request with payment header
        // The middleware expects transaction as base64
        const paymentHeader = JSON.stringify({
          derivationPrefix,
          derivationSuffix,
          transaction: Utils.toBase64(result.tx), // Must be base64-encoded
          senderIdentityKey: investorKey, // Include for crowdfunding tracking
          amount: investmentAmount // Include amount for price calculation
        })

        console.log('Retrying request with payment...')
        showMessage('Sending payment to blockchain...', 'info')

        response = await fetch('/api/invest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-bsv-payment': paymentHeader
          }
        })
      }

      const data = await response.json()

      if (response.ok) {
        showMessage(`✓ Investment successful! ${data.amount} sats received.`, 'success')
        await getStatus()
      } else {
        showMessage(data.error || 'Investment failed', 'error')
      }
    } catch (error: any) {
      console.error('Investment error:', error)
      showMessage('Error: ' + error.message, 'error')
    } finally {
      setLoading(false)
      console.timeEnd('invest')
    }
  }

  async function complete(retryCount = 0) {
    const maxRetries = 2
    setLoading(true)

    try {
      showMessage('Distributing PushDrop tokens...', 'info')

      if (!wallet) {
        showMessage('Wallet not connected', 'error')
        return
      }
      const { publicKey: investorKey } = await wallet.getPublicKey({ identityKey: true })

      const derivationPrefix = Utils.toBase64(Random(8))
      const derivationSuffix = Utils.toBase64(Random(8))

      const { publicKey: paymentKey } = await wallet.getPublicKey({
        protocolID: brc29ProtocolID,
        keyID: derivationPrefix + ' ' + derivationSuffix,
        counterparty: 'anyone',
        forSelf: false,
      })

      const response = await fetch('/api/complete', {
        method: 'POST',
        body: JSON.stringify({ identityKey: investorKey, paymentKey }),
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        // Only internalize if the API call was successful
        const internalizeResult = await wallet.internalizeAction({
          tx: data.tx,
          outputs: [
            {
              outputIndex: 0,
              protocol: 'basket insertion',
              insertionRemittance:{
                basket:'crowdfunding',
              }
            }
          ],
          description: 'internalize token'
        })

        console.log('Internalize result:', internalizeResult)

        showMessage(
          `Success! Tokens distributed to ${data.investorCount} investors.\n\n` +
          `⚠️ IMPORTANT - Save this TXID to find your tokens:\n${data.txid}\n\n` +
          `PushDrop tokens use P2PK and cannot be found by address.\n` +
          `View transaction: https://whatsonchain.com/tx/${data.txid}`,
          'success'
        )
        await getStatus()
      } else {
        showMessage(data.error || 'Failed to complete', 'error')
      }
    } catch (error: any) {
      console.error('Complete error:', error)

      // Retry on network or temporary errors
      if (retryCount < maxRetries) {
        showMessage(`Connection error, retrying... (${retryCount + 1}/${maxRetries})`, 'info')
        await new Promise(resolve => setTimeout(resolve, 2000))
        return complete(retryCount + 1)
      }

      showMessage('Error: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function showMessage(text: string, type: string) {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const isWalletConnected = !!wallet
  const isFullyLoaded = wallet && backendIdentityKey && status

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>BSV Crowdfunding Demo</h1>
            <p className={styles.subtitle}>Pay with BSV Wallet and receive PushDrop tokens</p>
          </div>
          <div className={styles.walletStatus}>
            {isWalletConnected ? (
              <div className={styles.statusBadge + ' ' + styles.connected}>
                <span className={styles.statusIcon}>✓</span>
                <span>Wallet Connected</span>
              </div>
            ) : (
              <button
                className={styles.statusBadge + ' ' + styles.disconnected + ' ' + styles.clickable}
                onClick={() => window.location.reload()}
                title="Click to connect wallet"
              >
                <span className={styles.statusIcon}>✕</span>
                <span>{loading ? 'Connecting...' : 'Click to Connect'}</span>
              </button>
            )}
          </div>
        </div>

        {isFullyLoaded && (
          <>
            <div className={styles.statusCard}>
              <div className={styles.stat}>
                <span>Goal:</span>
                <span>{status.goal} sats</span>
              </div>
              <div className={styles.stat}>
                <span>Raised:</span>
                <span>{status.raised} sats</span>
              </div>
              <div className={styles.stat}>
                <span>Investors:</span>
                <span>{status.investorCount}</span>
              </div>

              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${status.percentFunded}%` }}>
                  {status.percentFunded}%
                </div>
              </div>

              <div className={styles.stat}>
                <span>Status:</span>
                <span>{status.isComplete ? '✅ FUNDED' : 'Active'}</span>
              </div>

              {status.isComplete && status.completionTxid && (
                <div className={styles.stat} style={{ marginTop: '10px', padding: '10px', background: '#d1fae5', borderRadius: '8px' }}>
                  <span style={{ color: '#065f46', fontSize: '14px' }}>
                    <strong>Tokens Distributed!</strong>
                  </span>
                  <a
                    href={`https://whatsonchain.com/tx/${status.completionTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', fontSize: '12px', fontFamily: 'monospace', textDecoration: 'underline' }}
                  >
                    TX: {status.completionTxid.slice(0, 16)}...
                  </a>
                </div>
              )}
            </div>

            {status.investors && status.investors.length > 0 && (
              <div className={styles.investorList}>
                <h3>Investors</h3>
                {status.investors.map((inv: any, idx: number) => (
                  <div key={idx} className={styles.investorItem}>
                    <span className={styles.investorKey}>{inv.identityKey}</span>
                    <span className={styles.investorAmount}>{inv.amount} sats</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="amount">Investment Amount (satoshis)</label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value))}
                min="1"
                disabled={loading || status.isComplete}
              />
            </div>

            <button
              className={styles.btnPrimary}
              onClick={invest}
              disabled={loading || status.isComplete}
            >
              {loading ? 'Processing...' : 'Invest with BSV Wallet'}
            </button>

            {status.raised >= status.goal && !status.isComplete && (
              <button
                className={styles.btnSuccess}
                onClick={() => complete()}
                disabled={loading}
              >
                {loading ? 'Distributing...' : 'Claim Tokens'}
              </button>
            )}

            <Link href="/tokens">
              <button className={styles.btnPrimary} style={{ marginTop: '10px' }}>
                View My PushDrop Tokens
              </button>
            </Link>
          </>
        )}

        {message && (
          <div className={`${styles.message} ${styles[messageType]}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
