'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function HomePage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('lessons')
        .select('id, title')
        .eq('status', 'published')
        .order('order_index');
      setLessons(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Các bài học</h1>
        <button onClick={handleLogout}>Đăng xuất</button>
      </div>
      <p>
        <a href="/family-report">📊 Xem báo cáo học tập</a>
      </p>
      {lessons.length === 0 && <p>Chưa có bài học nào được xuất bản.</p>}
      <ul>
        {lessons.map((l) => (
          <li key={l.id} style={{ marginBottom: 8 }}>
            <a href={`/lesson/${l.id}`}>{l.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
