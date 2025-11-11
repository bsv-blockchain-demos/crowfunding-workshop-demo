# BSV Crowdfunding Demo

A minimal crowdfunding demo for BSV Code Workshop showcasing:
- BSV Desktop Wallet connection
- Certificate-based authentication
- Payment Express Middleware for accepting payments
- PushDrop token distribution to investors

## Architecture

### Backend (Express + BSV SDK + Wallet Toolbox)
- **Backend Wallet**: Dedicated wallet using @bsv/wallet-toolbox to receive and manage funds
- **Auth Middleware**: Connects with local BSV wallet using certificates
- **Payment Middleware**: Accepts BSV payments for investments
- **PushDrop Tokens**: Distributes encrypted tokens to investors with their investment data

### Frontend (HTML + BSV SDK)
- Clean, minimal interface
- Real-time crowdfunding status
- One-click investment with wallet
- Token distribution UI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure you have BSV Desktop Wallet running locally

3. Generate and fund the backend wallet:
```bash
npm run setup
```
This will:
- Create a new private key for the backend wallet
- Save it to `.env` file
- Fund the wallet with 100,000 satoshis from your local wallet
- Set up wallet storage

4. Run the development server:
```bash
npm run dev
```

5. Open browser to `http://localhost:3000`

## How It Works

1. **Investor connects wallet**: Frontend uses AuthFetch from @bsv/sdk
2. **Make investment**: User specifies amount, payment middleware processes BSV payment
3. **Track investments**: Server records each investor's identity key and amount
4. **Complete funding**: When goal is reached, anyone can trigger token distribution
5. **Distribute tokens**: PushDrop tokens are sent to each investor containing their investment data (encrypted)

## API Endpoints

### `GET /status`
Returns crowdfunding status (public)

### `POST /invest`
Accepts investment (requires auth + payment)
- Body: `{ amount: number }`
- Returns: Investment confirmation

### `POST /complete`
Completes crowdfunding and distributes tokens (requires auth)
- Only works when goal is reached
- Creates transaction with PushDrop outputs for each investor

## Demo Flow

1. Open the webpage
2. Click "Invest with BSV Wallet"
3. Wallet will prompt for authentication
4. Enter investment amount
5. Wallet processes payment
6. Investment is recorded
7. When goal is reached, click "Complete & Distribute Tokens"
8. All investors receive PushDrop tokens with their investment data

## Workshop Notes

This is a **minimal demo** focused on BSV SDK architecture:
- Simplified error handling
- In-memory state (no database)
- Single crowdfunding campaign
- Clean, readable code for learning

The reference folders (`brc-100-payments-master` and `payment-express-middleware-master`) are included for reference only and are not modified.
