import React, { useState } from 'react';
import { YOUTUBE_API_KEY } from '../services/firebase';
import { SearchResult } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (video: { id: string; title: string; thumbnail: string }) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Search is unavailable right now.');
      setResults(data.items || []);
    } catch (err) {
      console.error('Search failed', err);
      setError('Could not search videos. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <header className="search-header"><h2 id="search-title" className="search-heading">Find a video</h2><button className="search-close" onClick={onClose} aria-label="Close search"><i className="fas fa-xmark" /></button></header>
        <form onSubmit={handleSearch} className="search-form">
          <input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search YouTube videos" autoFocus aria-label="Search YouTube videos" />
          <button className="button button-primary search-submit" type="submit" disabled={loading || !query.trim()} aria-label="Search">{loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-magnifying-glass" />}</button>
        </form>
        <div className="search-results">
          {error && <p className="search-error" role="alert">{error}</p>}
          {results.map((item) => {
            const thumbnail = item.snippet.thumbnails.medium.url;
            return <button key={item.id.videoId} className="search-result" onClick={() => onSelect({ id: item.id.videoId, title: item.snippet.title, thumbnail })}>
              <img src={thumbnail} alt="" loading="lazy" />
              <span className="result-copy"><span className="result-title">{item.snippet.title}</span><span className="result-channel">{item.snippet.channelTitle}</span></span>
            </button>;
          })}
          {loading && <p className="search-hint">Searching videos…</p>}
          {!loading && !error && results.length === 0 && <p className="search-hint">Search for a title, episode, or creator to add a video to this room.</p>}
          {!loading && results.length > 0 && <p className="search-hint">Choose a result to share it with everyone in the room.</p>}
        </div>
      </section>
    </div>
  );
};

export default SearchModal;
