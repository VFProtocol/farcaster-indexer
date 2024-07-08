import got from 'got'

import { MERKLE_REQUEST_OPTIONS } from '../merkle.js'
import supabase from '../supabase.js'
import { Cast, FlattenedCast, MerkleResponse } from '../types/index'
import { breakIntoChunks } from '../utils.js'

/**
 * Index the casts from all Farcaster profiles and insert them into Supabase
 * @param limit The max number of recent casts to index
 */
export async function indexAllCasts(limit?: number, cursor?: string) : Promise<string | undefined> {
  const startTime = Date.now()
  console.log("Starting cast indexing")
  const allCasts = await getAllCasts(limit, cursor)
  const cleanedCasts = cleanCasts(allCasts.casts)

  const formattedCasts: FlattenedCast[] = cleanedCasts.map((c) => {
    var active = null
    if (c.author.activeOnFcNetwork && (c.parentAuthor == undefined || c.parentAuthor?.fid == undefined)) {
      active = "active"
    }

    // Filter out frames
    if (c.embeds?.urls) {
      if (c.embeds?.urls.length > 0) {
        if (c.embeds?.urls[0].openGraph) {
          if (c.embeds?.urls[0].openGraph.frame != undefined) {
            active = null
          }
        }
      }
    }

    if (c.author.followerCount == undefined) {
      active = null
    }
    const engagementScore = (c.replies.count * 4 + (c.quoteCount + c.recasts.count) * 2 + c.reactions.count) - ((c.author.followerCount / 60000) * 3) - ((c.author.followerCount / 20000) * 2) - (c.author.followerCount / 9000)
    const engagmenntScoreInt = Math.round(engagementScore * 10)
    var band = 0

    if (engagementScore < 0) {
      band = -1
    } else {
      while (true) {
        if (engagementScore < 5 ** band) {
          break
        }
        band++
      }
    }

    const cast: FlattenedCast = {
      hash: c.hash,
      thread_hash: c.threadHash,
      parent_hash: c.parentHash || null,
      author_fid: c.author.fid,
      author_username: c.author.username || null,
      author_display_name: c.author.displayName,
      author_pfp_url: c.author.pfp?.url || null,
      author_pfp_verified: c.author.pfp?.verified || false,
      text: c.text,
      published_at: new Date(c.timestamp),
      mentions: c.mentions || null,
      replies_count: c.replies.count,
      reactions_count: c.reactions.count,
      recasts_count: c.recasts.count,
      watches_count: c.watches.count,
      quote_count: c.quoteCount,
      parent_author_fid: c.parentAuthor?.fid || null,
      parent_author_username: c.parentAuthor?.username || null,
      embeds: c.embeds || null,
      tags: c.tags || null,
      deleted: false,
      engagement: engagementScore,
      author_active: active,
      follower_count: c.author.followerCount,
      engagement_band: band,
      engagement_int: engagmenntScoreInt
    }

    return cast
  })
  console.log("flattened chunks")
  // Break formattedCasts into chunks of 1000
  const chunks = breakIntoChunks(formattedCasts, 1000)
  console.log("Chunks: " + chunks.length)
  let chunkCount = chunks.length
  // Upsert each chunk into the Supabase table
  for (const chunk of chunks) {
    try {
      const { error } = await supabase.from('casts').upsert(chunk, {
        onConflict: 'hash',
      })
      chunkCount--
      if (error) {
        throw error
      }
      console.log("Chunk Left: " + chunkCount)
    } catch (error: any) {
      console.error("Error inserting chunk", error)
      if (error.code != '23503') {
        throw error
      }
    }
  }

  const endTime = Date.now()
  const duration = (endTime - startTime) / 1000

  // If it takes more than 60 seconds, log the duration so we can optimize
  console.log(`Updated ${formattedCasts.length} casts in ${duration} seconds`)
  console.log("Finished cast indexing, next cursor: " + allCasts.nextCursor)
  return allCasts.nextCursor
}

type CastResult = {
  casts: Cast[];
  nextCursor?: string;
};

/**
 * Get the latest casts from the Merkle API. 100k casts every ~35 seconds on local machine.
 * @param limit The maximum number of casts to return. If not provided, all casts will be returned.
 * @returns An array of all casts on Farcaster
 */
async function getAllCasts(limit?: number, startCursor?:string): Promise<CastResult> {
  const allCasts: Cast[] = new Array()
  let endpoint = buildCastEndpoint(startCursor)
  let loopCount = 0
  let lastCursor: string | undefined = ""

  while (true) {
    var cursor = undefined
    try {
      const _response = await got(endpoint, MERKLE_REQUEST_OPTIONS).json()
      const response = _response as MerkleResponse
      const casts = response.result.casts
      console.log("Loop count: " + loopCount + " Cast count: " + casts!.length)
      if (casts) {
        for (const cast of casts) {
          allCasts.push(cast)
        }
      }
      cursor = response.next?.cursor
      lastCursor = response.next?.cursor
    } catch (e:any) {
      console.log("found error")
    }
    // If limit is provided, stop when we reach it
    if (limit && allCasts.length >= limit) {
      break
    }
    // If there are more casts, get the next page

    if (cursor) {
      endpoint = buildCastEndpoint(cursor)
    } else {
      break
    }
    loopCount++
  }

  return { casts: allCasts, nextCursor: lastCursor}
}

/**
 * Helper function to build the profile endpoint with a cursor
 * @param cursor
 */
function buildCastEndpoint(cursor?: string): string {
  return `https://api.warpcast.com/v2/recent-casts?limit=1000${cursor ? `&cursor=${cursor}` : ''
    }`
}

function cleanCasts(casts: Cast[]): Cast[] {
  const cleanedCasts: Cast[] = new Array()

  for (const cast of casts) {
    // Remove recasts
    if (cast.text.startsWith('recast:farcaster://')) continue

    // TODO: find way to remove deleted casts

    // Remove some data from mentions
    if (cast.mentions) {
      cast.mentions = cast.mentions.map((m) => {
        return {
          fid: m.fid,
          username: m.username,
          displayName: m.displayName,
          pfp: m.pfp,
        }
      })
    }

    cleanedCasts.push(cast)
  }

  return cleanedCasts
}
