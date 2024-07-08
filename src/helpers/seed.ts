import 'dotenv/config'
import { providers, Contract } from 'ethers'

import { indexVerifications } from '../functions/index-verifications.js'
import { idRegistryAddr, idRegistryAbi } from './../contracts/id-registry.js'
import { indexAllCasts } from './../functions/index-casts.js'
import { upsertRegistrations } from './../functions/read-logs.js'
import { updateAllProfiles } from './../functions/update-profiles.js'

// Set up the provider
const ALCHEMY_SECRET = process.env.ALCHEMY_SECRET
const provider = new providers.AlchemyProvider('optimism', ALCHEMY_SECRET)

// Create ID Registry contract interface
// const idRegistry = new Contract(idRegistryAddr, idRegistryAbi, provider)

console.log('Seeding recent registrations from contract logs...')
// await upsertRegistrations(provider, idRegistry)

console.log('Seeding recent registrations from contract logs...')
// await upsertRegistrations(provider, idRegistry)

console.log('Seeding profiles from Merkle APIs...')
// await updateAllProfiles()

console.log('Seeding casts from Merkle APIs...')
var cursor: string | undefined = undefined
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA5ODk1NTAzMDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA5ODkxNDI0MDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA5ODg3OTMyMDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA5MDU1NjMzMDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA3NzQxMTQyMDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNzA3NDg1MjMwMDAwfQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNjYzMDEzODc4Njg3fQ"
"eyJsaW1pdCI6MTAwMCwiYmVmb3JlIjoxNjYzMDEzODc4Njg3fQ"
while (true) {
  console.log("starting cast indexing with cursor: " + cursor)
  var newCursor: string| undefined = await indexAllCasts(50000, cursor)
  if (!newCursor) {
    console.log('No more casts to index')
    break;
  }
  cursor = newCursor
}

if (process.argv.includes('--verifications')) {
  console.log('Seeding verifications from Merkle APIs...')
  await indexVerifications()
}

console.log('Seeding complete!')
