// [ADMIN] Tạo 1 gia đình mới + tài khoản đăng nhập cho phụ huynh. Chỉ tài khoản có
// role = 'admin' trong bảng staff mới gọi được (kiểm tra trong verifyAdmin).
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, parentEmail, parentPassword } = body || {};

    const auth = await verifyAdmin(accessToken);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    if (!parentEmail || !parentPassword) {
      return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu phụ huynh.' }, { status: 400 });
    }
    if (String(parentPassword).length < 6) {
      return NextResponse.json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' }, { status: 400 });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message?.toLowerCase().includes('already')
        ? `Email "${parentEmail}" đã có tài khoản trong hệ thống.`
        : createErr?.message || 'Tạo tài khoản phụ huynh thất bại.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const parentUserId = created.user.id;

    const { data: family, error: familyErr } = await admin.from('families').insert({}).select('id').single();
    if (familyErr || !family) {
      await admin.auth.admin.deleteUser(parentUserId);
      return NextResponse.json({ error: `Tạo gia đình thất bại: ${familyErr?.message}` }, { status: 500 });
    }

    const { error: fmErr } = await admin
      .from('family_members')
      .insert({ family_id: family.id, user_id: parentUserId, role: 'parent' });
    if (fmErr) {
      await admin.auth.admin.deleteUser(parentUserId);
      await admin.from('families').delete().eq('id', family.id);
      return NextResponse.json({ error: `Gắn phụ huynh vào gia đình thất bại: ${fmErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, familyId: family.id, parentEmail });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
