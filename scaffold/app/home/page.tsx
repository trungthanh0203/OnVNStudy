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

      // Admin không học/làm bài — chuyển thẳng sang trang quản trị.
      const { data: staff } = await supabase
        .from('staff')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (staff?.role === 'admin') {
        router.push('/admin');
        return;
      }

      // Phụ huynh không cần (và không nên) vào màn hình học/làm bài — chuyển thẳng sang báo cáo
      const { data: fm } = await supabase
        .from('family_members')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (fm?.role === 'parent') {
        router.push('/family-report');
        return;
      }

      // Sắp xếp đúng thứ tự chương trình: theo Chủ đề trước (topics.order_index — Chủ đề 1, 2, 3...),
      // rồi mới đến Bài trong Chủ đề đó (lessons.order_index — Bài 1, Bài 2...).
      // Trước đây chỉ sắp theo lessons.order_index — mà mỗi chủ đề hiện chỉ có 1 bài (order_index = 1
      // cho tất cả), nên các chủ đề bị xếp lộn xộn theo thứ tự nạp dữ liệu chứ không theo đúng chương trình.
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, order_index, topics(order_index)')
        .eq('status', 'published')
        .order('order_index', { foreignTable: 'topics' })
        .order('order_index');
      if (error) console.error('Lỗi khi tải danh sách bài học:', error.message);
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
