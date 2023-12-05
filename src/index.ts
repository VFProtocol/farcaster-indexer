import 'dotenv/config'
import { providers, Contract } from 'ethers'
import cron from 'node-cron'

import { idRegistryAddr, idRegistryAbi } from './contracts/id-registry.js'
import { IdRegistry, IdRegistryEvents } from './contracts/types/id-registry.js'
import { indexAllCasts } from './functions/index-casts.js'
import { indexVerifications } from './functions/index-verifications.js'
import { upsertRegistrations } from './functions/read-logs.js'
import { updateAllProfiles } from './functions/update-profiles.js'
import supabase from './supabase.js'
import { FlattenedProfile } from './types/index.js'

// Set up the provider
const ALCHEMY_SECRET = process.env.ALCHEMY_SECRET
const provider = new providers.AlchemyProvider('optimism', ALCHEMY_SECRET)

// Create ID Registry contract interface
const idRegistry = new Contract(
  idRegistryAddr,
  idRegistryAbi,
  provider
) as IdRegistry

// Listen for new events on the ID Registry
const eventToWatch: IdRegistryEvents = 'Register'
idRegistry.on(eventToWatch, async (to, id) => {
  console.log('New user registered.', Number(id), to)

  const profile: FlattenedProfile = {
    id: Number(id),
    owner: to,
    registered_at: new Date(),
  }

  // Save to supabase
  await supabase.from('profile').insert(profile)
})

// Make sure we didn't miss any profiles when the indexer was offline
await upsertRegistrations(provider, idRegistry)

// Run job every minute
cron.schedule('*/30 * * * *', async () => {
  try {
    await indexAllCasts(10_000)
  } catch (e) {
    console.error("Error indexing casts")
    console.error(e)
  }
  
  try {
    await updateAllProfiles()
  } catch (e) {
    console.error("Error indexing profiles")
    console.error(e)
  }
})

// Run job every hour
cron.schedule('0 * * * *', async () => {
  await indexVerifications()
})
