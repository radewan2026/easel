import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBlogPosts, useBlogCategories, useCreateBlogPost, useUpdateBlogPost } from '../../hooks/useBlog';
import { useSettings } from '../../hooks/useAdmin';
import { slugify } from '../../lib/utils';
import { Save, ArrowLeft, Eye, EyeOff, X, Image, Sparkles, Wand2, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { callAiGateway } from '../../lib/aiGateway';

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
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingHeadlines, setIsGeneratingHeadlines] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [showHeadlineIdeas, setShowHeadlineIdeas] = useState(false);
  const [headlineIdeas, setHeadlineIdeas] = useState<string[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
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

  const handleGenerateContent = async () => {
    const brandName = settings?.find(s => s.key === 'brand_name')?.value || 'Paint & Sip';
    const brandPersona = settings?.find(s => s.key === 'brand_persona')?.value || 'fun, creative, welcoming';

    if (!formData.title.trim()) {
      showToast('Enter a title first so the AI knows what to write about.', 'info');
      return;
    }

    setIsGeneratingContent(true);
    try {
      const result = await callAiGateway({
        task: 'blog_content',
        messages: [
          { role: 'system', content: `You are a blog writer for ${brandName}. Brand persona: ${brandPersona}. Write in HTML format. Return only the HTML content, no markdown.` },
          { role: 'user', content: `Write a complete blog post HTML body for: ${formData.title}. Include headings, paragraphs, and a list.` },
        ],
        maxTokens: 1000,
      });

      if (result.content) {
        const content = result.content;
        setFormData(prev => ({ ...prev, content }));
        showToast('Content generated with AI!');
      } else {
        showToast('AI generation failed. Try again.', 'error');
      }
    } catch {
      showToast('Failed to generate content', 'error');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleGenerateHeadlines = async () => {
    const brandName = settings?.find(s => s.key === 'brand_name')?.value || 'Paint & Sip';

    setIsGeneratingHeadlines(true);
    try {
      const result = await callAiGateway({
        task: 'blog_headlines',
        messages: [
          { role: 'system', content: `You help ${brandName} with blog headlines. Return exactly 8 headline ideas as a JSON array of strings, no other text.` },
          { role: 'user', content: `Generate 8 blog post headline ideas for: ${formData.title || 'paint and sip studio content'}` },
        ],
        maxTokens: 400,
      });

      if (result.content) {
        try {
          const parsed = JSON.parse(result.content);
          if (Array.isArray(parsed)) {
            setHeadlineIdeas(parsed);
            setShowHeadlineIdeas(true);
            showToast('Headlines generated!');
            return;
          }
        } catch {
          const lines = result.content.split('\n').filter(l => l.trim().match(/^[\d"]/));
          if (lines.length > 0) {
            setHeadlineIdeas(lines.map(l => l.replace(/^\d+[.)]\s*"?|"?\s*$/g, '')));
            setShowHeadlineIdeas(true);
            showToast('Headlines generated!');
            return;
          }
        }
      }
      showToast('Failed to generate headlines', 'error');
    } catch {
      showToast('Failed to generate headlines', 'error');
    } finally {
      setIsGeneratingHeadlines(false);
    }
  };

  const handleGenerateImage = async () => {
    const brandName = settings?.find(s => s.key === 'brand_name')?.value || 'Paint & Sip';

    setIsGeneratingImage(true);
    try {
      const result = await callAiGateway({
        task: 'image_generation',
        messages: [
          { role: 'system', content: `You generate promotional image URLs for ${brandName} blog posts. Return only a direct image URL.` },
          { role: 'user', content: `Generate an image URL for a blog post titled: ${formData.title || 'paint and sip experience'}` },
        ],
        maxTokens: 200,
      });

      if (result.content && (result.content.startsWith('http://') || result.content.startsWith('https://'))) {
        const imageUrl = result.content;
        setFormData(prev => ({ ...prev, header_image_url: imageUrl }));
        showToast('Image generated with AI!');
        setIsGeneratingImage(false);
        return;
      }
    } catch {
      // fall through to unsplash fallback
    }

    const keywords = encodeURIComponent(formData.title || 'painting wine art');
    const imageUrl = `https://source.unsplash.com/1200x800/?${keywords}`;
    setFormData(prev => ({ ...prev, header_image_url: imageUrl }));
    showToast('Stock photo applied (AI image generation unavailable)');
    setIsGeneratingImage(false);
  };

  const applyHeadline = (headline: string) => {
    setFormData(prev => ({ ...prev, title: headline, slug: slugify(headline) }));
    setShowHeadlineIdeas(false);
    showToast('Headline applied!');
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
                  <Button variant="secondary" size="sm" onClick={handleGenerateHeadlines} disabled={isGeneratingHeadlines}>
                    {isGeneratingHeadlines ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-1" />}
                    Headline Ideas
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleGenerateContent} disabled={isGeneratingContent}>
                    {isGeneratingContent ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
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
                <Button variant="secondary" size="sm" onClick={handleGenerateImage} disabled={isGeneratingImage}>
                  {isGeneratingImage ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                  {isGeneratingImage ? 'Generating...' : 'AI Header Image'}
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
