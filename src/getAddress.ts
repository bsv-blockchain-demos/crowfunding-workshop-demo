import { PublicKey } from "@bsv/sdk"
import * as dotenv from 'dotenv'
import { writeFileSync, existsSync } from 'fs'

let identityKey: string | undefined;

if (existsSync('.env')) {
    dotenv.config()
    identityKey = process.env.IDENTITY_KEY
    if (!identityKey) {
        console.error('La variable de entorno IDENTITY_KEY no está definida en .env')
        process.exit(1)
    }
} else {
    console.error('No se encontró el archivo .env')
    process.exit(1)
}
try {
  const publicKey = PublicKey.fromString(identityKey!);
  const address = publicKey.toAddress().toString();
  console.log('Dirección BSV:', address);
} catch (error) {
  if (error instanceof Error) {
    console.error('Error al procesar la identity key:', error.message);
  } else {
    console.error('Error al procesar la identity key:', String(error));
  }
}
