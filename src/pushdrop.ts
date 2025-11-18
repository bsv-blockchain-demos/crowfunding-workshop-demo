import { LockingScript, SymmetricKey, Utils, Hash, OP } from "@bsv/sdk"

export async function createInvestorToken(
  wallet: any, // Not used anymore - we build the script manually
  investmentData: { amount: number, investorKey: string },
  receiverPubKey: string
): Promise<LockingScript> {
  // Encrypt the investment data
  const receiverBytes = Utils.toArray(receiverPubKey, 'utf8')
  const keyBytes = Hash.sha256(receiverBytes)
  const key = new SymmetricKey(keyBytes)

  const jsonString = JSON.stringify(investmentData)
  const encryptedData = key.encrypt(jsonString) as number[]

  // Manually construct PushDrop locking script
  // Pattern: <encrypted_data> OP_DROP <investor_pubkey> OP_CHECKSIG

  const chunks = []

  // Push the encrypted data
  chunks.push({
    op: encryptedData.length,
    data: encryptedData
  })

  // Drop the data from the stack
  chunks.push({ op: OP.OP_DROP })

  // Push the investor's public key (this is what locks the token to them!)
  const pubKeyBytes = Utils.toArray(receiverPubKey, 'hex')
  chunks.push({
    op: pubKeyBytes.length,
    data: pubKeyBytes
  })

  // Add OP_CHECKSIG to require their signature to spend
  chunks.push({ op: OP.OP_CHECKSIG })

  console.log(`✅ Creating PushDrop token locked to: ${receiverPubKey}`)

  return new LockingScript(chunks)
}
