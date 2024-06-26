import got from 'got'

import { MERKLE_REQUEST_OPTIONS } from '../merkle.js'
import supabase from '../supabase.js'
import { FlattenedProfile, MerkleResponse, Profile } from '../types/index.js'
import { breakIntoChunks } from '../utils.js'

function getRank(text: string): number | null {
  if (text == null || text == "") {
    return null
  }

  if (text.includes("seemore.tv")) {
    return 1;
  } else if (["linktr.ee", "bio.link", "bio.site","msha.ke","beacons.ai","bento.me","nf.td","lnk.to","likeshop.me","github.io","komi.io","lnk.bio","linkin.bio","stan.store","withkoji.com","feedlink.io","taplink.cc"].some(domain => text.includes(domain))) {
    return 2;
  } else if ((/^https:\/\//).test(text)) {
    return 3;
  } else if ((/^http:\/\//).test(text)) {
    return 4;
  } else if ((/www\./).test(text)) {
    return 5;
  } else if ((/\b[a-z0-9.-]+\.[a-z]{2,}\/\S+/).test(text)) {
    return 6;
  } else if ((/\b[a-z0-9.-]+\.[a-z]{2,}\b/).test(text)) {
    return 7;
  }

  return null; 
}

/**
 * Reformat and upsert all profiles into the database
 */
export async function updateAllProfiles(limit?: number) {
  const startTime = Date.now()
  const allProfiles = await getAllProfiles(limit)

  const formattedProfiles: FlattenedProfile[] = allProfiles.map((p) => {
    return {
      id: p.fid,
      username: p.username || null,
      display_name: p.displayName || null,
      avatar_url: p.pfp?.url || null,
      avatar_verified: p.pfp?.verified || false,
      followers: p.followerCount || null,
      following: p.followingCount || null,
      bio: p.profile?.bio?.text || null,
      referrer: p?.referrerUsername || null,
      updated_at: new Date(),
      active_on_fc: p.activeOnFcNetwork || null,
      link_in_bio_status: getRank(p.profile?.bio?.text || "")
    }
  })

  // Upsert profiles in chunks to avoid locking the table
  const chunks = breakIntoChunks(formattedProfiles, 500)
  console.log("Chunks: " + chunks.length)
  let chunkCount = chunks.length
  for (const chunk of chunks) {
    const { error } = await supabase
      .from('profile')
      .upsert(chunk, { onConflict: 'id' })
    chunkCount--
    if (error) {
      console.log(chunk)
      // throw error
    }
    console.log("Chunk Left: " + chunkCount)
  }

  const endTime = Date.now()
  const duration = (endTime - startTime) / 1000

  // If it takes more than 60 seconds, log the duration so we can optimize
  console.log(`Updated ${allProfiles.length} profiles in ${duration} seconds`)
  
}

/**
 * Get all profiles from the Merkle API
 * @returns An array of all Farcaster profiles
 */
async function getAllProfiles(limit?: number): Promise<Profile[]> {
  const allProfiles: Profile[] = new Array()
  let endpoint = buildProfileEndpoint()
  let loopCount = 0
  while (true) {
    const _response = await got(endpoint, MERKLE_REQUEST_OPTIONS).json()
    const response = _response as MerkleResponse
    const profiles = response.result.users
    console.log("Loop count: " + loopCount + " Profile count: " + profiles!.length)

    if (!profiles) throw new Error('No profiles found')

    for (const profile of profiles) {
      allProfiles.push(profile)
    }

    if (limit && allProfiles.length >= limit) {
      break
    }

    // If there are more profiles, get the next page
    const cursor = response.next?.cursor
    if (cursor) {
      endpoint = buildProfileEndpoint(cursor)
    } else {
      break
    }
    loopCount++
  }

  // If there are missing ids (warpcast filtering), insert an empty profile
  const maxId = allProfiles[0].fid
  for (let i = 1; i <= maxId; i++) {
    console.log("Completion percentage: " + (i / maxId) * 100 + "%")
    if (!allProfiles.find((p) => p.fid === i)) {
      allProfiles.push({
        fid: i,
      })
    }
  }

  return allProfiles as Profile[]
}

/**
 * Helper function to build the profile endpoint with a cursor
 * @param cursor
 */
function buildProfileEndpoint(cursor?: string): string {
  return `https://api.warpcast.com/v2/recent-users?filter=off&limit=1000${cursor ? `&cursor=${cursor}` : ''
    }`
}
