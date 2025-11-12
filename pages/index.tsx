import { useState, useEffect } from 'react'
import { WalletClient, P2PKH, PublicKey, Utils, WalletProtocol } from '@bsv/sdk'
import styles from '../styles/Home.module.css'

const brc29ProtocolID: WalletProtocol = [2, '3241645161d8']

export default function Home() {
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [backendIdentityKey, setBackendIdentityKey] = useState<string | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [amount, setAmount] = useState(1000)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initWallet()
    loadStatus()
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  async function initWallet() {
    try {
      const w = new WalletClient('json-api', 'localhost')
      await w.connectToSubstrate()
      setWallet(w)

      const response = await fetch('/api/wallet-info')
      const data = await response.json()
      setBackendIdentityKey(data.identityKey)
      console.log('Wallet connected')
    } catch (error) {
      console.error('Wallet connection error:', error)
      showMessage('Please make sure BSV Desktop Wallet is running', 'error')
    }
  }

  async function loadStatus() {
    const response = await fetch('/api/status')
    const data = await response.json()
    setStatus(data)
  }

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
      // Use consistent derivation like setupWallet
      const derivationPrefix = Utils.toBase64(Utils.toArray('crowdfunding', 'utf8'))
      const derivationSuffix = Utils.toBase64(Utils.toArray('investment' + Date.now(), 'utf8'))

      const { publicKey: investorKey } = await wallet.getPublicKey({ identityKey: true })

      console.log('Creating payment:', {
        investorKey,
        backendIdentityKey,
        derivationPrefix,
        derivationSuffix
      })

      const { publicKey: derivedPublicKey } = await wallet.getPublicKey({
        counterparty: backendIdentityKey,
        protocolID: brc29ProtocolID,
        keyID: `${derivationPrefix} ${derivationSuffix}`,
        forSelf: false
      })

      const lockingScript = new P2PKH().lock(PublicKey.fromString(derivedPublicKey).toAddress()).toHex()

      const result = await wallet.createAction({
        outputs: [{
          lockingScript,
          satoshis: amount,
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

      const response = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Utils.toBase64(result.tx),
          investorKey,
          derivationPrefix,
          derivationSuffix
        })
      })

      const data = await response.json()

      if (response.ok) {
        showMessage(`Investment successful! ${data.amount} sats sent.`, 'success')
        await loadStatus()
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

  async function complete() {
    setLoading(true)

    try {
      const response = await fetch('/api/complete', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        showMessage(`Success! Tokens distributed to ${data.investorCount} investors. TX: ${data.txid}`, 'success')
        await loadStatus()
      } else {
        showMessage(data.error || 'Failed to complete', 'error')
      }
    } catch (error: any) {
      console.error('Complete error:', error)
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

  if (!status) return <div className={styles.container}>Loading...</div>

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>BSV Crowdfunding Demo</h1>
        <p className={styles.subtitle}>Pay with BSV Wallet and receive PushDrop tokens</p>

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
            onClick={complete}
            disabled={loading}
          >
            {loading ? 'Distributing...' : 'Complete & Distribute Tokens'}
          </button>
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
