'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function FamilyReportPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [sessionsByStudent, setSessionsByStudent] = useState<Record<string, any[]>>({});

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Tìm gia đình của tài khoản đang đăng nhập (học sinh hoặc phụ huynh đều dùng chung trang này)
      const { data: fm, error: fmErr } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (fmErr || !fm) {
        setError('Tài khoản này chưa được gắn vào gia đình nào trong hệ thống.');
        setLoading(false);
        return;
      }
      setRole(fm.role);

      const { data: studentRows, error: stErr } = await supabase
        .from('students')
        .select('id, full_name, current_grade')
        .eq('family_id', fm.family_id);

      if (stErr) {
        setError(stErr.message);
        setLoading(false);
        return;
      }
      setStudents(studentRows || []);

      const map: Record<string, any[]> = {};
      for (const s of studentRows || []) {
        const { data: sessions } = await supabase
          .from('study_sessions')
          .select('id, quiz_score, created_at, lessons(title)')
          .eq('student_id', s.id)
          .order('created_at', { ascending: false });
        map[s.id] = sessions || [];
      }
      setSessionsByStudent(map);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {role === 'student' ? <a href="/home">← Quay lại danh sách bài học</a> : <span />}
        <button onClick={handleLogout}>Đăng xuất</button>
      </div>
      <h1>Báo cáo học tập</h1>
      {role === 'parent' && (
        <p style={{ fontSize: 13, color: '#555' }}>
          Muốn thêm con hoặc đổi khối lớp đang học, liên hệ trực tiếp để được hỗ trợ.
        </p>
      )}
      {error && <p style={{ color: '#900' }}>{error}</p>}
      {students.length === 0 && !error && <p>Chưa có học sinh nào trong gia đình.</p>}
      {students.map((s) => (
        <div key={s.id} style={{ marginBottom: 24 }}>
          <h2>
            {s.full_name} — Lớp {s.current_grade}
          </h2>
          {(sessionsByStudent[s.id] || []).length === 0 ? (
            <p>Chưa có kết quả học tập nào.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 4 }}>Bài học</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 4 }}>Điểm</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 4 }}>Ngày</th>
                </tr>
              </thead>
              <tbody>
                {(sessionsByStudent[s.id] || []).map((sess) => (
                  <tr key={sess.id}>
                    <td style={{ padding: 4 }}>{sess.lessons?.title || '(không rõ)'}</td>
                    <td style={{ padding: 4 }}>{sess.quiz_score}%</td>
                    <td style={{ padding: 4 }}>{new Date(sess.created_at).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </main>
  );
}
