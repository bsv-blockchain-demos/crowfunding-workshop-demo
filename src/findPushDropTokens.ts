import { PublicKey } from "@bsv/sdk"

/**
 * Find PushDrop tokens by searching for the investor's public key in transaction outputs
 *
 * NOTE: PushDrop tokens use P2PK (Pay-to-Public-Key), not P2PKH (Pay-to-Public-Key-Hash)
 * This means they DON'T appear at the address derived from the public key!
 *
 * P2PK script pattern: <data> OP_DROP ... <pubkey> OP_CHECKSIG
 * P2PKH script pattern: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
 */

export async function findPushDropTokensByPublicKey(
  publicKey: string,
  network: 'main' | 'test' = 'main'
): Promise<any[]> {
  console.log('Searching for PushDrop tokens for public key:', publicKey)

  // Unfortunately, WhatsOnChain API doesn't support searching by script content
  // We can only search by address, which won't work for P2PK outputs

  // Options to find P2PK PushDrop tokens:
  // 1. Track the completion transaction TXID when it's created
  // 2. Use a blockchain indexer that supports script pattern matching
  // 3. Scan all wallet transactions and check output scripts

  console.warn('⚠️  WhatsOnChain API cannot search for P2PK outputs by public key!')
  console.warn('⚠️  You need the TXID of the completion transaction to find your tokens')

  return []
}

/**
 * Check if a transaction output contains a PushDrop token for the given public key
 */
export function isPushDropToken(scriptAsm: string, scriptHex: string, publicKey: string): boolean {
  // PushDrop pattern: data pushes, followed by OP_DROP/OP_2DROP, then pubkey, then OP_CHECKSIG
  // The public key should appear in the script
  const pubKeyWithoutPrefix = publicKey.startsWith('02') || publicKey.startsWith('03')
    ? publicKey
    : publicKey

  // Check if script contains the public key and OP_CHECKSIG
  const containsPubKey = scriptHex.includes(pubKeyWithoutPrefix) || scriptAsm.includes(pubKeyWithoutPrefix)
  const hasCheckSig = scriptAsm.includes('OP_CHECKSIG')
  const hasDropOps = scriptAsm.includes('OP_DROP') || scriptAsm.includes('OP_2DROP')

  // PushDrop tokens have data drops before the public key check
  return containsPubKey && hasCheckSig && hasDropOps
}

/**
 * Get token details from a PushDrop locking script
 */
export function decodePushDropScript(scriptAsm: string): {
  isValid: boolean
  publicKey?: string
  dataFields?: string[]
} {
  try {
    // PushDrop scripts have data pushes, then OP_DROP/OP_2DROP, then pubkey, then OP_CHECKSIG
    const parts = scriptAsm.split(' ')

    const dataFields: string[] = []
    let publicKey: string | undefined

    // Find data before OP_DROP commands
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (part === 'OP_DROP' || part === 'OP_2DROP') {
        // Previous part was data
        continue
      } else if (part === 'OP_CHECKSIG') {
        // Previous part should be the public key
        if (i > 0) {
          publicKey = parts[i - 1]
        }
        break
      } else if (!part.startsWith('OP_')) {
        // This is data
        dataFields.push(part)
      }
    }

    return {
      isValid: !!publicKey,
      publicKey,
      dataFields
    }
  } catch (error) {
    return { isValid: false }
  }
}
