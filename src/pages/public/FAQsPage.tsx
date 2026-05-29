import { useState } from 'react';
import { usePublishedFAQs } from '../../hooks/useFAQs';
import { ChevronDown, ChevronUp, MessageSquare, Search } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import SEO from '../../components/SEO';

export default function FAQsPage() {
  const { data: faqs, isLoading } = usePublishedFAQs();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...(faqs ? [...new Set(faqs.map(f => f.category))] : [])];

  const filteredFAQs = (faqs || []).filter(faq => {
    const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedFAQs = filteredFAQs.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, typeof filteredFAQs>);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="FAQs" description="Frequently asked questions about Paint & Sip events, bookings, and more." />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-primary-color">Frequently Asked Questions</h1>
          <p className="text-xl max-w-2xl mx-auto text-secondary-color">
            Find answers to common questions about our Paint & Sip events, booking process, and more.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-12 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 shadow-sm"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
              style={activeCategory === category 
                ? { backgroundColor: 'var(--primary-color)', color: '#fff' } 
                : { backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQs */}
        {Object.entries(groupedFAQs || {}).map(([category, categoryFAQs]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary-color">
              <Badge variant="primary">{category}</Badge>
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({categoryFAQs?.length})</span>
            </h2>
            <div className="space-y-3">
              {categoryFAQs?.map((faq) => (
                <Card key={faq.id} className="hover:shadow-md transition-shadow card-bg border-color" style={{ borderWidth: '1px' }}>
                  <CardContent className="p-0">
                    <button
                      className="w-full flex items-center justify-between p-5 text-left"
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                    >
                      <h3 className="font-medium pr-4 text-primary-color">{faq.question}</h3>
                      {expandedId === faq.id ? (
                        <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                    {expandedId === faq.id && (
                      <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="whitespace-pre-line mt-4 text-secondary-color">{faq.answer}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredFAQs?.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No FAQs found</p>
            {searchQuery && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Try a different search term</p>
            )}
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-12 p-8 rounded-2xl text-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Still have questions?</h3>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
            We're here to help! Reach out to us and we'll get back to you as soon as possible.
          </p>
          <a
            href="mailto:hello@paintandsip.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
          >
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}
