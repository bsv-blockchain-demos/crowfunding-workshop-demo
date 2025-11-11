import { PushDrop, WalletInterface, LockingScript, WalletProtocol, SymmetricKey, Utils, Hash } from "@bsv/sdk"

const CROWDFUNDING_PROTOCOL: WalletProtocol = [0, 'crowdfunding']

export async function createInvestorToken(
  wallet: WalletInterface,
  investmentData: { amount: number, investorKey: string },
  receiverPubKey: string
): Promise<LockingScript> {
  const RECEIVER = receiverPubKey
  const forSelf = false

  // Encrypt the investment data
  const receiverBytes = Utils.toArray(RECEIVER, 'utf8')
  const keyBytes = Hash.sha256(receiverBytes)
  const key = new SymmetricKey(keyBytes)

  const jsonString = JSON.stringify(investmentData)
  const encryptedString = key.encrypt(jsonString) as number[]

  // Create PushDrop token
  const pushdrop = new PushDrop(wallet)
  const lockingScript = await pushdrop.lock(
    [encryptedString],
    CROWDFUNDING_PROTOCOL,
    "0",
    RECEIVER,
    forSelf,
    true,
    'after'
  )

  return lockingScript
}
