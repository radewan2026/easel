import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BlogPost } from '../../types/database';

export default function DebugBlogPage() {
  const [data, setData] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: posts, error: err } = await supabase
          .from('blog_posts')
          .select('*');
        
        if (err) {
          console.error('Supabase error:', err);
          setError(err.message);
        } else {
          setData(posts);
        }
      } catch (e) {
        console.error('Exception:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug: Blog Posts</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
