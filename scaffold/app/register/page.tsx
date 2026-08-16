'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
    // In ra console (F12 > Console) để xem nguyên văn phản hồi thật từ Supabase khi cần
    // tra lỗi kỹ hơn — không hiện cho người dùng thường, chỉ để debug.
    console.log('supabase.auth.signUp() trả về:', { signUpData, signUpErr });

    if (signUpErr) {
      setLoading(false);
      setError(
        signUpErr.message.toLowerCase().includes('already registered')
          ? 'Email này đã có tài khoản — hãy đăng nhập thay vì đăng ký.'
          : signUpErr.message
      );
      return;
    }
    if (!signUpData.user) {
      setLoading(false);
      setError('Không tạo được tài khoản (không rõ lý do từ Supabase) — mở Console (F12) xem chi tiết, hoặc thử lại.');
      return;
    }
    // Supabase cố tình trả về "thành công giả" (user có id nhưng identities rỗng, không
    // có session) khi email đã tồn tại từ trước — kể cả email đó CHƯA xác nhận — để
    // tránh lộ thông tin email nào đã đăng ký (chống dò email). Đây là nguyên nhân hay
    // gặp NHẤT khi thử đăng ký lại bằng đúng email đã thử lỗi ở lượt trước.
    if (signUpData.user.identities && signUpData.user.identities.length === 0) {
      setLoading(false);
      setError(
        `Email "${email}" đã tồn tại trong hệ thống (có thể do lượt đăng ký thử trước đó chưa xoá hết). ` +
          'Vào Supabase Dashboard > Authentication > Users, tìm đúng email này và xoá, rồi quay lại đăng ký. ' +
          'Hoặc nhanh hơn: thử lại bằng 1 email khác, hoàn toàn chưa dùng qua bao giờ.'
      );
      return;
    }
    if (!signUpData.session) {
      setLoading(false);
      setError(
        'Tài khoản Auth đã tạo nhưng chưa có phiên đăng nhập ngay — kiểm tra lại đã tắt "Confirm email" trong ' +
          'Supabase Dashboard > Authentication > Providers (hoặc Sign In / Providers) > Email chưa. Sau khi tắt, ' +
          'nhớ thử lại bằng 1 email HOÀN TOÀN MỚI (email vừa thử ở đây có thể đã bị đánh dấu "chờ xác nhận" từ ' +
          'trước khi bạn tắt cấu hình, cần xoá trong Authentication > Users trước khi dùng lại).'
      );
      return;
    }

    const parentUserId = signUpData.user.id;

    const { data: family, error: familyErr } = await supabase.from('families').insert({}).select('id').single();
    if (familyErr || !family) {
      setLoading(false);
      setError(`Tạo gia đình thất bại: ${familyErr?.message}`);
      return;
    }

    const { error: fmErr } = await supabase
      .from('family_members')
      .insert({ family_id: family.id, user_id: parentUserId, role: 'parent' });
    if (fmErr) {
      setLoading(false);
      setError(`Gắn tài khoản vào gia đình thất bại: ${fmErr.message}`);
      return;
    }

    setLoading(false);
    router.push('/add-child');
  }

  return (
    <main style={{ maxWidth: 320, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <h1>Đăng ký tài khoản phụ huynh</h1>
      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p style={{ marginTop: 16 }}>
        Đã có tài khoản? <a href="/login">Đăng nhập</a>
      </p>
    </main>
  );
}
