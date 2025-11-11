/**
 * PushDrop Token Implementation for Crowdfunding Investors
 *
 * PushDrop is a token protocol that stores data in OP_RETURN outputs.
 * Format: OP_FALSE OP_RETURN <protocol_id> <data_fields>...
 *
 * For crowdfunding tokens:
 * - Protocol ID: "CROWDFUND" (identifies this as a crowdfunding token)
 * - Investment amount (in satoshis)
 * - Investor identity key
 * - Timestamp
 * - Campaign ID (optional)
 */

import {
  Transaction,
  PrivateKey,
  PublicKey,
  P2PKH,
  Script,
  OP,
  LockingScript,
  ARC
} from '@bsv/sdk';

/**
 * Interface for PushDrop token data
 */
export interface PushDropTokenData {
  protocolId: string;          // e.g., "CROWDFUND"
  investmentAmount: bigint;    // Amount invested in satoshis
  investorPublicKey: PublicKey; // Investor's identity key
  timestamp: number;           // Unix timestamp
  campaignId?: string;         // Optional campaign identifier
  metadata?: Record<string, string>; // Optional additional metadata
}

/**
 * Creates a PushDrop token locking script
 * Format: OP_FALSE OP_RETURN <protocol_id> <amount> <pubkey> <timestamp> [<campaign_id>]
 */
export function createPushDropTokenScript(data: PushDropTokenData): LockingScript {
  // Encode investor public key
  const pubKeyEncoded = data.investorPublicKey.encode(true);
  const pubKeyBytes = typeof pubKeyEncoded === 'string'
    ? Array.from(Buffer.from(pubKeyEncoded, 'hex'))
    : pubKeyEncoded;

  const script = new Script()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    // Protocol ID
    .writeBin(Array.from(Buffer.from(data.protocolId, 'utf8')))
    // Investment amount (8 bytes, little-endian)
    .writeBin(Array.from(bigIntToBuffer(data.investmentAmount)))
    // Investor public key (33 bytes compressed)
    .writeBin(pubKeyBytes)
    // Timestamp (4 bytes)
    .writeBin(Array.from(Buffer.from(new Uint32Array([data.timestamp]).buffer)));

  // Add optional campaign ID
  if (data.campaignId) {
    script.writeBin(Array.from(Buffer.from(data.campaignId, 'utf8')));
  }

  // Add optional metadata as JSON
  if (data.metadata) {
    script.writeBin(Array.from(Buffer.from(JSON.stringify(data.metadata), 'utf8')));
  }

  return script as LockingScript;
}

/**
 * Creates a transaction with a PushDrop token for an investor
 *
 * @param fundingPrivateKey - Private key controlling the funding UTXO
 * @param fundingUtxoTx - The transaction containing the funding UTXO
 * @param fundingUtxoIndex - The output index of the funding UTXO
 * @param investorPublicKey - The investor's public key (identity key)
 * @param investmentAmount - Amount invested in satoshis
 * @param campaignId - Optional campaign identifier
 * @param changeAddress - Optional change address (if not provided, uses funding key)
 * @returns Signed transaction ready for broadcast
 */
export async function createInvestorToken(
  fundingPrivateKey: PrivateKey,
  fundingUtxoTx: Transaction,
  fundingUtxoIndex: number,
  investorPublicKey: PublicKey,
  investmentAmount: bigint,
  campaignId?: string,
  changeAddress?: string
): Promise<Transaction> {
  const tx = new Transaction();

  // Add input from funding UTXO
  tx.addInput({
    sourceTransaction: fundingUtxoTx,
    sourceOutputIndex: fundingUtxoIndex,
    unlockingScriptTemplate: new P2PKH().unlock(fundingPrivateKey)
  });

  // Create PushDrop token data
  const tokenData: PushDropTokenData = {
    protocolId: 'CROWDFUND',
    investmentAmount,
    investorPublicKey,
    timestamp: Math.floor(Date.now() / 1000),
    campaignId
  };

  // Add PushDrop token output (OP_RETURN, 0 satoshis)
  tx.addOutput({
    lockingScript: createPushDropTokenScript(tokenData),
    satoshis: 0
  });

  // Add payment output to investor (optional - sends actual satoshis)
  // This allows the investor to claim their investment if needed
  const investorAddress = investorPublicKey.toAddress();
  tx.addOutput({
    lockingScript: new P2PKH().lock(investorAddress),
    satoshis: Number(investmentAmount)
  });

  // Add change output (never reuse addresses!)
  const changeAddr = changeAddress || fundingPrivateKey.toPublicKey().toAddress();
  tx.addOutput({
    lockingScript: new P2PKH().lock(changeAddr),
    change: true
  });

  // Calculate fee, sign, and return
  await tx.fee();
  await tx.sign();

  return tx;
}

/**
 * Simplified version - creates just the token output without payment
 * Useful when you're distributing tokens separately from payments
 */
export async function createTokenOnlyTransaction(
  fundingPrivateKey: PrivateKey,
  fundingUtxoTx: Transaction,
  fundingUtxoIndex: number,
  investorPublicKey: PublicKey,
  investmentAmount: bigint,
  campaignId?: string
): Promise<Transaction> {
  const tx = new Transaction();

  tx.addInput({
    sourceTransaction: fundingUtxoTx,
    sourceOutputIndex: fundingUtxoIndex,
    unlockingScriptTemplate: new P2PKH().unlock(fundingPrivateKey)
  });

  const tokenData: PushDropTokenData = {
    protocolId: 'CROWDFUND',
    investmentAmount,
    investorPublicKey,
    timestamp: Math.floor(Date.now() / 1000),
    campaignId
  };

  // PushDrop token output only
  tx.addOutput({
    lockingScript: createPushDropTokenScript(tokenData),
    satoshis: 0
  });

  // Change output
  tx.addOutput({
    lockingScript: new P2PKH().lock(fundingPrivateKey.toPublicKey().toAddress()),
    change: true
  });

  await tx.fee();
  await tx.sign();

  return tx;
}

/**
 * Parses a PushDrop token from a transaction output
 */
export function parsePushDropToken(lockingScript: LockingScript): PushDropTokenData | null {
  try {
    const chunks = lockingScript.chunks;

    // Verify OP_FALSE OP_RETURN prefix
    if (chunks.length < 5) return null;
    if (chunks[0].op !== OP.OP_FALSE) return null;
    if (chunks[1].op !== OP.OP_RETURN) return null;

    // Parse protocol ID
    const protocolId = Buffer.from(chunks[2].data || []).toString('utf8');
    if (protocolId !== 'CROWDFUND') return null;

    // Parse investment amount
    const investmentAmount = bufferToBigInt(Buffer.from(chunks[3].data || []));

    // Parse investor public key
    const investorPublicKey = PublicKey.fromString(
      Buffer.from(chunks[4].data || []).toString('hex')
    );

    // Parse timestamp
    const timestamp = chunks[5]?.data
      ? new Uint32Array(Buffer.from(chunks[5].data).buffer)[0]
      : 0;

    // Parse optional campaign ID
    const campaignId = chunks[6]?.data
      ? Buffer.from(chunks[6].data).toString('utf8')
      : undefined;

    // Parse optional metadata
    const metadata = chunks[7]?.data
      ? JSON.parse(Buffer.from(chunks[7].data).toString('utf8'))
      : undefined;

    return {
      protocolId,
      investmentAmount,
      investorPublicKey,
      timestamp,
      campaignId,
      metadata
    };
  } catch (error) {
    console.error('Error parsing PushDrop token:', error);
    return null;
  }
}

/**
 * Utility: Convert BigInt to Buffer (little-endian, 8 bytes)
 */
function bigIntToBuffer(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value);
  return buffer;
}

/**
 * Utility: Convert Buffer to BigInt (little-endian)
 */
function bufferToBigInt(buffer: Buffer): bigint {
  if (buffer.length === 0) return 0n;
  // Pad to 8 bytes if needed
  const padded = Buffer.alloc(8);
  buffer.copy(padded);
  return padded.readBigInt64LE();
}

/**
 * Broadcasts a transaction using ARC
 */
export async function broadcastToken(
  tx: Transaction,
  arcUrl: string,
  apiKey: string
): Promise<string> {
  const arc = new ARC(arcUrl, {
    apiKey,
    deploymentId: 'crowdfunding-demo-v1'
  });

  await tx.broadcast(arc);
  return tx.id('hex') as string;
}
