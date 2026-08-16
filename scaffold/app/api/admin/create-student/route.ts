// [ADMIN] Tạo tài khoản đăng nhập cho 1 học sinh, gắn vào 1 gia đình đã có sẵn (do admin
// chọn — 1 gia đình có thể có nhiều học sinh, mỗi học sinh gọi route này 1 lần). Chỉ tài
// khoản role = 'admin' mới gọi được.
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, familyId, fullName, currentGrade, username, password } = body || {};

    const auth = await verifyAdmin(accessToken);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    if (!familyId || !fullName || !currentGrade || !username || !password) {
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

    const { data: family, error: familyLookupErr } = await admin
      .from('families')
      .select('id')
      .eq('id', familyId)
      .maybeSingle();
    if (familyLookupErr || !family) {
      return NextResponse.json({ error: 'Không tìm thấy gia đình này.' }, { status: 404 });
    }

    // Email nội bộ, không phải email thật — dùng để đăng nhập ở /login, không nhận thư thật.
    const familyShort = String(familyId).replace(/-/g, '').slice(0, 8);
    const childEmail = `${username}-${familyShort}@hocsinh.local`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: childEmail,
      password,
      email_confirm: true,
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
      family_id: familyId,
      full_name: fullName,
      current_grade: currentGrade,
    });
    if (studentErr) {
      await admin.auth.admin.deleteUser(childUserId);
      return NextResponse.json({ error: `Lưu hồ sơ học sinh thất bại: ${studentErr.message}` }, { status: 500 });
    }

    const { error: fmInsertErr } = await admin.from('family_members').insert({
      family_id: familyId,
      user_id: childUserId,
      role: 'student',
    });
    if (fmInsertErr) {
      await admin.auth.admin.deleteUser(childUserId);
      await admin.from('students').delete().eq('id', childUserId);
      return NextResponse.json({ error: `Gắn học sinh vào gia đình thất bại: ${fmInsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, loginEmail: childEmail, studentId: childUserId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
