import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from '../styles/Home.module.css'
import { useWallet } from '../lib/wallet'
import { PushDrop, Utils, LockingScript } from '@bsv/sdk'

interface WalletToken {
  txid: string
  vout: number
  satoshis: number
  lockingScript: string
  decryptedData?: string
  outpoint: string
}

interface TokensData {
  identityKey: string
  tokenCount: number
  tokens: WalletToken[]
}

export default function Tokens() {
  const { wallet, identityKey } = useWallet()
  const [completionTxid, setCompletionTxid] = useState<string | null>(null)
  const [tokensData, setTokensData] = useState<TokensData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCampaignStatus()
  }, [])

  useEffect(() => {
    if (wallet && identityKey) {
      loadTokens()
    }
  }, [wallet, identityKey, completionTxid])

  async function loadCampaignStatus() {
    try {
      const response = await fetch('/api/status')
      if (response.ok) {
        const data = await response.json()
        if (data.completionTxid) {
          setCompletionTxid(data.completionTxid)
        }
      }
    } catch (err) {
      console.error('Error loading campaign status:', err)
    }
  }

  async function loadTokens() {
    if (!wallet || !identityKey) {
      setError('Wallet not connected')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const outputs = await wallet.listOutputs({
        basket: 'crowdfunding',
        include: 'locking scripts'
      })

      const tokens: WalletToken[] = []

      for (const output of outputs.outputs) {
        try {
          if (!output.lockingScript) continue

          const script = LockingScript.fromHex(output.lockingScript)
          const decodedToken = PushDrop.decode(script)

          let decryptedData = ''
          if (decodedToken.fields && decodedToken.fields.length > 0) {
            try {
              const { plaintext } = await wallet.decrypt({
                ciphertext: decodedToken.fields[0],
                protocolID: [0, 'token list'],
                keyID: '1',
                counterparty: 'self'
              })
              decryptedData = Utils.toUTF8(plaintext)
            } catch {
              decryptedData = '(encrypted)'
            }
          }

          const txid = output.outpoint.split('.')[0]

          if (completionTxid && txid !== completionTxid) continue

          tokens.push({
            txid,
            vout: parseInt(output.outpoint.split('.')[1]),
            satoshis: output.satoshis,
            lockingScript: output.lockingScript,
            decryptedData,
            outpoint: output.outpoint
          })
        } catch {
          // Skip non-PushDrop outputs
        }
      }

      setTokensData({
        identityKey,
        tokenCount: tokens.length,
        tokens
      })

      if (tokens.length === 0) {
        setError('No tokens found. Complete a crowdfunding campaign to receive tokens.')
      }
    } catch (err: any) {
      console.error('Error loading tokens:', err)
      setError('Error loading tokens: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatTxid(txid: string) {
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`
  }

  const isWalletConnected = wallet && identityKey

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>PushDrop Tokens</h1>
            <p className={styles.subtitle}>View your crowdfunding tokens</p>
          </div>
          <Link href="/" className={styles.backLink}>
            ← Back
          </Link>
        </div>

        {!isWalletConnected ? (
          <div className={styles.statusCard}>
            <p>{loading ? 'Connecting to wallet...' : 'Wallet not connected'}</p>
          </div>
        ) : loading ? (
          <div className={styles.statusCard}>
            <p>Loading tokens...</p>
          </div>
        ) : error ? (
          <div className={styles.statusCard} style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#92400e', fontWeight: 'bold' }}>
              {error}
            </p>
            <Link href="/">
              <button className={styles.btnPrimary}>
                ← Go to Crowdfunding
              </button>
            </Link>
          </div>
        ) : tokensData ? (
          <>
            <div className={styles.statusCard}>
              <div className={styles.stat}>
                <span>Identity Key:</span>
                <span className={styles.identityKey}>{formatTxid(tokensData.identityKey)}</span>
              </div>
              <div className={styles.stat}>
                <span>Your Tokens:</span>
                <span style={{ color: tokensData.tokenCount > 0 ? '#10b981' : '#991b1b', fontWeight: 'bold' }}>
                  {tokensData.tokenCount}
                </span>
              </div>
            </div>

            {tokensData.tokens.length > 0 ? (
              <div className={styles.investorList}>
                <h3>Your Tokens ({tokensData.tokens.length})</h3>
                {tokensData.tokens.map((token, idx) => (
                  <div
                    key={idx}
                    className={styles.tokenItem}
                    style={{ borderColor: '#10b981', borderWidth: '3px' }}
                  >
                    <div className={styles.tokenHeader}>
                      <span className={styles.tokenLabel}>Token #{idx + 1}</span>
                      <span className={styles.tokenSats}>{token.satoshis} sats</span>
                    </div>
                    <div className={styles.tokenDetails}>
                      <div className={styles.tokenField}>
                        <span className={styles.fieldLabel}>TXID:</span>
                        <a
                          href={`https://whatsonchain.com/tx/${token.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#667eea', fontFamily: 'monospace', fontSize: '11px' }}
                        >
                          {formatTxid(token.txid)}
                        </a>
                      </div>
                      <div className={styles.tokenField}>
                        <span className={styles.fieldLabel}>Output:</span>
                        <span>#{token.vout}</span>
                      </div>
                      {token.decryptedData && (
                        <div className={styles.tokenField} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span className={styles.fieldLabel}>Data:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#065f46', marginTop: '4px' }}>
                            {token.decryptedData}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.statusCard}>
                <p>No tokens found yet.</p>
              </div>
            )}

            <button
              className={styles.btnPrimary}
              onClick={loadTokens}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
