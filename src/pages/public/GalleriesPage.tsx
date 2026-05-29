import { useState, useEffect, useRef } from 'react';
import { useGalleries, useGalleryCategories } from '../../hooks/useGallery';
import { Images } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import AnimatedText from '../../components/animations/AnimatedText';
import AnimateOnScroll from '../../components/animations/AnimateOnScroll';
import SEO from '../../components/SEO';
import type { Gallery, GalleryImage } from '../../types/database';

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ backgroundColor: 'var(--section-bg-light)' }}>
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

export default function GalleriesPage() {
  const { data: galleries, isLoading } = useGalleries();
  const { data: categories } = useGalleryCategories();
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const activeGalleries = galleries?.filter(g => g.is_active && !g.is_deleted) || [];

  const filteredGalleries = activeCategory
    ? activeGalleries.filter(g => g.category_id === activeCategory)
    : activeGalleries;

  const getCategory = (id: string | null) => categories?.find(c => c.id === id) || null;

  const getDisplayImage = (gallery: Gallery) => {
    if (gallery.default_image_url) return gallery.default_image_url;
    if (gallery.images && gallery.images.length > 0) return gallery.images[0].url;
    return null;
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Galleries" description="Browse through our collection of Paint & Sip moments and artwork." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <AnimatedText text="Galleries" as="h1" className="text-3xl font-bold mb-2 text-primary-color" animation="slideUp" stagger={80} />
          <AnimatedText text="Browse through our collection of Paint & Sip moments and artwork." as="p" className="text-secondary-color" animation="fadeIn" stagger={18} delay={300} />
        </div>

        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setActiveCategory('')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={activeCategory === '' ? { backgroundColor: 'var(--primary-color)', color: '#fff' } : { backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={activeCategory === cat.id ? { backgroundColor: cat.color, color: '#fff' } : { backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {filteredGalleries.length === 0 ? (
          <div className="text-center py-12">
            <Images className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No galleries yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGalleries.map((gallery, i) => {
              const category = getCategory(gallery.category_id);
              const displayImage = getDisplayImage(gallery);
              const imageCount = gallery.images?.length || 0;

              return (
                <AnimateOnScroll key={gallery.id} animation="fade-up" delay={i * 80}>
                  <div
                    onClick={() => setSelectedGallery(gallery)}
                    className="group cursor-pointer rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden card-bg border-color"
                    style={{ borderWidth: '1px' }}
                  >
                    <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      {displayImage ? (
                        <LazyImage src={displayImage} alt={gallery.name} className="w-full h-full group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><Images className="h-12 w-12" /></div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute bottom-3 left-3">
                        <Badge variant="primary" className="bg-black/60 text-white border-0">{imageCount} {imageCount === 1 ? 'photo' : 'photos'}</Badge>
                      </div>
                      {category && (
                        <div className="absolute top-3 right-3">
                          <Badge className="text-white border-0" style={{ backgroundColor: category.color }}>{category.name}</Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 text-primary-color">{gallery.name}</h3>
                      <p className="text-sm line-clamp-2 text-secondary-color">{gallery.description || ''}</p>
                    </div>
                  </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedGallery}
        onClose={() => { setSelectedGallery(null); setSelectedImage(null); }}
        title={selectedGallery?.name || ''}
        className="max-w-5xl"
      >
        {selectedGallery && (
          <div className="space-y-4">
            <p className="text-gray-600">{selectedGallery.description}</p>
            {selectedGallery.images && selectedGallery.images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedGallery.images
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(image => (
                    <div
                      key={image.id}
                      onClick={() => setSelectedImage(image)}
                      className="cursor-pointer group relative aspect-square overflow-hidden rounded-lg"
                    >
                      <LazyImage src={image.url} alt={image.caption || ''} className="group-hover:scale-105 transition-transform duration-300" />
                      {image.caption && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                          <p className="text-white text-sm p-3 opacity-0 group-hover:opacity-100 transition-opacity">{image.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No images in this gallery yet.</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        title={selectedImage?.caption || 'Image'}
        className="max-w-4xl"
      >
        {selectedImage && (
          <div className="space-y-4">
            <img src={selectedImage.url} alt={selectedImage.caption || ''} className="w-full rounded-lg" />
            {selectedImage.caption && <p className="text-gray-600 text-center">{selectedImage.caption}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
