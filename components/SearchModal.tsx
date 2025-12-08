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

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      if (data.items) {
        setResults(data.items);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-surface w-full max-w-2xl rounded-2xl border border-primary/30 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fab fa-youtube text-red-500"></i> Search Video
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube..."
              className="flex-1 bg-dark border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary text-white"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary rounded-xl font-semibold text-white hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid gap-3 custom-scrollbar">
          {results.map((item) => (
            <div
              key={item.id.videoId}
              onClick={() => onSelect({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url
              })}
              className="flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-primary/30 transition-all group"
            >
              <img 
                src={item.snippet.thumbnails.medium.url} 
                alt={item.snippet.title} 
                className="w-32 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-100 line-clamp-2 mb-1 group-hover:text-primary-light transition-colors">
                    {item.snippet.title}
                </h4>
                <p className="text-xs text-gray-500">{item.snippet.channelTitle}</p>
              </div>
            </div>
          ))}
          {results.length === 0 && !loading && (
             <div className="text-center text-gray-600 py-10">
                Start typing to search for videos...
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;