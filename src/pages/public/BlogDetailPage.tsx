import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBlogPost, useBlogPosts } from '../../hooks/useBlog';
import { useIsAdmin } from '../../hooks/useAuth';
import { formatDate } from '../../lib/utils';
import { Calendar, ChevronLeft, Tag, Edit, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useMemo, useEffect, type CSSProperties } from 'react';
import ShareButtons from '../../components/public/ShareButtons';
import SEO from '../../components/SEO';
import type { BlogPost } from '../../types/database';

const MAX_RECENT = 6;

type ProseStyle = CSSProperties & {
  '--tw-prose-body': string;
  '--tw-prose-headings': string;
  '--tw-prose-links': string;
  '--tw-prose-bold': string;
  '--tw-prose-counters': string;
  '--tw-prose-bullets': string;
  '--tw-prose-hr': string;
  '--tw-prose-quotes': string;
  '--tw-prose-quote-borders': string;
  '--tw-prose-caption': string;
  '--tw-prose-code': string;
  '--tw-prose-pre-code': string;
  '--tw-prose-pre-bg': string;
  '--tw-prose-th-bg': string;
  '--tw-prose-th-borders': string;
  '--tw-prose-td-borders': string;
};

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading, error } = useBlogPost(slug || '');
  const { data: allPosts } = useBlogPosts({ published: true });
  const { isAdmin, loading: authLoading } = useIsAdmin();

  useEffect(() => {
    if (!post) return;
    try {
      const stored = localStorage.getItem('recently_viewed_posts');
      const recent: BlogPost[] = stored ? JSON.parse(stored) : [];
      const updated = [post, ...recent.filter(p => p.id !== post.id)].slice(0, MAX_RECENT);
      localStorage.setItem('recently_viewed_posts', JSON.stringify(updated));
    } catch {
      // Recently viewed posts are a convenience only.
    }
  }, [post]);

  const { prevPost, nextPost } = useMemo(() => {
    if (!allPosts || !post) return { prevPost: null, nextPost: null };
    const sorted = [...allPosts].sort(
      (a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
    );
    const idx = sorted.findIndex(p => p.id === post.id);
    return {
      prevPost: idx > 0 ? sorted[idx - 1] : null,
      nextPost: idx < sorted.length - 1 ? sorted[idx + 1] : null,
    };
  }, [allPosts, post]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>Post not found</p>
        <Link to="/blog">
          <Button>Back to Blog</Button>
        </Link>
      </div>
    );
  }

  const pageUrl = `${window.location.origin}/blog/${post.slug}`;
  const proseStyle = {
    color: 'var(--text-secondary)',
    '--tw-prose-body': 'var(--text-secondary)',
    '--tw-prose-headings': 'var(--text-primary)',
    '--tw-prose-links': 'var(--primary-color)',
    '--tw-prose-bold': 'var(--text-primary)',
    '--tw-prose-counters': 'var(--text-secondary)',
    '--tw-prose-bullets': 'var(--text-secondary)',
    '--tw-prose-hr': 'var(--border-color)',
    '--tw-prose-quotes': 'var(--text-secondary)',
    '--tw-prose-quote-borders': 'var(--primary-color)',
    '--tw-prose-caption': 'var(--text-muted)',
    '--tw-prose-code': 'var(--primary-color)',
    '--tw-prose-pre-code': 'var(--text-secondary)',
    '--tw-prose-pre-bg': 'var(--section-bg-light)',
    '--tw-prose-th-bg': 'var(--section-bg-light)',
    '--tw-prose-th-borders': 'var(--border-color)',
    '--tw-prose-td-borders': 'var(--border-color)',
  } satisfies ProseStyle;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO
        title={post.title}
        description={post.excerpt || post.title}
        image={post.header_image_url || undefined}
        url={pageUrl}
        type="article"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/blog"
          className="inline-flex items-center mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Blog
        </Link>
        {!authLoading && isAdmin && post && (
          <button
            onClick={() => navigate(`/admin/blog/${post.id}`)}
            className="inline-flex items-center mb-6 ml-4"
            style={{ color: 'var(--primary-color)' }}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit this post
          </button>
        )}

        {post.category && (
          <Badge variant="primary" className="mb-4">
            {post.category.name}
          </Badge>
        )}

        <h1 className="text-4xl font-bold mb-4 text-primary-color">{post.title}</h1>

        <ShareButtons url={pageUrl} title={post.title} description={post.excerpt || undefined} />

        <div className="flex items-center gap-4 mb-8 mt-4 text-muted-color">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}
          </div>
        </div>

        {post.seo_keywords && post.seo_keywords.length > 0 && (
          <div className="flex items-center gap-2 mb-8">
<Tag className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />

              {post.seo_keywords.map((keyword, idx) => (
                <span key={idx} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  #{keyword}
                </span>
              ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <article className="prose prose-lg max-w-none">
              <div 
                className="[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mt-3 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mt-3 [&_ol]:mb-5 [&_li]:mb-2 [&_p]:mb-4 [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_td]:px-4 [&_td]:py-3 [&_strong]:font-semibold [&_em]:italic"
                style={proseStyle}
                dangerouslySetInnerHTML={{ __html: post.content || '' }}
              />
            </article>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {post.header_image_url && (
              <div className="sticky top-8">
                <img
                  src={post.header_image_url}
                  alt={post.title}
                  className="w-full rounded-lg shadow-lg"
                />
                {post.excerpt && (
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
                  </div>
                )}
              </div>
            )}

            {post.seo_description && !post.excerpt && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>{post.seo_description}</p>
              </div>
            )}
          </div>
        </div>

        {post.seo_description && post.excerpt && (
          <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <p className="italic" style={{ color: 'var(--text-secondary)' }}>{post.seo_description}</p>
          </div>
        )}

        {/* Prev/Next Post Navigation */}
        {(prevPost || nextPost) && (
          <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prevPost ? (
                <Link
                  to={`/blog/${prevPost.slug}`}
                  className="group block p-6 rounded-xl transition-colors border hover:border-primary-200"
                  style={{ backgroundColor: 'var(--section-bg-light)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Previous Post</span>
                  </div>
                  <h3 className="font-semibold group-hover:text-primary-600 transition-colors line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {prevPost.title}
                  </h3>
                  {prevPost.excerpt && (
                    <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{prevPost.excerpt}</p>
                  )}
                </Link>
              ) : (
                <div />
              )}
              {nextPost ? (
                <Link
                  to={`/blog/${nextPost.slug}`}
                  className="group block p-6 rounded-xl transition-colors border hover:border-primary-200 md:text-right"
                  style={{ backgroundColor: 'var(--section-bg-light)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-2 text-sm mb-2 md:justify-end" style={{ color: 'var(--text-muted)' }}>
                    <span>Next Post</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="font-semibold group-hover:text-primary-600 transition-colors line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {nextPost.title}
                  </h3>
                  {nextPost.excerpt && (
                    <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{nextPost.excerpt}</p>
                  )}
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
