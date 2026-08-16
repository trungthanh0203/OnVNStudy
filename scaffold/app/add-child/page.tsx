'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AddChildPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);

  const [fullName, setFullName] = useState('');
  const [currentGrade, setCurrentGrade] = useState('3');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ loginEmail: string } | null>(null);

  async function loadChildren(fid: string) {
    const { data } = await supabase.from('students').select('id, full_name, current_grade').eq('family_id', fid);
    setChildren(data || []);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: fm } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', session.user.id)
        .eq('role', 'parent')
        .maybeSingle();
      if (!fm) {
        setError('Chỉ tài khoản phụ huynh mới thêm được học sinh. Nếu bạn là học sinh, quay lại trang chủ để học.');
        setChecking(false);
        return;
      }
      setFamilyId(fm.family_id);
      await loadChildren(fm.family_id);
      setChecking(false);
    }
    init();
  }, []);

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError('Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới, 3-20 ký tự (ví dụ: be_an).');
      return;
    }

    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch('/api/create-child', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session?.access_token,
        fullName,
        currentGrade: Number(currentGrade),
        username,
        password,
      }),
    });
    const data: any = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Có lỗi xảy ra, thử lại.');
      return;
    }

    setResult({ loginEmail: data.loginEmail });
    setFullName('');
    setUsername('');
    setPassword('');
    setConfirm('');
    if (familyId) await loadChildren(familyId);
  }

  if (checking) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h1>Thêm học sinh</h1>
      <p>Mỗi con cần 1 tài khoản đăng nhập riêng để tự học và làm bài.</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ background: '#e6ffed', border: '1px solid #4caf50', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>✅ Đã tạo tài khoản cho con!</strong>
          <p>
            Tên đăng nhập (email) của con: <code>{result.loginEmail}</code>
            <br />
            Mật khẩu: đúng mật khẩu bạn vừa đặt ở trên.
          </p>
          <p style={{ fontSize: 13, color: '#555' }}>
            Ghi lại thông tin này để con đăng nhập tại trang đăng nhập — hệ thống không lưu lại mật khẩu dưới dạng
            đọc được, và email này chỉ dùng nội bộ, không nhận được thư thật gửi tới.
          </p>
        </div>
      )}

      {familyId && (
        <form onSubmit={handleAddChild} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label>Tên đầy đủ của con</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Khối lớp</label>
            <select
              value={currentGrade}
              onChange={(e) => setCurrentGrade(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Tên đăng nhập cho con (chỉ chữ thường/số/gạch dưới, ví dụ: be_an)</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Mật khẩu cho con (ít nhất 6 ký tự)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Nhập lại mật khẩu</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={saving} style={{ width: '100%', padding: 10 }}>
            {saving ? 'Đang tạo...' : 'Tạo tài khoản cho con'}
          </button>
        </form>
      )}

      {children.length > 0 && (
        <div>
          <h2>Các con đã có tài khoản</h2>
          <ul>
            {children.map((c) => (
              <li key={c.id}>
                {c.full_name} — Lớp {c.current_grade}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ marginTop: 24 }}>
        <a href="/family-report">📊 Xem báo cáo học tập</a>
      </p>
    </main>
  );
}
