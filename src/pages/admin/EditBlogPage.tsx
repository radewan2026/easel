import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBlogPosts, useBlogCategories, useCreateBlogPost, useUpdateBlogPost } from '../../hooks/useBlog';
import { useSettings } from '../../hooks/useAdmin';
import { slugify } from '../../lib/utils';
import { Save, ArrowLeft, Eye, EyeOff, X, Image, Sparkles, Wand2, Lightbulb } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export default function EditBlogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: posts, isLoading: postsLoading } = useBlogPosts();
  const { data: categories } = useBlogCategories();
  const { data: settings } = useSettings();
  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isNew = !id;
  const existingPost = posts?.find(p => p.id === id);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    header_image_url: '',
    category_id: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    is_published: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [showHeadlineIdeas, setShowHeadlineIdeas] = useState(false);
  const [headlineIdeas, setHeadlineIdeas] = useState<string[]>([]);

  useEffect(() => {
    if (!isNew && existingPost) {
      setFormData({
        title: existingPost.title,
        slug: existingPost.slug,
        content: existingPost.content || '',
        excerpt: existingPost.excerpt || '',
        header_image_url: existingPost.header_image_url || '',
        category_id: existingPost.category_id || '',
        seo_title: existingPost.seo_title || '',
        seo_description: existingPost.seo_description || '',
        seo_keywords: existingPost.seo_keywords?.join(', ') || '',
        is_published: existingPost.is_published,
      });
    }
  }, [isNew, existingPost]);

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug || slugify(value)
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const postData = {
        title: formData.title,
        slug: formData.slug || slugify(formData.title),
        content: formData.content || null,
        excerpt: formData.excerpt || null,
        header_image_url: formData.header_image_url || null,
        category_id: formData.category_id || null,
        is_published: formData.is_published,
      };

      if (isNew) {
        await createPost.mutateAsync(postData);
        showToast('Blog post created successfully!');
      } else {
        await updatePost.mutateAsync({ id, ...postData });
        showToast('Blog post updated successfully!');
      }
      navigate('/admin/blog');
    } catch (err) {
      console.error('Failed to save post:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save post', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileBrowse = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, header_image_url: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    });
    showToast('Image added!');
  };

  const handleGenerateContent = () => {
    const brandName = settings?.find(s => s.key === 'brand_name')?.value || 'Paint & Sip';
    const brandPersona = settings?.find(s => s.key === 'brand_persona')?.value || 'fun, creative, welcoming';
    const tagline = settings?.find(s => s.key === 'tagline')?.value || 'Paint, Sip, Create!';
    
    const title = formData.title || 'This Amazing Experience';
    const topic = title.toLowerCase();
    
    const content = `<h2>Welcome to ${brandName}!</h2>

<p>We're thrilled to share this guide about ${topic} with you. At ${brandName}, we believe in the power of creativity, community, and having a great time. Our ${brandPersona} approach makes every experience memorable and enjoyable.</p>

<h2>Why ${topic.charAt(0).toUpperCase() + topic.slice(1)} Matters</h2>

<p>Whether you're a beginner or a seasoned pro, embracing ${topic} can transform your perspective and unlock new possibilities. It's not just about the activity itself—it's about the connections you make and the memories you create along the way.</p>

<h2>What to Expect</h2>

<ul>
<li><strong>Friendly Atmosphere</strong> - Our space is designed to make everyone feel welcome and comfortable</li>
<li><strong>Expert Guidance</strong> - Our talented team is here to help you every step of the way</li>
<li><strong>All Materials Included</strong> - We've got everything you need to get started</li>
<li><strong>Fun & Relaxation</strong> - This is your time to unwind and express yourself</li>
</ul>

<h2>Tips for Getting the Most Out of Your Experience</h2>

<ol>
<li><strong>Come with an Open Mind</strong> - Don't worry about perfection; focus on the journey</li>
<li><strong>Ask Questions</strong> - Our team loves sharing their knowledge</li>
<li><strong>Take Your Time</strong> - There's no rush; enjoy every moment</li>
<li><strong>Connect with Others</strong> - You'll meet amazing people who share your interests</li>
</ol>

<h2>Ready to Join Us?</h2>

<p>Book your spot today and discover why ${brandName} is the go-to destination for ${topic}. Visit our <a href="/events">events page</a> to see upcoming sessions. We can't wait to create something beautiful with you!</p>

<p>${tagline}</p>

<p><em>P.S. Follow us on <a href="https://instagram.com" target="_blank">Instagram</a> and <a href="https://facebook.com" target="_blank">Facebook</a> for inspiration and behind-the-scenes content!</em></p>`;
    
    setFormData(prev => ({ ...prev, content }));
    showToast('Content generated with brand styling!');
  };

  const handleGenerateHeadlines = () => {
    const title = formData.title || 'this topic';
    const headlines = [
      `10 Essential Tips for Better ${title}`,
      `How to Master ${title}: A Complete Guide`,
      `Why ${title} Is Important for Your Business`,
      `The Ultimate Guide to ${title} in 2025`,
      `Everything You Need to Know About ${title}`,
      `5 Secrets About ${title} They Don't Want You to Know`,
      `How ${title} Can Transform Your Results`,
      `The Beginners Guide to ${title}`,
    ];
    setHeadlineIdeas(headlines);
    setShowHeadlineIdeas(true);
  };

  const applyHeadline = (headline: string) => {
    setFormData(prev => ({ ...prev, title: headline, slug: slugify(headline) }));
    setShowHeadlineIdeas(false);
    showToast('Headline applied!');
  };

  const handleGenerateImage = () => {
    const keywords = encodeURIComponent(formData.title || 'painting wine art');
    const imageUrl = `https://source.unsplash.com/1200x800/?${keywords}`;
    setFormData(prev => ({ ...prev, header_image_url: imageUrl }));
    showToast('Header image generated!');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileBrowse(e.dataTransfer.files);
    }
  };

  if (postsLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/admin/blog')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-900">
                {isNew ? 'Create New Blog Post' : 'Edit Blog Post'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant={formData.is_published ? 'primary' : 'secondary'}
                onClick={() => setFormData(prev => ({ ...prev, is_published: !prev.is_published }))}
              >
                {formData.is_published ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                {formData.is_published ? 'Published' : 'Draft'}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Post'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Content</CardTitle>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleGenerateHeadlines}>
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Headline Ideas
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleGenerateContent}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Auto Write
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter post title"
                  required
                />
                {showHeadlineIdeas && headlineIdeas.length > 0 && (
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-primary-700">Headline Ideas</h4>
                      <button
                        onClick={() => setShowHeadlineIdeas(false)}
                        className="text-primary-400 hover:text-primary-600 text-xs"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="space-y-2">
                      {headlineIdeas.map((headline, i) => (
                        <button
                          key={i}
                          onClick={() => applyHeadline(headline)}
                          className="w-full text-left px-3 py-2 bg-white rounded-lg text-sm text-gray-700 hover:bg-primary-100 hover:text-primary-700 transition-colors border border-primary-100"
                        >
                          {headline}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Input
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Content</label>
                  <Textarea
                    value={formData.content}
                    onChange={(event) => setFormData(prev => ({ ...prev, content: event.target.value }))}
                    rows={18}
                    placeholder="Write the blog post. Basic HTML is supported."
                  />
                </div>
                <Textarea
                  label="Excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Short description for previews..."
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="SEO Title"
                  value={formData.seo_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                  placeholder="Custom title for search engines"
                />
                <Textarea
                  label="SEO Description"
                  value={formData.seo_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, seo_description: e.target.value }))}
                  placeholder="Description for search results..."
                  rows={3}
                />
                <Input
                  label="SEO Keywords"
                  value={formData.seo_keywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, seo_keywords: e.target.value }))}
                  placeholder="keyword1, keyword2, keyword3"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Featured Image</CardTitle>
                <Button variant="secondary" size="sm" onClick={handleGenerateImage}>
                  <Wand2 className="h-4 w-4 mr-1" />
                  AI Header Image
                </Button>
              </CardHeader>
              <CardContent>
                {formData.header_image_url ? (
                  <div className="relative">
                    <img
                      src={formData.header_image_url}
                      alt="Featured"
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, header_image_url: '' }))}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                      isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Click or drag image here</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileBrowse(e.target.files)}
                />
                <div className="mt-4">
                  <Input
                    label="Or paste image URL"
                    value={formData.header_image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, header_image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  options={[
                    { value: '', label: 'No category' },
                    ...(categories?.map((cat) => ({ value: cat.id, label: cat.name })) || []),
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {formData.header_image_url && (
                    <img
                      src={formData.header_image_url}
                      alt="Preview"
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                  )}
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {formData.title || 'Post Title'}
                  </h3>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {formData.excerpt || 'Excerpt will appear here...'}
                  </p>
                  <div className="flex items-center gap-2">
                    {formData.category_id && categories?.find(c => c.id === formData.category_id) && (
                      <Badge variant="primary">
                        {categories.find(c => c.id === formData.category_id)?.name}
                      </Badge>
                    )}
                    <Badge variant={formData.is_published ? 'success' : 'gray'}>
                      {formData.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
