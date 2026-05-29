import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function DebugPage() {
  const [events, setEvents] = useState<unknown[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function fetch() {
      try {
        // Try without any filters
        const { data, error } = await supabase
          .from('events')
          .select('id, title, is_published, start_datetime');
        
        if (error) throw error;
        setEvents(data || []);
      } catch (e: unknown) {
        setError(String(e));
      }
    }
    fetch();
  }, []);

  if (error) return <div style={{color:'red'}}>Error: {error}</div>;

  return (
    <div style={{padding:20, fontFamily:'monospace', fontSize:12}}>
      <h1>Events: {events.length}</h1>
      {events.map((e: unknown) => (
        <div key={(e as {id:string}).id} style={{marginBottom:5}}>
          {(e as {title:string}).title} - published: {String((e as {is_published:unknown}).is_published)}
        </div>
      ))}
    </div>
  );
}