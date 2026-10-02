# BSV Crowdfunding Workshop Demo

A small Next.js application demonstrating BSV contributions and wallet-based redemption of PushDrop tokens. Participants contribute satoshis towards a campaign goal and, once the goal is reached, redeem a token describing their contribution.

The repository name is `crowfunding-workshop-demo`. It contains one demonstration campaign and a local JSON state file.

## Demonstration flow

1. Connect a compatible BRC-100 wallet in the browser.
2. Enter a contribution amount and approve the wallet payment.
3. The investment endpoint internalises the payment and updates the campaign total and investor record.
4. Once the goal is reached, each investor can redeem their own token. The server creates one 1-satoshi PushDrop output for that redemption and the browser imports it into the wallet.
5. The campaign becomes complete after every recorded investor has redeemed. The stored completion transaction ID is the final redemption's transaction ID.

The default goal is **100 satoshis**, configured in [lib/storage.ts](lib/storage.ts). Token outputs also require transaction fees. A submitted transaction is not a guarantee of immediate mining or confirmation.

## Requirements

- Node.js 22 and npm.
- A BRC-100 wallet supporting payments, transaction internalisation and the token protocol used here.
- A server private key, compatible Wallet Toolbox storage and a funded server wallet for redemptions.
- A writable working directory for `crowdfunding-data.json`.

## Local setup

```sh
git clone https://github.com/bsv-blockchain-demos/crowfunding-workshop-demo.git
cd crowfunding-workshop-demo
npm ci
cp .env.example .env
```

Configure the root `.env`:

```dotenv
PRIVATE_KEY=<your-hex-private-key>
STORAGE_URL=https://storage.babbage.systems
NETWORK=main
```

Keep the server wallet, client wallet and storage on the intended network. The runtime wallet defaults to mainnet and initialises remote storage when its module is loaded.

### Optional funding helper

```sh
npm run setup
```

Review [src/setupWallet.ts](src/setupWallet.ts) before using this command. It creates a server key if needed and requests a **1,000-satoshi mainnet transfer** from the local wallet through the JSON API. Its network and storage URL are constants in the script, and each run attempts another funding transfer. If it creates a key, it writes the root `.env` file. This is a funding operation, not a routine dependency-install step.

### Start the application

```sh
npm run dev
```

Open `http://localhost:3000`. The Next.js application provides the browser interface and the API routes used by it. The package also defines `npm run server`, but its target `src/server.ts` is absent from this checkout. Use the Next.js commands above.

## API and source guide

| Location | Purpose |
| --- | --- |
| [pages/index.tsx](pages/index.tsx) | Wallet connection, contribution and token-redemption interface. |
| [pages/api/](pages/api/) | Campaign status, investment and redemption handlers. |
| [lib/middleware.ts](lib/middleware.ts) | Authentication and payment middleware adapters. |
| [lib/storage.ts](lib/storage.ts) | Campaign defaults and JSON persistence. |
| [src/wallet.ts](src/wallet.ts) | Server wallet construction. |

`POST /api/invest` accepts a wallet payment. `POST /api/complete` redeems one investor's token; it does not distribute all investors' tokens in one transaction.

## Persistence and limitations

`crowdfunding-data.json` stores one campaign associated with the current server wallet identity. A different identity starts with fresh state rather than maintaining a separate history for each wallet. Back up this file together with the instance's configuration if you need to preserve a demonstration.

The current implementation uses synchronous file writes and has no coordination across server processes. Keep the demo to one instance. There is no implemented refund or deadline workflow.

The investment handler accepts an identity from the payment header, and the redemption handler accepts an `identityKey` in the request body without a separate ownership proof. The redemption request's `paymentKey` is required but is not used to build the token. Authentication and concurrent redemption handling need further work before accepting untrusted participants.

Token-description encryption uses the wallet's `anyone` counterparty. It should not be described as confidential investor data.

## Build and checks

```sh
npm run build
npm start
```

For TypeScript checking after installation:

```sh
npx tsc --noEmit
```

The package does not define `test` or `type-check` scripts. Live payment and redemption checks require the configured wallets and can spend BSV.

## Licence

See [LICENSE](LICENSE) for the MIT licence.
