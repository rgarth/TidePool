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
      <div 
        onClick={onClearSearch} 
        style={{ position: 'fixed', inset: 0, zIndex: 5 }} 
      />
      
      <div className="mb-lg" style={{ position: 'relative', zIndex: 10 }}>
        {isSearching ? (
          <div className="empty-state py-lg">
            <Spinner size={24} />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="empty-state py-lg text-muted">
            No results for "{searchQuery}"
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {/* Error message */}
            {addError && (
              <motion.div
                className="card card-compact text-error text-sm text-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  background: 'rgba(255, 100, 100, 0.1)',
                  borderColor: 'rgba(255, 100, 100, 0.2)',
                }}
              >
                {addError}
              </motion.div>
            )}
            
            {searchResults.map((track) => (
              <motion.div
                key={track.id}
                className="search-result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <img
                  className="search-result-art"
                  src={track.albumArt}
                  alt={track.album}
                />
                <div className="search-result-info">
                  <div className="search-result-title truncate">{track.title}</div>
                  <div className="search-result-meta">{track.artist}</div>
                </div>
                <button 
                  className="btn btn-primary btn-sm flex-shrink-0"
                  onClick={() => onAddTrack(track)}
                  disabled={addingTrackId === track.id}
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
