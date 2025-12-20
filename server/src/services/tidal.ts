// Tidal API service functions
import { nanoid } from 'nanoid';
import { Track } from '../types/index.js';

// Search Tidal catalog
export async function searchTidal(accessToken: string, query: string, countryCode: string, limit = 20): Promise<any> {
  const searchUrl = `https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(query)}?countryCode=${countryCode}&include=tracks,artists,albums`;
  
  console.log(`>>> searchTidal() called for "${query}"`);
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  console.log(`>>> Response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Tidal search error (${response.status}):`, error.substring(0, 1000));
    throw new Error(`Tidal search failed: ${response.status} - ${error.substring(0, 200)}`);
  }

  const searchData = await response.json();
  
  // Get track IDs from the relationships
  const trackRefs = searchData.data?.relationships?.tracks?.data || [];
  console.log(`>>> Found ${trackRefs.length} track references`);
  
  if (trackRefs.length === 0) {
    return { tracks: [] };
  }
  
  // Fetch full track details
  const trackIds = trackRefs.slice(0, limit).map((t: any) => t.id).join(',');
  const tracksUrl = `https://openapi.tidal.com/v2/tracks?countryCode=${countryCode}&filter[id]=${trackIds}&include=albums.coverArt,artists`;
  
  const tracksResponse = await fetch(tracksUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  
  if (!tracksResponse.ok) {
    console.error(`>>> Failed to fetch track details: ${tracksResponse.status}`);
    return searchData;
  }
  
  return tracksResponse.json();
}

// Get user info
export async function getUserInfo(accessToken: string): Promise<any> {
  const url = 'https://api.tidal.com/v1/sessions';
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Get user info failed (${response.status}):`, error.substring(0, 500));
    return null;
  }
  
  return response.json();
}

// Create a new playlist
export async function createPlaylist(accessToken: string, name: string, description: string = ''): Promise<any> {
  const url = 'https://openapi.tidal.com/v2/playlists';
  
  console.log(`>>> Creating playlist: "${name}"`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        attributes: {
          name,
          description,
          accessType: 'PUBLIC',
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Create playlist error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to create playlist: ${response.status} - ${error.substring(0, 200)}`);
  }

  return response.json();
}

// Update playlist description
export async function updatePlaylistDescription(accessToken: string, playlistId: string, description: string): Promise<boolean> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        id: playlistId,
        attributes: {
          description,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`>>> Update playlist description error (${response.status})`);
    return false;
  }
  
  return true;
}

// Update playlist name and/or description
export async function updatePlaylist(
  accessToken: string, 
  playlistId: string, 
  updates: { name?: string; description?: string }
): Promise<boolean> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}`;
  
  const attributes: Record<string, string> = {};
  if (updates.name) attributes.name = updates.name;
  if (updates.description !== undefined) attributes.description = updates.description;
  
  if (Object.keys(attributes).length === 0) {
    return true; // Nothing to update
  }
  
  console.log(`>>> Updating playlist ${playlistId}:`, Object.keys(attributes));
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        id: playlistId,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Update playlist error (${response.status}):`, error.substring(0, 500));
    return false;
  }
  
  return true;
}

// Build playlist description with optional user description + contributors
// Total Tidal limit: 500 chars
// User description: max 300 chars
// By line gets remaining space (min 200 chars)
export function buildContributorDescription(
  participants: string[], 
  hostName?: string,
  userDescription?: string
): string {
  const TOTAL_LIMIT = 500;
  const MAX_USER_DESC = 300;
  const MIN_BYLINE = 200;
  
  // Sanitize and limit user description
  const cleanUserDesc = (userDescription || '').trim().slice(0, MAX_USER_DESC);
  
  // Calculate available space for by-line
  const byLineLimit = cleanUserDesc 
    ? Math.max(MIN_BYLINE, TOTAL_LIMIT - cleanUserDesc.length - 2) // -2 for "\n\n" separator
    : TOTAL_LIMIT;
  
  const PREFIX = 'Created with TidePool';
  
  // Get unique, non-empty names, excluding "Host" and the host's username
  const seen = new Set<string>();
  const hostLower = hostName?.toLowerCase().trim();
  
  const uniqueNames = participants.filter(name => {
    const lower = name.toLowerCase().trim();
    // Skip empty, "host", the host's username, and duplicates
    if (!lower || lower === 'host' || lower === hostLower || seen.has(lower)) {
      return false;
    }
    seen.add(lower);
    return true;
  });
  
  // Build the by-line
  let byLine = PREFIX;
  
  if (uniqueNames.length > 0) {
    // Try to fit all names
    byLine = `${PREFIX} by ${uniqueNames.join(', ')}`;
    
    if (byLine.length > byLineLimit) {
      // Too long - progressively remove names and add "and others"
      for (let i = uniqueNames.length - 1; i >= 1; i--) {
        const included = uniqueNames.slice(0, i);
        byLine = `${PREFIX} by ${included.join(', ')} and others`;
        
        if (byLine.length <= byLineLimit) {
          break;
        }
      }
      
      // Final fallback
      if (byLine.length > byLineLimit) {
        byLine = `${PREFIX} by ${uniqueNames[0]} and others`;
      }
    }
  }
  
  // Combine user description with by-line
  if (cleanUserDesc) {
    return `${cleanUserDesc}\n\n${byLine}`;
  }
  
  return byLine;
}

// Add tracks to a playlist
export async function addTracksToPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<any> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  console.log(`>>> Adding ${trackIds.length} tracks to playlist ${playlistId}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: trackIds.map(id => ({
        type: 'tracks',
        id,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Add tracks error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to add tracks: ${response.status} - ${error.substring(0, 200)}`);
  }

  // 201 and 204 can both have empty bodies
  const text = await response.text();
  if (!text) {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
}

// Remove tracks from a playlist
export async function removeTracksFromPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<any> {
  console.log(`>>> removeTracksFromPlaylist called:`, { playlistId, trackIds });
  
  const itemsUrl = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  // First, get the playlist items to find the itemId for each track
  const itemsResponse = await fetch(itemsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  
  if (!itemsResponse.ok) {
    const error = await itemsResponse.text();
    console.error(`>>> Get items error (${itemsResponse.status}):`, error.substring(0, 500));
    throw new Error(`Failed to get playlist items: ${itemsResponse.status}`);
  }
  
  const itemsData = await itemsResponse.json();
  const items = itemsData.data || [];
  
  console.log(`>>> Playlist has ${items.length} items. Sample IDs:`, items.slice(0, 5).map((i: any) => i.id));
  console.log(`>>> Looking for trackIds:`, trackIds);
  
  // Find the items that match our trackIds
  const itemsToDelete = items
    .filter((item: any) => trackIds.includes(item.id))
    .map((item: any) => ({
      type: 'tracks',
      id: item.id,
      meta: {
        itemId: item.meta?.itemId,
      },
    }));
  
  if (itemsToDelete.length === 0) {
    console.log(`>>> No matching tracks found to delete. trackIds types:`, trackIds.map(id => typeof id));
    console.log(`>>> Item IDs types:`, items.slice(0, 3).map((i: any) => ({ id: i.id, type: typeof i.id })));
    return { success: true, deleted: 0 };
  }
  
  console.log(`>>> Removing ${itemsToDelete.length} tracks from playlist ${playlistId}`);
  
  const response = await fetch(itemsUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: itemsToDelete,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Remove tracks error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to remove tracks: ${response.status} - ${error.substring(0, 200)}`);
  }

  return { success: true };
}

// Get playlist track IDs (with pagination)
const TIDAL_API_BASE = 'https://openapi.tidal.com/v2';

export async function getPlaylistTrackIds(accessToken: string, playlistId: string): Promise<string[]> {
  const allIds: string[] = [];
  let nextUrl: string | null = `${TIDAL_API_BASE}/playlists/${playlistId}/relationships/items?page[limit]=100`;
  let pageNum = 0;
  
  while (nextUrl) {
    pageNum++;
    console.log(`>>> Fetching playlist items page ${pageNum}...`);
    
    const response: Response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`>>> Playlist items error (${response.status}):`, error.substring(0, 500));
      if (response.status === 404 || response.status === 403) {
        throw new Error('PLAYLIST_NOT_FOUND');
      }
      throw new Error(`Failed to get playlist items: ${response.status}`);
    }

    const json: any = await response.json();
    const ids = (json.data || []).map((item: any) => item.id);
    allIds.push(...ids);
    console.log(`>>> Page ${pageNum}: got ${ids.length} IDs (total: ${allIds.length}), sample: ${ids.slice(0, 3).join(', ')}`);
    
    // Check for next page - Tidal returns relative URLs, need to make absolute
    const nextLink = json.links?.next;
    if (nextLink) {
      nextUrl = nextLink.startsWith('http') ? nextLink : `${TIDAL_API_BASE}${nextLink}`;
    } else {
      nextUrl = null;
    }
    
    // Safety: max 1000 tracks
    if (allIds.length >= 1000) {
      console.warn(`Playlist ${playlistId} has 1000+ tracks, truncating`);
      break;
    }
  }
  
  console.log(`>>> Total track IDs: ${allIds.length}`);
  return allIds;
}

// Parse ISO 8601 duration (PT3M20S) to seconds
function parseDuration(isoDuration: string): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Parse track data from JSON:API response
export function parseTrackData(data: any, orderedIds?: string[]): Track[] {
  const trackData = Array.isArray(data.data) ? data.data : [];
  const included = data.included || [];
  
  // Build maps for quick lookup
  const albumMap = new Map<string, any>();
  const artistMap = new Map<string, any>();
  const artworkMap = new Map<string, any>();
  
  included.forEach((item: any) => {
    if (item.type === 'albums') albumMap.set(item.id, item);
    if (item.type === 'artists') artistMap.set(item.id, item);
    if (item.type === 'artworks') artworkMap.set(item.id, item);
  });
  
  const trackMap = new Map<string, Track>();
  
  trackData.forEach((track: any) => {
    const attrs = track.attributes || {};
    const relationships = track.relationships || {};
    
    // Get album info
    const albumRef = relationships.albums?.data?.[0];
    const album = albumRef ? albumMap.get(albumRef.id) : null;
    const albumAttrs = album?.attributes || {};
    const albumRelationships = album?.relationships || {};
    
    // Get artist info
    const artistRefs = relationships.artists?.data || [];
    const artistNames = artistRefs.map((ref: any) => {
      const artist = artistMap.get(ref.id);
      return artist?.attributes?.name || 'Unknown';
    }).join(', ') || 'Unknown Artist';
    
    // Get album art
    let albumArt = '';
    const coverArtRef = albumRelationships.coverArt?.data?.[0];
    if (coverArtRef) {
      const artwork = artworkMap.get(coverArtRef.id);
      if (artwork?.attributes?.files) {
        const files = artwork.attributes.files;
        const img = files.find((f: any) => f.meta?.width === 320) ||
                    files.find((f: any) => f.meta?.width >= 160) ||
                    files[0];
        albumArt = img?.href || '';
      }
    }
    
    trackMap.set(track.id, {
      id: nanoid(), // Unique ID for each track instance (same song can appear multiple times)
      tidalId: track.id?.toString(),
      title: attrs.title || 'Unknown',
      artist: artistNames,
      album: albumAttrs.title || 'Unknown Album',
      duration: parseDuration(attrs.duration),
      albumArt,
      addedBy: 'Tidal',
    });
  });
  
  // Return in the order of the original IDs if provided
  if (orderedIds) {
    return orderedIds
      .map(id => trackMap.get(id))
      .filter((t): t is Track => t !== undefined);
  }
  
  return Array.from(trackMap.values());
}

// Get full track details (batched for large playlists)
export async function getTrackDetails(accessToken: string, trackIds: string[], countryCode: string): Promise<Track[]> {
  if (trackIds.length === 0) return [];
  
  console.log(`>>> Fetching details for ${trackIds.length} tracks`);
  const allTracks: Track[] = [];
  const BATCH_SIZE = 20; // Tidal API limit (max 20 IDs per request)
  
  // Process in batches of 20
  for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
    const batchIds = trackIds.slice(i, i + BATCH_SIZE);
    const url = `https://openapi.tidal.com/v2/tracks?countryCode=${countryCode}&filter[id]=${batchIds.join(',')}&include=albums.coverArt,artists`;
    
    try {
      console.log(`>>> Fetching batch ${i}: first few IDs: ${batchIds.slice(0, 3).join(', ')}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`>>> Failed to fetch track details batch ${i}-${i + BATCH_SIZE}: ${response.status}`, errorText.substring(0, 500));
        continue; // Skip failed batch, continue with others
      }

      const data = await response.json();
      const tracks = parseTrackData(data, batchIds);
      console.log(`>>> Batch ${i}-${i + batchIds.length}: got ${tracks.length} tracks`);
      allTracks.push(...tracks);
    } catch (err) {
      console.error(`>>> Error fetching batch ${i}-${i + BATCH_SIZE}:`, err);
      continue; // Skip failed batch
    }
  }
  
  console.log(`>>> Total tracks fetched: ${allTracks.length}`);
  
  // Return in original order, creating unique IDs for each position
  // (same song can appear multiple times in a playlist)
  const trackMap = new Map(allTracks.map(t => [t.tidalId, t]));
  return trackIds
    .map(id => {
      const track = trackMap.get(id);
      if (!track) return undefined;
      // Create a new track instance with unique ID for each playlist position
      return { ...track, id: nanoid() };
    })
    .filter((t): t is Track => t !== undefined);
}

// Get playlist info
export async function getPlaylistInfo(accessToken: string, playlistId: string): Promise<{ name: string; description?: string; privacy?: string } | null> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  
  if (!response.ok) {
    console.error(`Failed to get playlist info: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  // Tidal uses 'accessType' not 'privacy' for the visibility attribute
  const accessType = data.data?.attributes?.accessType;
  console.log(`>>> Playlist "${data.data?.attributes?.name}" accessType: ${accessType}`);
  return {
    name: data.data?.attributes?.name || 'Untitled Playlist',
    description: data.data?.attributes?.description,
    privacy: accessType, // Map accessType to our privacy field
  };
}

// Get full playlist with track details
export async function getPlaylistWithFullTracks(accessToken: string, playlistId: string, countryCode: string): Promise<Track[]> {
  const trackIds = await getPlaylistTrackIds(accessToken, playlistId);
  console.log(`>>> Playlist has ${trackIds.length} tracks`);
  
  if (trackIds.length === 0) return [];
  
  return getTrackDetails(accessToken, trackIds, countryCode);
}

