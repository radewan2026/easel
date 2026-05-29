import { Link, useSearchParams } from 'react-router-dom';
import { useBlogPosts, useBlogCategories } from '../../hooks/useBlog';
import { formatDate } from '../../lib/utils';
import { Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import AnimatedText from '../../components/animations/AnimatedText';
import AnimateOnScroll from '../../components/animations/AnimateOnScroll';
import SEO from '../../components/SEO';
import type { BlogPost } from '../../types/database';

const MAX_RECENT = 6;

function useRecentlyViewedPosts() {
  const [recent, setRecent] = useState<BlogPost[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recently_viewed_posts');
      if (stored) queueMicrotask(() => setRecent(JSON.parse(stored)));
    } catch {
      queueMicrotask(() => setRecent([]));
    }
  }, []);

  const addViewed = (post: BlogPost) => {
    const updated = [post, ...recent.filter(p => p.id !== post.id)].slice(0, MAX_RECENT);
    setRecent(updated);
    try {
      localStorage.setItem('recently_viewed_posts', JSON.stringify(updated));
    } catch {
      // Recently viewed posts are a convenience only.
    }
  };

  return { recent, addViewed };
}

export default function BlogPage() {
  const [searchParams] = useSearchParams();
  const { data: posts, isLoading } = useBlogPosts({ published: true });
  const { data: categories } = useBlogCategories();
  const { recent } = useRecentlyViewedPosts();

  const publishedPosts = posts || [];

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Blog" description="Latest news, tips, and stories from the Paint & Sip world." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <AnimatedText
            text="Blog"
            as="h1"
            className="text-3xl font-bold mb-2 text-primary-color"
            animation="slideUp"
            stagger={80}
          />
          <AnimatedText
            text="Latest news, tips, and stories from the Paint & Sip world."
            as="p"
            className="text-secondary-color"
            animation="fadeIn"
            stagger={20}
            delay={300}
          />
        </div>

        {/* Recently Viewed */}
        {recent.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Recently Viewed</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recent.map(post => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="flex-shrink-0 w-40 group">
                  <div className="aspect-video rounded-lg overflow-hidden mb-1" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    {post.header_image_url ? (
                      <img src={post.header_image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><Calendar className="h-6 w-6" /></div>
                    )}
                  </div>
                  <p className="text-xs font-medium truncate group-hover:text-primary-600" style={{ color: 'var(--text-secondary)' }}>{post.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link to="/blog">
              <Button variant={!searchParams.get('category') ? 'primary' : 'ghost'} size="sm">
                All
              </Button>
            </Link>
            {categories.map((category) => (
              <Link key={category.id} to={`/blog?category=${category.id}`}>
                <Button
                  variant={searchParams.get('category') === category.id ? 'primary' : 'ghost'}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  {category.name}
                </Button>
              </Link>
            ))}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : publishedPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No blog posts yet.</p>
            <p style={{ color: 'var(--text-muted)' }}>Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedPosts.map((post, i) => (
              <AnimateOnScroll key={post.id} animation="fade-up" delay={i * 80}>
                <Link to={`/blog/${post.slug}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow card-bg border-color" style={{ borderWidth: '1px' }}>
                    <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      {post.header_image_url ? (
                        <img
                          src={post.header_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                          <Calendar className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <CardContent>
                      {post.category && (
                        <Badge variant="primary" className="mb-2">
                          {post.category.name}
                        </Badge>
                      )}
                      <h2 className="font-semibold text-lg mb-2 line-clamp-2 text-primary-color">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-sm mb-4 line-clamp-3 text-secondary-color">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center text-sm text-muted-color">
                        <Calendar className="h-4 w-4 mr-1" />
                        {post.published_at ? formatDate(post.published_at) : ''}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </AnimateOnScroll>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
