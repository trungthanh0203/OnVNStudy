// Route Handler chạy PHÍA SERVER (bên trong Cloudflare Worker) — tạo tài khoản đăng
// nhập cho 1 học sinh (con) mà KHÔNG làm mất phiên đăng nhập hiện tại của phụ huynh
// trên trình duyệt (vì việc tạo tài khoản diễn ra hoàn toàn ở server, dùng
// service_role key qua lib/supabase-admin.ts, không đụng đến session phía client —
// khác với cách gọi supabase.auth.signUp() thẳng từ trình duyệt sẽ tự động đăng nhập
// luôn thành tài khoản mới, làm phụ huynh bị đăng xuất khỏi tài khoản của mình).
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase-admin';

function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, fullName, currentGrade, username, password } = body || {};

    if (!accessToken) {
      return NextResponse.json({ error: 'Thiếu accessToken — bạn cần đăng nhập trước.' }, { status: 401 });
    }
    if (!fullName || !currentGrade || !username || !password) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới, 3-20 ký tự (ví dụ: be_an).' },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' }, { status: 400 });
    }

    // Xác thực accessToken của phụ huynh đang gọi API này bằng anon key trước
    // (không dùng service role ở bước này) — để chắc chắn accessToken thật sự hợp
    // lệ do Supabase Auth cấp, không phải giá trị giả mạo gửi thẳng lên.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: userData, error: userErr } = await anon.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn — đăng nhập lại rồi thử tiếp.' }, { status: 401 });
    }
    const parentUserId = userData.user.id;

    const admin = createAdminClient();

    // Xác nhận người gọi thật sự là "parent" của 1 gia đình (dùng service role, tự
    // kiểm tra logic nghiệp vụ ở đây thay vì phụ thuộc hoàn toàn vào RLS).
    const { data: fm, error: fmErr } = await admin
      .from('family_members')
      .select('family_id, role')
      .eq('user_id', parentUserId)
      .eq('role', 'parent')
      .maybeSingle();

    if (fmErr || !fm) {
      return NextResponse.json(
        { error: 'Tài khoản này chưa phải phụ huynh của gia đình nào — hãy đăng ký tài khoản phụ huynh ở /register trước.' },
        { status: 403 }
      );
    }

    // Sinh email nội bộ cho con: <username>-<8 ký tự đầu family_id>@hocsinh.local
    // — không phải email thật, chỉ để Supabase Auth có 1 định danh duy nhất, học sinh
    // dùng email này để đăng nhập ở /login (không nhận được thư thật gửi tới đây).
    const familyShort = String(fm.family_id).replace(/-/g, '').slice(0, 8);
    const childEmail = `${username}-${familyShort}@hocsinh.local`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: childEmail,
      password,
      email_confirm: true, // không cần xác nhận qua email — đã thống nhất dùng được ngay sau khi tạo
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message?.toLowerCase().includes('already')
        ? `Tên đăng nhập "${username}" đã được dùng trong gia đình này — chọn tên khác.`
        : createErr?.message || 'Tạo tài khoản thất bại.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const childUserId = created.user.id;

    const { error: studentErr } = await admin.from('students').insert({
      id: childUserId,
      family_id: fm.family_id,
      full_name: fullName,
      current_grade: currentGrade,
    });
    if (studentErr) {
      // Dọn lại tài khoản Auth vừa tạo nếu bước lưu hồ sơ học sinh thất bại, tránh để
      // lại 1 tài khoản đăng nhập được nhưng không có hồ sơ học sinh (dữ liệu mồ côi).
      await admin.auth.admin.deleteUser(childUserId);
      return NextResponse.json({ error: `Lưu hồ sơ học sinh thất bại: ${studentErr.message}` }, { status: 500 });
    }

    const { error: fmInsertErr } = await admin.from('family_members').insert({
      family_id: fm.family_id,
      user_id: childUserId,
      role: 'student',
    });
    if (fmInsertErr) {
      await admin.auth.admin.deleteUser(childUserId);
      await admin.from('students').delete().eq('id', childUserId);
      return NextResponse.json({ error: `Gắn học sinh vào gia đình thất bại: ${fmInsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, loginEmail: childEmail });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
