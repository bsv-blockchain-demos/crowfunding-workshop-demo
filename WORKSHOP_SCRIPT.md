# BSV Blockchain Crowdfunding Workshop
## Building Real-World Payment Applications with BSV

**Duration:** 40 minutes
**Audience:** Developers familiar with JavaScript/TypeScript
**Prerequisites:** Basic understanding of blockchain concepts

---

## Workshop Outline (40 minutes)

1. **Introduction** (5 min)
2. **Technical Architecture Overview** (8 min)
3. **Live Demo Setup** (7 min)
4. **Code Walkthrough** (12 min)
5. **Live Testing** (5 min)
6. **Q&A** (3 min)

---

## 1. Introduction (5 minutes)

### Opening Statement

"Welcome everyone! Today we're going to build something practical with the BSV blockchain - a crowdfunding application that uses real micropayments and distributes tokens to investors.

Unlike traditional crowdfunding platforms that take days to process payments and charge 5-10% fees, this runs on BSV where transactions cost fractions of a cent and settle in seconds."

### What We'll Build

A crowdfunding proof-of-concept that demonstrates:
- **Peer-to-peer payments** using BSV wallet
- **BRC-29 protocol** for secure key derivation
- **PushDrop tokens** for investor receipts
- **Real-time transaction tracking**
- **Automated token distribution**

### Key Technologies

- **BSV SDK** - Transaction building and signing
- **BSV Wallet Toolbox** - Backend wallet management
- **Next.js** - Full-stack application framework
- **BSV Desktop Wallet** - User wallet (or compatible wallet)

---

## 2. Technical Architecture Overview (8 minutes)

### High-Level Flow

```
[Investor Wallet] → (Payment) → [Backend Wallet] → (Tracks Investment)
                                        ↓
                              [Goal Reached?]
                                        ↓
                              [Distribute PushDrop Tokens]
```

### Key Components

#### 1. Frontend (React/Next.js)
- Connects to user's BSV Desktop Wallet via JSON-API
- Creates payment transactions using BRC-29 key derivation
- Displays crowdfunding status in real-time

#### 2. Backend API (Next.js API Routes)
- `/api/wallet-info` - Returns backend wallet identity
- `/api/invest` - Accepts and internalizes payments
- `/api/status` - Returns crowdfunding progress
- `/api/complete` - Distributes tokens when goal reached

#### 3. Wallet Layer
- **Backend Wallet:** Server-side wallet that receives investments
- **Storage:** Uses Babbage Storage for wallet state
- **Persistence:** JSON file storage for crowdfunding state

### BRC-29 Protocol Explained

"BRC-29 is crucial here. It allows two parties to derive shared payment keys without revealing their private keys."

**The Process:**
1. Investor gets backend's identity key
2. Both parties derive a unique shared key using:
   - Protocol ID: `[2, '3241645161d8']`
   - Derivation prefix: `'crowdfunding'`
   - Derivation suffix: `'investment' + timestamp`
3. Payment locked to this derived key
4. Backend can unlock because it derived the same key

**Why this matters:**
- No address reuse
- Privacy preserved
- Payments are directly attributable
- Secure counterparty verification

### PushDrop Tokens

"PushDrop tokens are ultra-lightweight BSV tokens that cost just 1 satoshi to create."

**Structure:**
```
OP_FALSE OP_RETURN
<Protocol ID>
<Investor Public Key>
<Lock Type>
<Token Fields: amount, investorKey>
```

**Benefits:**
- Minimal transaction size
- Provable ownership
- Can represent any data
- Perfect for receipts/certificates

---

## 3. Live Demo Setup (7 minutes)

### Prerequisites Check

"Let's make sure everyone has what they need:"

1. **Node.js installed** (v18+)
   ```bash
   node --version
   ```

2. **BSV Desktop Wallet running**
   - Download from: https://chromewebstore.google.com/detail/bsv-wallet/ifucbdeohgfkopafjjhiakfafkjjfjnn
   - Or compatible wallet with JSON-API support

3. **Some testnet BSV** (optional - we'll use mainnet with tiny amounts)

### Initial Setup Steps

**Step 1: Clone and Install**
```bash
git clone <repo-url>
cd crowdfunding-workshop-demo
npm install
```

**Step 2: Setup Backend Wallet**
```bash
npm run setup
```

"This script does several things:"
- Creates a new private key (or uses existing)
- Initializes a backend wallet
- Funds it with 10,000 satoshis from your wallet
- Saves configuration to `.env`

**What happens behind the scenes:**
```typescript
// Creates new wallet if none exists
if (!existsSync('.env')) {
  const privateKey = PrivateKey.fromRandom()
  writeFileSync('.env', `PRIVATE_KEY=${privateKey.toHex()}`)
}

// Funds the wallet via BRC-29 payment
const transaction = await localWallet.createAction({
  outputs: [{
    lockingScript: derivedKey,
    satoshis: 10000
  }],
  options: { randomizeOutputs: false }
})

await backendWallet.internalizeAction({ tx, outputs })
```

**Step 3: Start the Application**
```bash
npm run dev
```

"Open http://localhost:3000 - you should see the crowdfunding interface."

---

## 4. Code Walkthrough (12 minutes)

### Part A: Investment Flow (5 minutes)

**Frontend - Creating a Payment (pages/index.tsx)**

"Let's walk through what happens when someone clicks 'Invest':"

```typescript
// 1. Get backend's identity
const response = await fetch('/api/wallet-info')
const { identityKey: backendIdentityKey } = await response.json()

// 2. Generate unique derivation keys
const derivationPrefix = Utils.toBase64(
  Utils.toArray('crowdfunding', 'utf8')
)
const derivationSuffix = Utils.toBase64(
  Utils.toArray('investment' + Date.now(), 'utf8')
)

// 3. Derive shared payment key
const { publicKey: derivedPublicKey } = await wallet.getPublicKey({
  counterparty: backendIdentityKey,
  protocolID: [2, '3241645161d8'],
  keyID: `${derivationPrefix} ${derivationSuffix}`,
  forSelf: false  // We're paying TO them
})

// 4. Create P2PKH locking script
const lockingScript = new P2PKH()
  .lock(PublicKey.fromString(derivedPublicKey).toAddress())
  .toHex()

// 5. Create transaction with randomizeOutputs: false
const result = await wallet.createAction({
  outputs: [{
    lockingScript,
    satoshis: amount,
    outputDescription: 'Crowdfunding investment'
  }],
  description: 'Investment in crowdfunding',
  options: {
    randomizeOutputs: false  // Critical! Keeps outputIndex predictable
  }
})
```

"Notice `randomizeOutputs: false` - this ensures our payment is at index 0, which the backend expects."

**Backend - Accepting Payment (pages/api/invest.ts)**

```typescript
// 1. Parse the BEEF transaction
const tx = Utils.toArray(transaction, 'base64')
const parsedTx = Transaction.fromBEEF(tx)
const actualAmount = parsedTx.outputs[0].satoshis

// 2. Internalize the payment
const result = await wallet.internalizeAction({
  tx,
  outputs: [{
    outputIndex: 0,  // We know it's at 0 because randomizeOutputs: false
    protocol: 'wallet payment',
    paymentRemittance: {
      derivationPrefix,
      derivationSuffix,
      senderIdentityKey: investorKey
    }
  }],
  description: 'Crowdfunding investment'
})

// 3. Record the investment
if (existingInvestor) {
  existingInvestor.amount += actualAmount
} else {
  crowdfunding.investors.push({
    identityKey: investorKey,
    amount: actualAmount,
    timestamp: Date.now()
  })
}

crowdfunding.raised += actualAmount

// 4. Persist state to disk
saveCrowdfundingData(identityKey.publicKey, crowdfunding)
```

### Part B: Token Distribution (7 minutes)

**Creating PushDrop Tokens (src/pushdrop.ts)**

"When the goal is reached, we create PushDrop tokens for each investor:"

```typescript
export async function createInvestorToken(
  wallet: Wallet,
  fields: InvestorTokenFields,
  counterparty: string
): Promise<LockingScript> {

  // 1. Get investor's public key
  const investorPubKey = PublicKey.fromString(fields.investorKey)

  // 2. Define token fields
  const tokenFields = [
    Utils.toArray(fields.amount.toString(), 'utf8'),
    investorPubKey.encode(true)
  ]

  // 3. Create PushDrop locking script
  const lockingScript = new PushDrop().lock(
    PROTOCOL_ADDRESS,      // Where tokens can be redeemed
    investorPubKey,        // Owner of the token
    tokenFields,           // Custom data fields
    counterparty           // For whom this token is created
  )

  return lockingScript
}
```

**Distributing Tokens (pages/api/complete.ts)**

```typescript
// 1. Create token outputs for each investor
const outputs = []
for (const investor of crowdfunding.investors) {
  const lockingScript = await createInvestorToken(
    wallet,
    {
      amount: investor.amount,
      investorKey: investor.identityKey
    },
    investor.identityKey
  )

  outputs.push({
    outputDescription: `Token for ${investor.identityKey.slice(0, 10)}...`,
    satoshis: 1,  // Tokens cost just 1 sat!
    lockingScript: lockingScript.toHex()
  })
}

// 2. Create transaction with all tokens
const result = await wallet.createAction({
  description: 'Distribute crowdfunding tokens to investors',
  outputs,
  options: {
    randomizeOutputs: false  // Keep output order predictable
  }
})

// 3. Mark as complete
crowdfunding.isComplete = true
saveCrowdfundingData(identityKey.publicKey, crowdfunding)
```

**Key Insights:**

"Notice a few critical things here:"

1. **Transaction Fees:** The backend needs extra satoshis beyond just the raised amount to pay for transaction fees when distributing tokens.

2. **Output Ordering:** We use `randomizeOutputs: false` everywhere to ensure outputs stay at predictable indices.

3. **State Persistence:** We save crowdfunding state to disk keyed by wallet identity, so it survives restarts.

4. **Token Cost:** Each PushDrop token costs just 1 satoshi - making them perfect for receipts and certificates.

---

## 5. Live Testing (5 minutes)

### Demo Flow

"Let's see this in action!"

**Step 1: Check Initial State**

Navigate to http://localhost:3000

Show the interface:
- Goal: 100 satoshis
- Raised: 0 satoshis
- Investors: 0

**Step 2: Make First Investment**

1. Enter amount: `50` satoshis
2. Click "Invest with BSV Wallet"
3. Approve in wallet popup

"Watch the status update in real-time!"

Show:
- Raised: 50 satoshis
- Investors: 1
- Progress bar: 50%

**Step 3: Reach the Goal**

1. Enter amount: `50` satoshis
2. Click "Invest" again
3. Approve transaction

Show:
- Raised: 100 satoshis
- Progress bar: 100%
- "Complete & Distribute Tokens" button appears

**Step 4: Distribute Tokens**

1. Click "Complete & Distribute Tokens"
2. Show console logs:
   ```
   Creating token for investor: 03b1b8a7dd...
   Created 1 PushDrop token outputs
   Tokens distributed! TXID: abc123...
   ```

3. Show WhatsOnChain link to transaction

**Step 5: Verify on Chain**

Open the transaction on WhatsOnChain:
- Show the PushDrop outputs
- Show the token data
- Explain how investors can redeem/verify their tokens

### Common Issues & Solutions

**Issue 1: "Insufficient funds"**

"The backend wallet needs more satoshis for fees."

Solution:
```bash
npm run setup  # Add more funds
```

**Issue 2: "Payment not accepted"**

"Key derivation mismatch. Make sure both sides use the same protocol ID and derivation parameters."

Check:
- Protocol ID matches: `[2, '3241645161d8']`
- Derivation prefix/suffix are consistent
- `forSelf: false` on investor side
- `forSelf: true` on backend side

**Issue 3: "Session not found"**

"Wallet authentication expired."

Solution:
- Refresh the page
- Reconnect to wallet

---

## 6. Q&A (3 minutes)

### Anticipated Questions

**Q: Why BSV instead of other blockchains?**

A: "Three key reasons:
1. **Transaction costs** - Fractions of a cent vs dollars
2. **Scalability** - Can handle thousands of transactions per second
3. **SPV** - Light clients can verify without downloading entire blockchain"

**Q: How do PushDrop tokens differ from NFTs?**

A: "PushDrop tokens are simpler and cheaper:
- No smart contract deployment
- Cost 1 satoshi vs hundreds of dollars
- Just Bitcoin Script + OP_RETURN
- Perfect for receipts, tickets, certificates"

**Q: Is this production-ready?**

A: "This is a PoC demonstrating the concepts. For production you'd want:
- Better error handling
- Database instead of JSON files
- Rate limiting and validation
- Token redemption mechanism
- Multi-signature for large funds
- Automated testing"

**Q: Can investors transfer their tokens?**

A: "Yes! PushDrop tokens can be:
- Transferred to others
- Redeemed for satoshis
- Verified cryptographically
- Used in other applications

You'd build a token transfer mechanism using the same BRC-29 patterns."

**Q: What about privacy?**

A: "BRC-29 provides transaction-level privacy:
- No address reuse
- Unique keys per transaction
- Counterparty verification
- Only parties involved can link transactions"

**Q: How does this scale to thousands of investors?**

A: "BSV can handle it:
- Unlimited block size
- Parallel transaction processing
- You could batch token distribution
- Or use merkle trees for efficient verification"

---

## Key Takeaways

"Let's recap what we've covered:"

### Technical Achievements

1. ✅ **Built a working payment application** using BSV blockchain
2. ✅ **Implemented BRC-29** for secure key derivation
3. ✅ **Created PushDrop tokens** for investor receipts
4. ✅ **Handled real micropayments** with sub-cent fees
5. ✅ **Demonstrated instant settlement** - seconds, not days

### BSV Advantages

- **Cost Effective:** Transactions cost < $0.0001
- **Fast:** Instant broadcasting, ~10 second settlement
- **Scalable:** Can handle enterprise transaction volumes
- **Developer Friendly:** JavaScript SDK, familiar patterns
- **Real Utility:** Actual micropayments, not just speculation

### Next Steps for Developers

1. **Experiment with the code:**
   - Fork the repository
   - Try different token types
   - Add redemption mechanisms
   - Build on these patterns

2. **Explore BSV capabilities:**
   - Read BSV documentation
   - Learn about SPV verification
   - Study BRC standards (29, 42, etc.)
   - Build your own applications

3. **Join the community:**
   - BSV Discord/Telegram
   - Developer forums
   - Share your projects
   - Contribute to open source tools

---

## Resources

### Documentation
- **BSV SDK:** https://docs.bsvblockchain.org/
- **Wallet Toolbox:** https://github.com/bitcoin-sv/ts-wallet-toolbox
- **BRC Standards:** https://brc.dev/

### Tools
- **BSV Desktop Wallet:** https://chromewebstore.google.com/detail/bsv-wallet/ifucbdeohgfkopafjjhiakfafkjjfjnn
- **WhatsOnChain Explorer:** https://whatsonchain.com/
- **BSV Testnet Faucet:** https://faucet.bitcoincloud.net/

### Community
- **BSV Discord:** [Link]
- **Developer Slack:** [Link]
- **GitHub:** https://github.com/bitcoin-sv

---

## Closing Statement

"Thank you all for joining this workshop!

We've built something real today - a crowdfunding application that uses actual micropayments on a scalable blockchain. This isn't vapor ware or speculation; it's working code running on a live network.

The patterns we've covered - BRC-29 key derivation, PushDrop tokens, wallet integration - these are foundational building blocks you can use to build real-world applications.

BSV is uniquely positioned to enable micropayment use cases that simply aren't economically viable on other blockchains. Whether you're building payment systems, data verification platforms, or novel token economies, the tools are here and they work.

I encourage you to take this code, break it, improve it, and build something new with it. The future of digital payments is programmable, peer-to-peer, and built on solid engineering principles.

Let's build the future together!"

---

## Workshop Checklist

### Pre-Workshop Setup (Do Before Starting)

- [ ] Test all code examples work
- [ ] Verify BSV Desktop Wallet is accessible
- [ ] Prepare WhatsOnChain transaction examples
- [ ] Load backend wallet with sufficient satoshis
- [ ] Test complete flow from investment to token distribution
- [ ] Prepare backup slides/screen recordings
- [ ] Have testnet BSV ready for distribution
- [ ] Set up development environment on presentation machine

### During Workshop

- [ ] Introduction and context (5 min)
- [ ] Architecture walkthrough with diagrams (8 min)
- [ ] Live setup demonstration (7 min)
- [ ] Code review with key highlights (12 min)
- [ ] Live testing with real transactions (5 min)
- [ ] Q&A session (3 min)

### Post-Workshop

- [ ] Share repository link
- [ ] Provide contact information
- [ ] Share additional resources
- [ ] Collect feedback
- [ ] Follow up with attendees

---

## Appendix: Troubleshooting Guide

### Setup Issues

**Problem:** `npm install` fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem:** BSV Desktop Wallet won't connect

**Solution:**
- Verify wallet is running
- Check console for connection errors
- Try restarting the wallet
- Ensure JSON-API is enabled in wallet settings

### Runtime Issues

**Problem:** Transactions fail with "insufficient funds"

**Solution:**
```bash
# Fund backend wallet with more satoshis
npm run setup
```

**Problem:** "Key derivation mismatch" errors

**Solution:**
- Verify protocol ID matches on both sides
- Check derivation prefix/suffix are encoded correctly
- Ensure `forSelf` parameter is correct (false for payer, true for payee)

**Problem:** State not persisting between restarts

**Solution:**
- Check `.crowdfunding_data` directory exists
- Verify file permissions
- Ensure wallet identity key is consistent

### Testing Issues

**Problem:** Need to reset crowdfunding state

**Solution:**
```bash
# Remove existing data
rm -rf .crowdfunding_data

# Restart server
npm run dev
```

**Problem:** Want to test with different wallet

**Solution:**
```bash
# Remove .env to create new backend wallet
rm .env

# Re-run setup
npm run setup
```

---

## Advanced Topics (Time Permitting)

### Token Redemption

"Here's how an investor could redeem their token:"

```typescript
async function redeemToken(tokenTxid: string, outputIndex: number) {
  // 1. Get the token UTXO
  const utxo = await wallet.listOutputs({
    basket: 'tokens',
    includeEnvelope: true
  })

  // 2. Create unlocking script
  const unlockingScript = new PushDrop().unlock(
    privateKey,
    counterparty,
    protocolID,
    keyID,
    fields
  )

  // 3. Spend the token
  const tx = await wallet.createAction({
    inputs: [{
      txid: tokenTxid,
      outputIndex,
      unlockingScript: unlockingScript.toHex()
    }],
    outputs: [{
      satoshis: 1,
      lockingScript: myAddress
    }]
  })

  return tx.txid
}
```

### Multi-Investor Batching

"For campaigns with many investors, batch token creation:"

```typescript
// Process investors in batches of 100
const BATCH_SIZE = 100

for (let i = 0; i < investors.length; i += BATCH_SIZE) {
  const batch = investors.slice(i, i + BATCH_SIZE)
  const outputs = batch.map(investor => createTokenOutput(investor))

  await wallet.createAction({
    description: `Token batch ${i / BATCH_SIZE + 1}`,
    outputs
  })

  // Small delay to avoid overwhelming the network
  await new Promise(resolve => setTimeout(resolve, 1000))
}
```

### SPV Verification

"Investors can verify their tokens using SPV:"

```typescript
import { MerkleProof } from '@bsv/sdk'

async function verifyToken(txid: string, merkleProof: string) {
  const proof = MerkleProof.fromHex(merkleProof)

  const isValid = proof.verify(txid)

  if (isValid) {
    console.log('Token is valid and confirmed on chain!')
  }

  return isValid
}
```

---

**End of Workshop Script**
