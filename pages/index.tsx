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

      let response = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.status === 402) {
        const derivationPrefix = response.headers.get('x-bsv-payment-derivation-prefix')

        if (!derivationPrefix) {
          throw new Error('Missing payment derivation prefix from server')
        }

        const investmentAmount = amount
        const derivationSuffix = Utils.toBase64(Utils.toArray('investment' + Date.now(), 'utf8'))

        const { publicKey: derivedPublicKey } = await wallet.getPublicKey({
          counterparty: backendIdentityKey,
          protocolID: brc29ProtocolID,
          keyID: `${derivationPrefix} ${derivationSuffix}`,
          forSelf: false
        })

        const lockingScript = new P2PKH().lock(PublicKey.fromString(derivedPublicKey).toAddress()).toHex()

        showMessage(`Creating transaction for ${investmentAmount} sats...`, 'info')

        const result = await wallet.createAction({
          outputs: [{
            lockingScript,
            satoshis: investmentAmount,
            outputDescription: 'Crowdfunding investment'
          }],
          description: 'Investment in crowdfunding',
          options: { randomizeOutputs: false }
        })

        if (!result.tx) {
          throw new Error('Transaction creation failed')
        }

        const paymentHeader = JSON.stringify({
          derivationPrefix,
          derivationSuffix,
          transaction: Utils.toBase64(result.tx),
          senderIdentityKey: investorKey,
          amount: investmentAmount
        })

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
        showMessage(`Investment successful! ${data.amount} sats received.`, 'success')
        await getStatus()
      } else {
        showMessage(data.error || 'Investment failed', 'error')
      }
    } catch (error: any) {
      console.error('Investment error:', error)
      showMessage('Error: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function complete(retryCount = 0) {
    const maxRetries = 2
    setLoading(true)

    try {
      showMessage('Claiming token...', 'info')

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
        await wallet.internalizeAction({
          tx: data.tx,
          outputs: [
            {
              outputIndex: 0,
              protocol: 'basket insertion',
              insertionRemittance: { basket: 'crowdfunding' }
            }
          ],
          description: 'Internalize crowdfunding token'
        })

        showMessage(`Token claimed successfully! TXID: ${data.txid}`, 'success')
        await getStatus()
      } else {
        showMessage(data.error || 'Failed to complete', 'error')
      }
    } catch (error: any) {
      console.error('Complete error:', error)

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
                <span>{status.isComplete ? 'FUNDED' : 'Active'}</span>
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
                {loading ? 'Claiming...' : 'Claim Tokens'}
              </button>
            )}

            <Link href="/tokens">
              <button className={styles.btnPrimary} style={{ marginTop: '10px' }}>
                View My Tokens
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
