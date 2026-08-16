// Hàm dùng chung cho MỌI route quản trị (app/api/admin/*/route.ts) — xác thực accessToken
// gửi lên thật sự thuộc về 1 tài khoản có trong bảng staff với role = 'admin'. Luôn kiểm
// tra lại ở server (không tin tưởng riêng phần kiểm tra hiển thị ở giao diện trình duyệt —
// giao diện chỉ ẩn/hiện nút cho gọn, còn quyền THẬT nằm ở đây).
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-admin';

type VerifyResult =
  | { ok: true; adminUserId: string; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string; status: number };

export async function verifyAdmin(accessToken: string | undefined): Promise<VerifyResult> {
  if (!accessToken) {
    return { ok: false, error: 'Thiếu accessToken — bạn cần đăng nhập trước.', status: 401 };
  }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: userData, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return { ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn — đăng nhập lại rồi thử tiếp.', status: 401 };
  }

  const admin = createAdminClient();
  const { data: staff, error: staffErr } = await admin
    .from('staff')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (staffErr) {
    return { ok: false, error: `Lỗi khi kiểm tra quyền quản trị: ${staffErr.message}`, status: 500 };
  }
  if (!staff || staff.role !== 'admin') {
    return { ok: false, error: 'Tài khoản này không có quyền quản trị.', status: 403 };
  }

  return { ok: true, adminUserId: userData.user.id, admin };
}
