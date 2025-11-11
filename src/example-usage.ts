/**
 * Example Usage: Creating PushDrop Tokens for Crowdfunding Investors
 *
 * This demonstrates how to:
 * 1. Create a PushDrop token for an investor
 * 2. Send it to their identity key
 * 3. Broadcast the transaction
 */

import {
  Transaction,
  PrivateKey,
  PublicKey,
  P2PKH
} from '@bsv/sdk';
import {
  createInvestorToken,
  createTokenOnlyTransaction,
  parsePushDropToken,
  broadcastToken,
  createPushDropTokenScript
} from './pushdrop-token.js';

/**
 * Example 1: Create a single investor token with payment
 */
async function exampleCreateInvestorToken() {
  // Campaign owner's private key (controls funding)
  const campaignOwnerKey = PrivateKey.fromWif(
    'L5EY1SbTvvPNSdCYQe1EJHfXCBBT4PmnF6CDbzCm9iifZptUvDGB'
  );

  // Funding UTXO (this would come from your wallet)
  const fundingTxHex = '0100000001...'; // Replace with actual tx hex
  const fundingTx = Transaction.fromHex(fundingTxHex);
  const fundingOutputIndex = 0;

  // Investor's public key (their identity key)
  const investorPubKey = PublicKey.fromString(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  );

  // Investment amount
  const investmentAmount = 50000n; // 50,000 satoshis

  // Create token transaction
  const tokenTx = await createInvestorToken(
    campaignOwnerKey,
    fundingTx,
    fundingOutputIndex,
    investorPubKey,
    investmentAmount,
    'campaign-abc-123' // Campaign ID
  );

  console.log('Token Transaction ID:', tokenTx.id('hex'));
  console.log('Transaction Hex:', tokenTx.toHex());

  // Broadcast (optional - requires ARC credentials)
  // const txid = await broadcastToken(
  //   tokenTx,
  //   'https://api.taal.com/arc',
  //   'mainnet_your_api_key_here'
  // );
  // console.log('Broadcasted TXID:', txid);
}

/**
 * Example 2: Create token-only transaction (no payment)
 */
async function exampleCreateTokenOnly() {
  const campaignOwnerKey = PrivateKey.fromWif(
    'L5EY1SbTvvPNSdCYQe1EJHfXCBBT4PmnF6CDbzCm9iifZptUvDGB'
  );

  const fundingTx = Transaction.fromHex('0100000001...'); // Replace
  const fundingOutputIndex = 0;

  const investorPubKey = PublicKey.fromString(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  );

  // Create token without payment output
  const tokenTx = await createTokenOnlyTransaction(
    campaignOwnerKey,
    fundingTx,
    fundingOutputIndex,
    investorPubKey,
    75000n, // 75,000 satoshis invested
    'campaign-xyz-456'
  );

  console.log('Token-only Transaction:', tokenTx.toHex());
}

/**
 * Example 3: Batch create tokens for multiple investors
 */
async function exampleBatchCreateTokens() {
  const campaignOwnerKey = PrivateKey.fromRandom();

  // Multiple investors
  const investors = [
    { pubKey: PublicKey.fromString('02...'), amount: 10000n },
    { pubKey: PublicKey.fromString('03...'), amount: 25000n },
    { pubKey: PublicKey.fromString('02...'), amount: 50000n }
  ];

  // Create a single transaction with multiple token outputs
  const tx = new Transaction();

  // Add funding input
  const fundingTx = Transaction.fromHex('0100000001...'); // Replace
  tx.addInput({
    sourceTransaction: fundingTx,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(campaignOwnerKey)
  });

  // Add a token output for each investor
  const campaignId = 'campaign-batch-001';
  for (const investor of investors) {
    const tokenScript = createPushDropTokenScript({
      protocolId: 'CROWDFUND',
      investmentAmount: investor.amount,
      investorPublicKey: investor.pubKey,
      timestamp: Math.floor(Date.now() / 1000),
      campaignId
    });

    tx.addOutput({
      lockingScript: tokenScript,
      satoshis: 0
    });

    // Optionally add payment output for each investor
    tx.addOutput({
      lockingScript: new P2PKH().lock(investor.pubKey.toAddress()),
      satoshis: Number(investor.amount)
    });
  }

  // Add change output
  tx.addOutput({
    lockingScript: new P2PKH().lock(campaignOwnerKey.toPublicKey().toAddress()),
    change: true
  });

  await tx.fee();
  await tx.sign();

  console.log('Batch Token Transaction:', tx.toHex());
  console.log('Number of outputs:', tx.outputs.length);
}

/**
 * Example 4: Parse a token from a transaction
 */
async function exampleParseToken() {
  // Get a transaction containing a PushDrop token
  const txHex = '0100000001...'; // Replace with actual tx
  const tx = Transaction.fromHex(txHex);

  // Find the token output (OP_RETURN)
  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i];
    const tokenData = parsePushDropToken(output.lockingScript);

    if (tokenData) {
      console.log('Found PushDrop Token:');
      console.log('  Protocol:', tokenData.protocolId);
      console.log('  Investment:', tokenData.investmentAmount.toString(), 'satoshis');
      console.log('  Investor PubKey:', tokenData.investorPublicKey.toString());
      console.log('  Timestamp:', new Date(tokenData.timestamp * 1000).toISOString());
      console.log('  Campaign ID:', tokenData.campaignId);
    }
  }
}

/**
 * Example 5: Integration with Express endpoint
 */
export function createInvestorTokenEndpoint() {
  return async (req: any, res: any) => {
    try {
      const { investorPubKey, investmentAmount, campaignId } = req.body;

      // Validate inputs
      if (!investorPubKey || !investmentAmount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get campaign owner's key (from secure storage)
      const campaignOwnerKey = PrivateKey.fromWif(process.env.CAMPAIGN_OWNER_WIF!);

      // Get funding UTXO (from wallet or database)
      const fundingTx = await getFundingUtxo(); // Implement this
      const fundingOutputIndex = 0;

      // Parse investor's public key
      const investorPublicKey = PublicKey.fromString(investorPubKey);

      // Create token transaction
      const tokenTx = await createInvestorToken(
        campaignOwnerKey,
        fundingTx,
        fundingOutputIndex,
        investorPublicKey,
        BigInt(investmentAmount),
        campaignId
      );

      // Broadcast
      const txid = await broadcastToken(
        tokenTx,
        process.env.ARC_URL!,
        process.env.ARC_API_KEY!
      );

      res.json({
        success: true,
        txid,
        tokenData: {
          investorPubKey,
          investmentAmount,
          campaignId,
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
    } catch (error) {
      console.error('Error creating token:', error);
      res.status(500).json({ error: 'Failed to create investor token' });
    }
  };
}

// Placeholder for wallet integration
async function getFundingUtxo(): Promise<Transaction> {
  // This would integrate with your wallet to get a UTXO
  // For now, return a dummy transaction
  throw new Error('Implement getFundingUtxo with your wallet integration');
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running PushDrop Token Examples...\n');

  // Uncomment to run specific examples:
  // await exampleCreateInvestorToken();
  // await exampleCreateTokenOnly();
  // await exampleBatchCreateTokens();
  // await exampleParseToken();
}
