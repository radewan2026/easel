import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export default function SEO({ title, description, image, url, type = 'website' }: SEOProps) {
  useEffect(() => {
    document.title = `${title} | Paint & Sip`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
      }
      if (el) {
        el.setAttribute('content', content);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', property.startsWith('og:') || property.startsWith('twitter:') ? property : 'name');
        if (!property.startsWith('og:') && !property.startsWith('twitter:')) {
          meta.setAttribute('name', property);
        }
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    };

    if (description) {
      setMeta('description', description);
      setMeta('og:description', description);
      setMeta('twitter:description', description);
    }
    setMeta('og:title', title);
    setMeta('og:type', type);
    setMeta('twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('twitter:title', title);

    if (image) {
      setMeta('og:image', image);
      setMeta('twitter:image', image);
    }
    if (url) {
      setMeta('og:url', url);
    }
  }, [title, description, image, url, type]);

  return null;
}
