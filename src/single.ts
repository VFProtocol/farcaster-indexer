import 'dotenv/config'
import { providers, Contract } from 'ethers'

import { idRegistryAddr, idRegistryAbi } from './contracts/id-registry.js'
import { indexAllCasts } from './functions/index-casts.js'
import { upsertRegistrations } from './functions/read-logs.js'
import { updateAllProfiles } from './functions/update-profiles.js'

// Set up the provider
const ALCHEMY_SECRET = process.env.ALCHEMY_SECRET
const provider = new providers.AlchemyProvider('optimism', ALCHEMY_SECRET)

// Create ID Registry contract interface
const idRegistry = new Contract(idRegistryAddr, idRegistryAbi, provider)

console.log('Starting Farcaster indexing...')
await upsertRegistrations(provider, idRegistry)
console.log('Finished indexing registrations')
await updateAllProfiles()
console.log('Finished updating profiles')
await indexAllCasts(100000000)
console.log('Finished indexing casts')