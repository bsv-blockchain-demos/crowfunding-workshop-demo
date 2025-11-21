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
  }, [wallet, identityKey])

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
    if (!wallet || !identityKey) {
      setError('Wallet not connected')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      // List outputs from the crowdfunding basket
      const outputs = await wallet.listOutputs({
        basket: 'crowdfunding',
        include: 'locking scripts'
      })

      console.log('Wallet outputs from crowdfunding basket:', outputs)

      const tokens: WalletToken[] = []

      for (const output of outputs.outputs) {
        try {
          if (!output.lockingScript) {
            console.log('Output has no locking script, skipping')
            continue
          }
          // Convert hex string to LockingScript and decode
          const script = LockingScript.fromHex(output.lockingScript)
          const decodedToken = PushDrop.decode(script)

          let decryptedData = ''
          if (decodedToken.fields && decodedToken.fields.length > 0) {
            try {
              // Try to decrypt the token data
              const { plaintext } = await wallet.decrypt({
                ciphertext: decodedToken.fields[0],
                protocolID: [0, 'token list'],
                keyID: '1',
                counterparty: 'self'
              })
              decryptedData = Utils.toUTF8(plaintext)
            } catch (decryptErr) {
              console.log('Could not decrypt token data:', decryptErr)
              decryptedData = '(encrypted)'
            }
          }

          const txid = output.outpoint.split('.')[0]

          // Only include tokens from the current campaign's completion transaction
          if (completionTxid && txid !== completionTxid) {
            console.log(`Skipping token from different campaign: ${txid}`)
            continue
          }

          tokens.push({
            txid,
            vout: parseInt(output.outpoint.split('.')[1]),
            satoshis: output.satoshis,
            lockingScript: output.lockingScript,
            decryptedData,
            outpoint: output.outpoint
          })
        } catch (decodeErr) {
          console.log('Could not decode as PushDrop:', decodeErr)
        }
      }

      setTokensData({
        identityKey,
        tokenCount: tokens.length,
        tokens
      })

      if (tokens.length === 0) {
        setError('No tokens found in your wallet. Complete a crowdfunding campaign to receive tokens.')
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
                <span>Your PushDrop Tokens:</span>
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
                    style={{
                      borderColor: '#10b981',
                      borderWidth: '3px'
                    }}
                  >
                    <div className={styles.tokenHeader}>
                      <div>
                        <span className={styles.tokenLabel}>
                          Token #{idx + 1}
                        </span>
                      </div>
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
                        <span className={styles.fieldLabel}>Output Index:</span>
                        <span>#{token.vout}</span>
                      </div>
                      {token.decryptedData && (
                        <div className={styles.tokenField} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span className={styles.fieldLabel}>Token Data:</span>
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
                <p>No tokens found in your wallet yet.</p>
                <p className={styles.subtitle}>Complete a crowdfunding campaign to receive tokens.</p>
              </div>
            )}

            <button
              className={styles.btnPrimary}
              onClick={loadTokens}
              disabled={loading || !wallet}
            >
              {loading ? 'Refreshing...' : 'Refresh Tokens'}
            </button>

            <div className={styles.statusCard} style={{ marginTop: '20px', background: '#d1fae5', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#065f46', fontWeight: 'bold' }}>
                How This Works
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#065f46' }}>
                <strong>Tokens are stored in your wallet's "crowdfunding" basket</strong>
                <br /><br />
                - When you claim tokens, they are internalized into your wallet
                <br />
                - Tokens use PushDrop locking scripts with encrypted data
                <br />
                - Your wallet can spend them because it controls the keys
                <br />
                - Token data is decrypted using your wallet's keys
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
