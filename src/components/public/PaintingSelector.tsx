import { useState, useMemo } from 'react';
import { X, Search, Clock, Paintbrush } from 'lucide-react';
import { usePaintableImages } from '../../hooks/usePrivateEventRequests';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { GalleryImage } from '../../types/database';

type PaintingWithGallery = GalleryImage & { gallery?: { name: string } };

interface PaintingSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (painting: PaintingWithGallery) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  beginner: { label: 'Beginner', bg: 'bg-green-100', text: 'text-green-700' },
  intermediate: { label: 'Intermediate', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  advanced: { label: 'Advanced', bg: 'bg-red-100', text: 'text-red-700' },
};

const DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced'];

export function PaintingSelector({ open, onClose, onSelect }: PaintingSelectorProps) {
  const { data: paintableImages, isLoading } = usePaintableImages();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!paintableImages) return [];
    const q = search.toLowerCase().trim();
    if (!q) return paintableImages as PaintingWithGallery[];
    return (paintableImages as PaintingWithGallery[]).filter((img) =>
      (img.caption || '').toLowerCase().includes(q)
    );
  }, [paintableImages, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, PaintingWithGallery[]> = {};
    for (const img of filtered) {
      const key = img.difficulty || 'unspecified';
      if (!groups[key]) groups[key] = [];
      groups[key].push(img);
    }
    return groups;
  }, [filtered]);

  const handleSelect = (painting: PaintingWithGallery) => {
    onSelect(painting);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: '#ffffff' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottomWidth: '1px', borderColor: '#e5e7eb' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Choose a Painting</h2>
            <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Browse our gallery and pick your favorite</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#6b7280' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3" style={{ borderBottomWidth: '1px', borderColor: '#f3f4f6' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search paintings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb', color: '#111827' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Paintbrush className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No paintings found{search ? ' matching your search' : ''}.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {DIFFICULTY_ORDER.filter((d) => grouped[d]?.length).map((difficulty) => (
                <div key={difficulty}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
                    {DIFFICULTY_CONFIG[difficulty]?.label || difficulty}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {grouped[difficulty].map((img) => {
                      const cfg = DIFFICULTY_CONFIG[difficulty];
                      return (
                        <button
                          key={img.id}
                          onClick={() => handleSelect(img)}
                          className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-primary-400 hover:shadow-lg transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                          style={{ backgroundColor: '#ffffff' }}
                        >
                          <div className="aspect-square bg-gray-100 overflow-hidden">
                            {img.url ? (
                              <img
                                src={img.url}
                                alt={img.caption || 'Painting'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Paintbrush className="h-10 w-10 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                              {img.caption || 'Untitled'}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {cfg && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                  {cfg.label}
                                </span>
                              )}
                              {img.estimated_time_minutes && (
                                <span className="text-xs flex items-center gap-1" style={{ color: '#9ca3af' }}>
                                  <Clock className="h-3 w-3" />
                                  {img.estimated_time_minutes} min
                                </span>
                              )}
                            </div>
                            {img.gallery?.name && (
                              <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                                {img.gallery.name}
                              </p>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-200 rounded-xl pointer-events-none" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {grouped['unspecified']?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
                    Other Paintings
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {grouped['unspecified'].map((img) => (
                      <button
                        key={img.id}
                        onClick={() => handleSelect(img)}
                        className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-primary-400 hover:shadow-lg transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <div className="aspect-square bg-gray-100 overflow-hidden">
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={img.caption || 'Painting'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Paintbrush className="h-10 w-10 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                            {img.caption || 'Untitled'}
                          </p>
                          {img.estimated_time_minutes && (
                            <span className="text-xs flex items-center gap-1 mt-1" style={{ color: '#9ca3af' }}>
                              <Clock className="h-3 w-3" />
                              {img.estimated_time_minutes} min
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}