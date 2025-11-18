import { useState, useEffect } from 'react'
import Link from 'next/link'
import { WalletClient } from '@bsv/sdk'
import styles from '../styles/Home.module.css'

interface PushDropToken {
  txid: string
  vout: number
  satoshis: number
  scriptPubKey: string
  scriptAsm: string
  height?: number
  confirmations?: number
  time?: number
  address?: string
  type?: string
  isPushDrop: boolean
  publicKey?: string
  encryptedData?: string
}

interface TokensData {
  identityKey: string
  completionTxid: string
  tokenCount: number
  allTokenCount: number
  tokens: PushDropToken[]
  txLink: string
  address?: string
  totalUtxos?: number
  totalTransactions?: number
  warning?: string
}

export default function Tokens() {
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [identityKey, setIdentityKey] = useState<string | null>(null)
  const [completionTxid, setCompletionTxid] = useState<string | null>(null)
  const [tokensData, setTokensData] = useState<TokensData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    initWallet()
    loadCampaignStatus()
  }, [])

  useEffect(() => {
    if (identityKey) {
      if (completionTxid) {
        loadTokens()
      } else {
        // No completion TXID available yet
        setLoading(false)
        setError('Campaign not yet completed or completion TXID not saved. Complete a crowdfunding campaign to view tokens.')
      }
    }
  }, [identityKey, completionTxid])

  async function initWallet() {
    try {
      setLoading(true)
      const w = new WalletClient('json-api', 'localhost')
      await w.connectToSubstrate()
      setWallet(w)

      // Get the investor's identity key
      const { publicKey: investorKey } = await w.getPublicKey({ identityKey: true })
      setIdentityKey(investorKey)
      console.log('Investor Wallet connected, Identity Key:', investorKey)
    } catch (error) {
      console.error('Wallet connection error:', error)
      setError('Please make sure BSV Desktop Wallet is running')
      setLoading(false)
    }
  }

  async function loadCampaignStatus() {
    try {
      const response = await fetch('/api/status')
      if (response.ok) {
        const data = await response.json()
        console.log('Campaign status:', data)

        if (data.completionTxid) {
          setCompletionTxid(data.completionTxid)
          console.log('✅ Completion TXID loaded:', data.completionTxid)
        } else {
          console.log('⚠️ No completion TXID found in campaign status')
          if (data.isComplete) {
            console.log('Campaign is complete but TXID was not saved (completed before this feature was added)')
          } else {
            console.log('Campaign is not yet complete')
          }
        }
      }
    } catch (err) {
      console.error('Error loading campaign status:', err)
    }
  }

  async function loadTokens() {
    if (!identityKey) {
      setError('No identity key available')
      setLoading(false)
      return
    }

    if (!completionTxid) {
      setError('No completion transaction found. The campaign may not be completed yet.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/my-tokens?identityKey=${encodeURIComponent(identityKey)}&completionTxid=${encodeURIComponent(completionTxid)}`
      )
      const data = await response.json()

      if (response.ok) {
        setTokensData(data)
      } else {
        setError(data.error || 'Failed to load tokens')
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

  function formatDate(timestamp: number) {
    if (!timestamp) return 'Unknown'
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  function formatScript(scriptAsm: string) {
    if (!scriptAsm) return 'N/A'
    // Truncate long scripts
    if (scriptAsm.length > 100) {
      return scriptAsm.slice(0, 100) + '...'
    }
    return scriptAsm
  }

  const isWalletConnected = wallet && identityKey

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>PushDrop Tokens</h1>
            <p className={styles.subtitle}>View expedited push drop tokens received</p>
          </div>
          <Link href="/" className={styles.backLink}>
            ← Back to Crowdfunding
          </Link>
        </div>

        {!isWalletConnected ? (
          <div className={styles.statusCard}>
            <p style={{ marginBottom: '10px' }}>
              {loading ? 'Connecting to wallet...' : 'Wallet not connected'}
            </p>
            {error && <p style={{ color: '#991b1b', fontSize: '14px' }}>{error}</p>}
            {!loading && (
              <button className={styles.btnPrimary} onClick={initWallet}>
                Connect Wallet
              </button>
            )}
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
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#92400e' }}>
              <strong>To view PushDrop tokens:</strong>
              <br />
              1. Complete a crowdfunding campaign
              <br />
              2. The completion transaction TXID will be saved automatically
              <br />
              3. Tokens will appear here automatically
            </p>
            <Link href="/">
              <button className={styles.btnPrimary}>
                ← Go to Crowdfunding Page
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
                <span>Completion TX:</span>
                <a
                  href={tokensData.txLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txidLink}
                >
                  {formatTxid(tokensData.completionTxid)}
                </a>
              </div>
              <div className={styles.stat}>
                <span>Your PushDrop Tokens:</span>
                <span style={{ color: tokensData.tokenCount > 0 ? '#10b981' : '#991b1b', fontWeight: 'bold' }}>
                  {tokensData.tokenCount}
                </span>
              </div>
              <div className={styles.stat}>
                <span>Total Token Outputs:</span>
                <span>{tokensData.allTokenCount}</span>
              </div>
            </div>

            {tokensData.tokens.length > 0 ? (
              <div className={styles.investorList}>
                <h3>PushDrop Token Outputs ({tokensData.tokens.length})</h3>
                {tokensData.tokens.map((token, idx) => (
                  <div
                    key={idx}
                    className={styles.tokenItem}
                    style={{
                      borderColor: token.isPushDrop ? '#10b981' : '#f59e0b',
                      borderWidth: '3px'
                    }}
                  >
                    <div className={styles.tokenHeader}>
                      <div>
                        <span className={styles.tokenLabel}>
                          {token.isPushDrop ? '✅ Your Token' : '⚠️ Other Token'} (Output #{token.vout})
                        </span>
                      </div>
                      <span className={styles.tokenSats}>{token.satoshis} sats</span>
                    </div>
                    <div className={styles.tokenDetails}>
                      {token.publicKey && (
                        <div className={styles.tokenField} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span className={styles.fieldLabel}>Locked to Public Key:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#667eea', wordBreak: 'break-all', marginTop: '4px', fontWeight: 'bold' }}>
                            {token.publicKey}
                          </span>
                          {token.publicKey === identityKey && (
                            <span style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                              ✅ This matches YOUR identity key - you can spend this token!
                            </span>
                          )}
                        </div>
                      )}
                      {token.encryptedData && (
                        <div className={styles.tokenField} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span className={styles.fieldLabel}>Encrypted Token Data:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#666', wordBreak: 'break-all', marginTop: '4px' }}>
                            {token.encryptedData.slice(0, 100)}...
                          </span>
                        </div>
                      )}
                      <div className={styles.tokenField}>
                        <span className={styles.fieldLabel}>Output Index:</span>
                        <span>#{token.vout}</span>
                      </div>
                      {token.scriptAsm && (
                        <div className={styles.tokenField} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span className={styles.fieldLabel}>Full Script (ASM):</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#666', wordBreak: 'break-all', marginTop: '4px' }}>
                            {formatScript(token.scriptAsm)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.statusCard}>
                <p>No PushDrop tokens found in the completion transaction.</p>
                <p className={styles.subtitle}>This shouldn't happen if the campaign was completed successfully.</p>
              </div>
            )}

            <button
              className={styles.btnPrimary}
              onClick={loadTokens}
              disabled={loading || !identityKey}
            >
              {loading ? 'Refreshing...' : 'Refresh Tokens'}
            </button>

            <div className={styles.statusCard} style={{ marginTop: '20px', background: '#d1fae5', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#065f46', fontWeight: 'bold' }}>
                ✅ How This Works
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#065f46' }}>
                <strong>PushDrop tokens are found from the completion transaction!</strong>
                <br /><br />
                • When a campaign completes, 1-satoshi tokens are sent to each investor
                <br />
                • Tokens use <strong>P2PK</strong> (Pay-to-Public-Key) locking scripts
                <br />
                • Each token is locked to your <strong>public key</strong> (not a hash/address)
                <br />
                • Your wallet can spend them because it controls the private key
                <br />
                • Tokens contain <strong>encrypted investment data</strong>
                <br /><br />
                <strong>Green border = Your token</strong> (public key matches yours)
                <br />
                <strong>Orange border = Other investor's token</strong>
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
