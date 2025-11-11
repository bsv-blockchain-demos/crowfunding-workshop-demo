/**
 * Test Script for PushDrop Token Implementation
 *
 * This script tests the PushDrop token creation without broadcasting.
 * It verifies that tokens are created correctly and can be parsed.
 */

import {
  Transaction,
  PrivateKey,
  PublicKey,
  P2PKH
} from '@bsv/sdk';
import {
  createPushDropTokenScript,
  parsePushDropToken,
  type PushDropTokenData
} from './pushdrop-token.js';

/**
 * Test 1: Create a PushDrop token script
 */
function testCreateTokenScript() {
  console.log('\n=== Test 1: Create PushDrop Token Script ===');

  const investorPubKey = PrivateKey.fromRandom().toPublicKey();
  const investmentAmount = 50000n;
  const campaignId = 'test-campaign-001';

  const tokenData: PushDropTokenData = {
    protocolId: 'CROWDFUND',
    investmentAmount,
    investorPublicKey: investorPubKey,
    timestamp: Math.floor(Date.now() / 1000),
    campaignId
  };

  const tokenScript = createPushDropTokenScript(tokenData);

  console.log('Token Script Created:');
  console.log('  Hex:', tokenScript.toHex());
  console.log('  Length:', tokenScript.toBinary().length, 'bytes');
  console.log('  Chunks:', tokenScript.chunks.length);

  // Verify it starts with OP_FALSE OP_RETURN
  const chunks = tokenScript.chunks;
  console.log('  First chunk (OP_FALSE):', chunks[0].op === 0);
  console.log('  Second chunk (OP_RETURN):', chunks[1].op === 106);

  console.log('✅ Token script created successfully');
}

/**
 * Test 2: Parse a PushDrop token
 */
function testParseToken() {
  console.log('\n=== Test 2: Parse PushDrop Token ===');

  const investorPubKey = PrivateKey.fromRandom().toPublicKey();
  const investmentAmount = 75000n;
  const campaignId = 'test-campaign-002';
  const timestamp = Math.floor(Date.now() / 1000);

  // Create token
  const tokenData: PushDropTokenData = {
    protocolId: 'CROWDFUND',
    investmentAmount,
    investorPublicKey: investorPubKey,
    timestamp,
    campaignId
  };

  const tokenScript = createPushDropTokenScript(tokenData);

  // Parse it back
  const parsedData = parsePushDropToken(tokenScript);

  if (!parsedData) {
    console.error('❌ Failed to parse token');
    return;
  }

  console.log('Original Data:');
  console.log('  Amount:', investmentAmount.toString());
  console.log('  PubKey:', investorPubKey.toString().substring(0, 20) + '...');
  console.log('  Campaign:', campaignId);
  console.log('  Timestamp:', timestamp);

  console.log('\nParsed Data:');
  console.log('  Amount:', parsedData.investmentAmount.toString());
  console.log('  PubKey:', parsedData.investorPublicKey.toString().substring(0, 20) + '...');
  console.log('  Campaign:', parsedData.campaignId);
  console.log('  Timestamp:', parsedData.timestamp);

  // Verify match
  const amountMatch = parsedData.investmentAmount === investmentAmount;
  const pubKeyMatch = parsedData.investorPublicKey.toString() === investorPubKey.toString();
  const campaignMatch = parsedData.campaignId === campaignId;
  const timestampMatch = parsedData.timestamp === timestamp;

  console.log('\nVerification:');
  console.log('  Amount match:', amountMatch ? '✅' : '❌');
  console.log('  PubKey match:', pubKeyMatch ? '✅' : '❌');
  console.log('  Campaign match:', campaignMatch ? '✅' : '❌');
  console.log('  Timestamp match:', timestampMatch ? '✅' : '❌');

  if (amountMatch && pubKeyMatch && campaignMatch && timestampMatch) {
    console.log('\n✅ Token parsing successful');
  } else {
    console.log('\n❌ Token parsing failed');
  }
}

/**
 * Test 3: Create a complete transaction (without broadcasting)
 */
function testCreateTransaction() {
  console.log('\n=== Test 3: Create Complete Transaction ===');

  // Create test keys
  const fundingKey = PrivateKey.fromRandom();
  const investorPubKey = PrivateKey.fromRandom().toPublicKey();

  // Create a dummy funding transaction
  const fundingTx = new Transaction();
  fundingTx.addOutput({
    lockingScript: new P2PKH().lock(fundingKey.toPublicKey().toAddress()),
    satoshis: 100000 // 100,000 sats
  });

  // Create the token transaction
  const tx = new Transaction();

  tx.addInput({
    sourceTransaction: fundingTx,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(fundingKey)
  });

  // Add token output
  const tokenData: PushDropTokenData = {
    protocolId: 'CROWDFUND',
    investmentAmount: 50000n,
    investorPublicKey: investorPubKey,
    timestamp: Math.floor(Date.now() / 1000),
    campaignId: 'test-campaign-003'
  };

  tx.addOutput({
    lockingScript: createPushDropTokenScript(tokenData),
    satoshis: 0
  });

  // Add payment to investor
  tx.addOutput({
    lockingScript: new P2PKH().lock(investorPubKey.toAddress()),
    satoshis: 50000
  });

  // Add change
  tx.addOutput({
    lockingScript: new P2PKH().lock(fundingKey.toPublicKey().toAddress()),
    change: true
  });

  console.log('Transaction Structure:');
  console.log('  Inputs:', tx.inputs.length);
  console.log('  Outputs:', tx.outputs.length);
  console.log('    [0] Token (OP_RETURN):', tx.outputs[0].satoshis, 'sats');
  console.log('    [1] Payment to investor:', tx.outputs[1].satoshis, 'sats');
  console.log('    [2] Change:', tx.outputs[2].change ? 'YES' : 'NO');

  // Parse the token from output
  const parsedToken = parsePushDropToken(tx.outputs[0].lockingScript);
  if (parsedToken) {
    console.log('\nToken Data in Transaction:');
    console.log('  Protocol:', parsedToken.protocolId);
    console.log('  Amount:', parsedToken.investmentAmount.toString(), 'sats');
    console.log('  Campaign:', parsedToken.campaignId);
    console.log('✅ Token embedded in transaction successfully');
  } else {
    console.log('❌ Failed to parse token from transaction');
  }
}

/**
 * Test 4: Batch token creation
 */
function testBatchTokens() {
  console.log('\n=== Test 4: Batch Token Creation ===');

  const fundingKey = PrivateKey.fromRandom();

  // Create dummy funding tx
  const fundingTx = new Transaction();
  fundingTx.addOutput({
    lockingScript: new P2PKH().lock(fundingKey.toPublicKey().toAddress()),
    satoshis: 500000 // 500,000 sats
  });

  // Multiple investors
  const investors = [
    { pubKey: PrivateKey.fromRandom().toPublicKey(), amount: 10000n },
    { pubKey: PrivateKey.fromRandom().toPublicKey(), amount: 25000n },
    { pubKey: PrivateKey.fromRandom().toPublicKey(), amount: 50000n }
  ];

  // Create batch transaction
  const tx = new Transaction();

  tx.addInput({
    sourceTransaction: fundingTx,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(fundingKey)
  });

  // Add token for each investor
  const campaignId = 'batch-campaign-001';
  for (const investor of investors) {
    const tokenData: PushDropTokenData = {
      protocolId: 'CROWDFUND',
      investmentAmount: investor.amount,
      investorPublicKey: investor.pubKey,
      timestamp: Math.floor(Date.now() / 1000),
      campaignId
    };

    // Token output
    tx.addOutput({
      lockingScript: createPushDropTokenScript(tokenData),
      satoshis: 0
    });

    // Payment output
    tx.addOutput({
      lockingScript: new P2PKH().lock(investor.pubKey.toAddress()),
      satoshis: Number(investor.amount)
    });
  }

  // Change
  tx.addOutput({
    lockingScript: new P2PKH().lock(fundingKey.toPublicKey().toAddress()),
    change: true
  });

  console.log('Batch Transaction:');
  console.log('  Total investors:', investors.length);
  console.log('  Total outputs:', tx.outputs.length);
  console.log('  Token outputs:', investors.length);
  console.log('  Payment outputs:', investors.length);
  console.log('  Change output: 1');

  // Parse all tokens
  let tokenCount = 0;
  for (const output of tx.outputs) {
    const token = parsePushDropToken(output.lockingScript);
    if (token) {
      tokenCount++;
    }
  }

  console.log('  Parsed tokens:', tokenCount);
  console.log(tokenCount === investors.length ? '✅ Batch tokens created successfully' : '❌ Token count mismatch');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   PushDrop Token Implementation Tests     ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    testCreateTokenScript();
    testParseToken();
    testCreateTransaction();
    testBatchTokens();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║         All Tests Completed ✅             ║');
    console.log('╚════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
