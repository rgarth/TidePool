import { motion } from 'framer-motion';
import { Spinner } from './Spinner';
import type { SearchResult } from '../types';

interface SearchResultsProps {
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  addingTrackId: string | null;
  addError: string | null;
  onAddTrack: (track: SearchResult) => void;
  onClearSearch: () => void;
}

export function SearchResults({
  searchQuery,
  searchResults,
  isSearching,
  addingTrackId,
  addError,
  onAddTrack,
  onClearSearch,
}: SearchResultsProps) {
  if (searchQuery.trim().length < 2) {
    return null;
  }

  return (
    <>
      {/* Backdrop to close search */}
      <div onClick={onClearSearch} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
      
      <div style={{ position: 'relative', zIndex: 10, marginBottom: 'var(--space-lg)' }}>
        {isSearching ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
            <Spinner size={24} />
          </div>
        ) : searchResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
            No results for "{searchQuery}"
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {/* Error message */}
            {addError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: 'var(--space-md)',
                  background: 'rgba(255, 100, 100, 0.15)',
                  border: '1px solid rgba(255, 100, 100, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ff6b6b',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}
              >
                ❌ {addError}
              </motion.div>
            )}
            {searchResults.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
              >
                <img
                  src={track.albumArt}
                  alt={track.album}
                  style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.title}
                  </div>
                  <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                    {track.artist}
                  </div>
                </div>
                <button 
                  onClick={() => onAddTrack(track)} 
                  className="btn btn-primary btn-sm"
                  disabled={addingTrackId === track.id}
                  style={{ minWidth: '60px' }}
                >
                  {addingTrackId === track.id ? <Spinner size={16} /> : 'Add'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

