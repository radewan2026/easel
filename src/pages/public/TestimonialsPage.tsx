import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Star, Quote, Filter } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import type { Testimonial } from '../../hooks/useTestimonials';

export default function TestimonialsPage() {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['publicTestimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*, event:events(title)')
        .eq('is_published', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Testimonial[];
    },
  });

  const filteredTestimonials = useMemo(() => {
    if (!testimonials) return [];
    return testimonials.filter(t => {
      if (selectedRating && t.rating !== selectedRating) return false;
      if (showFeaturedOnly && !t.is_featured) return false;
      return true;
    });
  }, [testimonials, selectedRating, showFeaturedOnly]);

  const featuredTestimonials = testimonials?.filter(t => t.is_featured) || [];
  const regularTestimonials = filteredTestimonials.filter(t => !t.is_featured || showFeaturedOnly);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">What Our Guests Say</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what our amazing guests have to say about their Paint & Sip experience.
          </p>
        </div>

        {/* Featured Testimonials */}
        {featuredTestimonials.length > 0 && !showFeaturedOnly && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              Featured Reviews
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTestimonials.slice(0, 3).map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} featured />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Filter by:</span>
          </div>
          <button
            onClick={() => { setSelectedRating(null); setShowFeaturedOnly(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedRating && !showFeaturedOnly
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Reviews
          </button>
          <button
            onClick={() => { setShowFeaturedOnly(true); setSelectedRating(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFeaturedOnly
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Featured
          </button>
          {[5, 4, 3].map(rating => (
            <button
              key={rating}
              onClick={() => { setSelectedRating(rating); setShowFeaturedOnly(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                selectedRating === rating
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {rating} <Star className="h-3 w-3" />
            </button>
          ))}
        </div>

        {/* All Testimonials */}
        {regularTestimonials.length === 0 && filteredTestimonials.length === 0 ? (
          <div className="text-center py-12">
            <Quote className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No testimonials found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularTestimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
        )}

        {/* Stats */}
        {testimonials && testimonials.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-gray-900">{testimonials.length}</div>
                <div className="text-sm text-gray-500">Total Reviews</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {(testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">Average Rating</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {testimonials.filter(t => t.rating === 5).length}
                </div>
                <div className="text-sm text-gray-500">5-Star Reviews</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {Math.round((testimonials.filter(t => t.rating >= 4).length / testimonials.length) * 100)}%
                </div>
                <div className="text-sm text-gray-500">Would Recommend</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestimonialCard({ testimonial, featured = false }: { testimonial: Testimonial; featured?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-6 transition-shadow ${
      featured ? 'shadow-lg border-2 border-primary-100' : 'shadow-sm hover:shadow-md'
    }`}>
      <div className="flex items-start gap-4">
        {testimonial.author_image_url ? (
          <img
            src={testimonial.author_image_url}
            alt={testimonial.author_name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-600 font-semibold">
              {testimonial.author_name.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{testimonial.author_name}</h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          {testimonial.event && (
            <Badge variant="primary" className="mb-2 text-xs">
              {testimonial.event.title}
            </Badge>
          )}
          <div className="relative">
            <Quote className="absolute -top-1 -left-1 h-4 w-4 text-primary-200" />
            <p className="text-gray-600 text-sm leading-relaxed pl-4">
              {testimonial.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}