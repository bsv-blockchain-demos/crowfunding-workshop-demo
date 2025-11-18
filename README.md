# BSV Blockchain Crowdfunding Demo

A proof-of-concept crowdfunding application built on the BSV blockchain, demonstrating real micropayments, BRC-29 key derivation, and PushDrop token distribution.

## Features

- 💰 **Real BSV Payments** - Accept micropayments with sub-cent transaction fees
- 🔐 **BRC-29 Protocol** - Secure key derivation for privacy and security
- 🎫 **PushDrop Tokens** - Distribute investor tokens costing just 1 satoshi each
- 🔍 **Token Viewer** - View and verify PushDrop tokens from completion transactions
- ⚡ **Instant Settlement** - Transactions broadcast and confirmed in seconds
- 📊 **Real-time Tracking** - Live crowdfunding progress updates

## Architecture

### Components

- **Frontend (React/Next.js)** - User interface with BSV wallet integration
- **Backend API (Next.js API Routes)** - Payment processing and token distribution
- **BSV Wallet Toolbox** - Server-side wallet management
- **Persistent Storage** - JSON-based crowdfunding state

### Key Technologies

- [BSV SDK](https://docs.bsvblockchain.org/) - Transaction building and signing
- [BSV Wallet Toolbox](https://github.com/bsv-blockchain/wallet-toolbox) - Wallet management
- [Next.js](https://nextjs.org/) - Full-stack framework
- [BSV Desktop Wallet](https://chromewebstore.google.com/detail/bsv-wallet/ifucbdeohgfkopafjjhiakfafkjjfjnn) - User wallet

## Prerequisites

- Node.js v18 or higher
- BSV Desktop Wallet (or compatible wallet with JSON-API support)
- Some BSV satoshis for testing (10,000+ recommended)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Backend Wallet

This creates a backend wallet and funds it with 10,000 satoshis from your local wallet:

```bash
npm run setup
```

**What this does:**
- Creates a new private key (or uses existing from `.env`)
- Initializes a backend wallet using BSV Wallet Toolbox
- Connects to your BSV Desktop Wallet
- Sends 10,000 satoshis to the backend wallet via BRC-29 payment
- Saves wallet configuration to `.env`

### 3. Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Making an Investment

1. Enter investment amount in satoshis
2. Click "Invest with BSV Wallet"
3. Approve transaction in wallet popup
4. Watch your investment appear in real-time!

### Completing the Crowdfunding

Once the goal is reached:

1. "Complete & Distribute Tokens" button appears
2. Click to distribute PushDrop tokens to all investors
3. Each investor receives a token representing their investment
4. Transaction is broadcast to the BSV blockchain
5. Completion TXID is automatically saved for token viewing

### Viewing Your PushDrop Tokens

After campaign completion:

1. Click "View My PushDrop Tokens" on the main page
2. Connect your BSV wallet (if not already connected)
3. The system automatically:
   - Loads the completion transaction TXID
   - Fetches the transaction from WhatsOnChain
   - Identifies tokens locked to your public key
   - Displays token details with encrypted investment data
4. Tokens locked to your identity key show with a green border
5. Click transaction links to view on WhatsOnChain explorer

**Note:** PushDrop tokens use P2PK (Pay-to-Public-Key) locking scripts, which means they lock directly to your public key rather than a hash. This allows your wallet to spend them, but they cannot be found by searching for your address on block explorers.

## Project Structure

```
├── pages/
│   ├── index.tsx              # Main crowdfunding interface
│   ├── tokens.tsx             # PushDrop token viewer page
│   ├── _app.tsx               # Next.js app wrapper
│   └── api/
│       ├── wallet-info.ts     # Returns backend wallet identity
│       ├── invest.ts          # Accepts and processes investments
│       ├── status.ts          # Returns crowdfunding progress
│       ├── complete.ts        # Distributes tokens to investors
│       ├── balance.ts         # Returns backend wallet balance
│       ├── tokens.ts          # Legacy token fetching (deprecated)
│       └── my-tokens.ts       # Fetches tokens from completion TX
├── src/
│   ├── wallet.ts              # Backend wallet initialization
│   ├── pushdrop.ts            # PushDrop token creation
│   ├── setupWallet.ts         # Setup script for backend wallet
│   ├── types.ts               # TypeScript type definitions
│   └── findPushDropTokens.ts  # Token detection utilities
├── lib/
│   ├── crowdfunding.ts        # Crowdfunding state management
│   └── storage.ts             # Persistent JSON storage
├── public/
│   └── index.html             # Alternative vanilla JS frontend
└── styles/                    # CSS styling
```

## How It Works

### Investment Flow

1. **Frontend** connects to user's BSV Desktop Wallet
2. **User** enters investment amount
3. **BRC-29 Derivation** creates unique payment key:
   - Protocol ID: `[2, '3241645161d8']`
   - Derivation Prefix: `'crowdfunding'`
   - Derivation Suffix: `'investment' + timestamp`
4. **Transaction** created with `randomizeOutputs: false` for predictable output index
5. **Backend** internalizes payment using matching derivation parameters
6. **State** updated and persisted to disk

### Token Distribution Flow

1. **Check** if goal is reached and not already complete
2. **Create** PushDrop token for each investor:
   - Token contains investor's amount and identity key
   - Locked to investor's public key
   - Costs only 1 satoshi per token
3. **Broadcast** transaction with all token outputs
4. **Mark** crowdfunding as complete
5. **Save** final state to disk

## API Endpoints

### GET `/api/wallet-info`

Returns backend wallet's identity key.

**Response:**
```json
{
  "identityKey": "03ed2cab..."
}
```

### POST `/api/invest`

Accepts an investment payment.

**Request Body:**
```json
{
  "transaction": "base64-encoded-beef",
  "investorKey": "03b1b8a7...",
  "derivationPrefix": "Y3Jvd2RmdW5kaW5n",
  "derivationSuffix": "aW52ZXN0bWVudDE3NjI5NDI5NTc4NTg="
}
```

**Response:**
```json
{
  "success": true,
  "amount": 1000,
  "totalRaised": 1000,
  "message": "Investment received! Tokens will be distributed when goal is reached."
}
```

### GET `/api/status`

Returns current crowdfunding status.

**Response:**
```json
{
  "goal": 100,
  "raised": 50,
  "investorCount": 1,
  "isComplete": false,
  "percentFunded": 50,
  "investors": [
    {
      "identityKey": "03b1b8a7dd0231e0...",
      "amount": 50,
      "timestamp": 1762943257847
    }
  ]
}
```

### POST `/api/complete`

Distributes tokens when goal is reached.

**Response:**
```json
{
  "success": true,
  "message": "Tokens distributed to all investors!",
  "txid": "852ac41bd548e293...",
  "investorCount": 2
}
```

### GET `/api/my-tokens?identityKey={key}&completionTxid={txid}`

Fetches PushDrop tokens from the completion transaction for a specific investor.

**Query Parameters:**
- `identityKey` - Investor's public key (identity key)
- `completionTxid` - Transaction ID from campaign completion

**Response:**
```json
{
  "identityKey": "03b1b8a7...",
  "completionTxid": "852ac41b...",
  "tokenCount": 1,
  "allTokenCount": 2,
  "tokens": [
    {
      "txid": "852ac41b...",
      "vout": 0,
      "satoshis": 1,
      "publicKey": "03b1b8a7...",
      "encryptedData": "1e3def91...",
      "isPushDrop": true
    }
  ],
  "txLink": "https://whatsonchain.com/tx/852ac41b..."
}
```

## Configuration

### Environment Variables

Create a `.env` file (auto-generated by setup script):

```env
PRIVATE_KEY=your_backend_wallet_private_key_hex
STORAGE_URL=https://storage.babbage.systems
NETWORK=main
```

### Crowdfunding Parameters

Edit in `lib/crowdfunding.ts`:

```typescript
export let crowdfunding: CrowdfundingState = {
  goal: 100,           // Goal in satoshis
  raised: 0,           // Amount raised
  investors: [],       // Investor list
  isComplete: false,   // Completion status
  completionTxid: undefined // Transaction ID when completed
}
```

## Important Notes

### Transaction Fees

The backend wallet needs **extra satoshis** beyond the crowdfunding goal to pay for:
- Token distribution transaction fees
- Mining fees
- Script execution costs

**Recommendation:** Fund backend with at least 10,000 satoshis to ensure sufficient funds for token distribution.

### Output Randomization

Always use `randomizeOutputs: false` in `createAction` calls to ensure predictable output indices for `internalizeAction`.

```typescript
const result = await wallet.createAction({
  outputs: [...],
  options: {
    randomizeOutputs: false  // Critical!
  }
})
```

### State Persistence

Crowdfunding state is saved to `crowdfunding-data.json` file, keyed by backend wallet identity. This ensures:
- State survives server restarts
- Multiple wallets can run on same system
- Historical data is preserved
- Completion transaction TXID is saved for token viewing

**Important:** The `crowdfunding-data*.json` files are gitignored to prevent exposing campaign state.

## Troubleshooting

### "Insufficient funds" Error

**Problem:** Backend wallet doesn't have enough satoshis for transaction fees.

**Solution:**
```bash
npm run setup  # Add more funds
```

### "Payment not accepted" Error

**Problem:** Key derivation mismatch between frontend and backend.

**Solutions:**
- Verify protocol ID matches: `[2, '3241645161d8']`
- Check derivation parameters are identical
- Ensure `forSelf: false` on payer side, `forSelf: true` on payee side

### "Session not found" Error

**Problem:** Wallet authentication expired.

**Solution:**
- Refresh the page
- Reconnect to wallet
- Restart BSV Desktop Wallet

### Reset Crowdfunding State

```bash
# Remove existing data
rm crowdfunding-data.json

# Restart server
npm run dev
```

### Finding PushDrop Tokens

**Problem:** Cannot find PushDrop tokens by searching address on WhatsOnChain.

**Why:** PushDrop tokens use P2PK (Pay-to-Public-Key) locking scripts that lock directly to the raw public key, not a public key hash. This means they don't have a traditional "address" that can be searched.

**Solution:** Use the built-in token viewer at `/tokens` which:
1. Loads the completion transaction TXID from saved state
2. Fetches the transaction from WhatsOnChain API
3. Analyzes outputs to find tokens locked to your public key
4. Displays token details with verification

**Manual Verification:**
```bash
# View transaction on WhatsOnChain
https://whatsonchain.com/tx/{completion_txid}

# Look for outputs with:
# - Type: "nonstandard"
# - Value: 0.00000001 BTC (1 satoshi)
# - Script containing your public key + OP_CHECKSIG
```

## Development

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

## Resources

### Documentation
- [BSV SDK Documentation](https://docs.bsvblockchain.org/)
- [BSV Wallet Toolbox](https://github.com/bsv-blockchain/wallet-toolbox)
- [BRC Standards](https://brc.dev/)

### Tools
- [BSV Desktop Wallet](https://desktop.bsvb.tech/)
- [WhatsOnChain Explorer](https://whatsonchain.com/)

### Community
- [BSV Discord](https://discord.gg/bsv)
- [BSV GitHub](https://github.com/bsv-blockchain)
- [BSV GitHub Demos](https://github.com/bsv-blockchain-demos)

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

Built with the BSV blockchain ecosystem tools and libraries. Special thanks to the BSV development community for their excellent documentation and support.

---

**Note:** This is a proof-of-concept for educational purposes. For production use, add proper error handling, security measures, database storage, and comprehensive testing.
