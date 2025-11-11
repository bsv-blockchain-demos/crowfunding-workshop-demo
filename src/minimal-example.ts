/**
 * MINIMAL EXAMPLE: Create a PushDrop token for a crowdfunding investor
 *
 * This is the absolute minimal code to create and send a PushDrop token.
 */

import {
  Transaction,
  PrivateKey,
  PublicKey,
  P2PKH,
  Script,
  OP
} from '@bsv/sdk';

// Step 1: Create the PushDrop token locking script
function createTokenScript(
  investmentAmount: bigint,
  investorPubKey: PublicKey,
  campaignId: string
) {
  // Convert amount to 8-byte buffer
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigInt64LE(investmentAmount);

  // Encode public key
  const pubKeyEncoded = investorPubKey.encode(true);
  const pubKeyBytes = typeof pubKeyEncoded === 'string'
    ? Array.from(Buffer.from(pubKeyEncoded, 'hex'))
    : pubKeyEncoded;

  // Build PushDrop script: OP_FALSE OP_RETURN <protocol> <amount> <pubkey> <timestamp> <campaign>
  return new Script()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    .writeBin(Array.from(Buffer.from('CROWDFUND')))           // Protocol ID
    .writeBin(Array.from(amountBuffer))                        // Investment amount
    .writeBin(pubKeyBytes)                                     // Investor public key (33 bytes)
    .writeBin(Array.from(Buffer.from(new Uint32Array([Math.floor(Date.now() / 1000)]).buffer))) // Timestamp
    .writeBin(Array.from(Buffer.from(campaignId)));            // Campaign ID
}

// Step 2: Create transaction with token
async function createToken(
  fundingKey: PrivateKey,
  fundingTx: Transaction,
  fundingOutputIdx: number,
  investorPubKey: PublicKey,
  investmentAmount: bigint,
  campaignId: string
): Promise<Transaction> {
  const tx = new Transaction();

  // Add input
  tx.addInput({
    sourceTransaction: fundingTx,
    sourceOutputIndex: fundingOutputIdx,
    unlockingScriptTemplate: new P2PKH().unlock(fundingKey)
  });

  // Add token output (OP_RETURN with 0 satoshis)
  tx.addOutput({
    lockingScript: createTokenScript(investmentAmount, investorPubKey, campaignId),
    satoshis: 0
  });

  // Add payment to investor
  tx.addOutput({
    lockingScript: new P2PKH().lock(investorPubKey.toAddress()),
    satoshis: Number(investmentAmount)
  });

  // Add change
  tx.addOutput({
    lockingScript: new P2PKH().lock(fundingKey.toPublicKey().toAddress()),
    change: true
  });

  // Sign and return
  await tx.fee();
  await tx.sign();

  return tx;
}

// Usage example
async function main() {
  // Your funding private key
  const fundingKey = PrivateKey.fromWif('L5EY1SbTvvPNSdCYQe1EJHfXCBBT4PmnF6CDbzCm9iifZptUvDGB');

  // Your funding UTXO
  const fundingTxHex = '0100000001...'; // Replace with actual transaction hex
  const fundingTx = Transaction.fromHex(fundingTxHex);
  const fundingOutputIdx = 0;

  // Investor's public key
  const investorPubKey = PublicKey.fromString(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  );

  // Create the token
  const tx = await createToken(
    fundingKey,
    fundingTx,
    fundingOutputIdx,
    investorPubKey,
    50000n, // 50,000 satoshis
    'campaign-001'
  );

  console.log('Transaction ID:', tx.id('hex'));
  console.log('Transaction Hex:', tx.toHex());

  // Broadcast with ARC
  // const arc = new ARC('https://api.taal.com/arc', { apiKey: 'your_key' });
  // await tx.broadcast(arc);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createToken, createTokenScript };
