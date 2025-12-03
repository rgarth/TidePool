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

// Build playlist description with contributors (max 250 chars)
// Excludes "Host" and the host's Tidal username (they own the playlist)
export function buildContributorDescription(participants: string[], hostName?: string): string {
  const MAX_LENGTH = 250;
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
  
  if (uniqueNames.length === 0) {
    return PREFIX;
  }
  
  // Try to fit all names
  let description = `${PREFIX} by ${uniqueNames.join(', ')}`;
  
  if (description.length <= MAX_LENGTH) {
    return description;
  }
  
  // Too long - progressively remove names and add "and others"
  for (let i = uniqueNames.length - 1; i >= 1; i--) {
    const included = uniqueNames.slice(0, i);
    description = `${PREFIX} by ${included.join(', ')} and others`;
    
    if (description.length <= MAX_LENGTH) {
      return description;
    }
  }
  
  // Fallback
  return `${PREFIX} by ${uniqueNames[0]} and others`;
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
    console.log(`>>> No matching tracks found to delete`);
    return { success: true };
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

// Get playlist track IDs
export async function getPlaylistTrackIds(accessToken: string, playlistId: string): Promise<string[]> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Playlist items error (${response.status}):`, error.substring(0, 500));
    // Throw specific error for 404 (playlist not found/deleted)
    if (response.status === 404 || response.status === 403) {
      throw new Error('PLAYLIST_NOT_FOUND');
    }
    throw new Error(`Failed to get playlist items: ${response.status}`);
  }

  const data = await response.json();
  return (data.data || []).map((item: any) => item.id);
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
      id: track.id?.toString() || nanoid(),
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

// Get full track details
export async function getTrackDetails(accessToken: string, trackIds: string[], countryCode: string): Promise<Track[]> {
  if (trackIds.length === 0) return [];
  
  const batchIds = trackIds.slice(0, 50).join(',');
  const url = `https://openapi.tidal.com/v2/tracks?countryCode=${countryCode}&filter[id]=${batchIds}&include=albums.coverArt,artists`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    console.error(`>>> Failed to fetch track details: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return parseTrackData(data, trackIds);
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

