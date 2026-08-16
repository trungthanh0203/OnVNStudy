// [ADMIN] Trả về toàn bộ dữ liệu cho trang /admin: danh sách gia đình, kèm phụ huynh
// (email lấy qua admin.auth.admin.getUserById vì bảng auth.users không truy vấn trực
// tiếp qua .from() được), danh sách học sinh + lịch sử đăng ký học của từng em, và danh
// sách khối lớp để hiển thị dropdown. Chỉ admin gọi được — gia đình/học sinh của người
// khác không lộ ra cho ai khác ngoài admin vì route này luôn kiểm tra role trước.
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken } = body || {};

    const auth = await verifyAdmin(accessToken);
    if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    const [familiesRes, membersRes, studentsRes, enrollmentsRes, gradesRes] = await Promise.all([
      admin.from('families').select('id, created_at').order('created_at'),
      admin.from('family_members').select('id, family_id, user_id, role'),
      admin.from('students').select('id, family_id, full_name, current_grade, archived'),
      admin.from('enrollments').select('id, student_id, grade_id, school_year, semester, price, payment_status'),
      admin.from('grades').select('id, name, level').order('level'),
    ]);

    const firstErr =
      familiesRes.error || membersRes.error || studentsRes.error || enrollmentsRes.error || gradesRes.error;
    if (firstErr) {
      return NextResponse.json({ error: `Lỗi khi tải dữ liệu: ${firstErr.message}` }, { status: 500 });
    }

    const members = membersRes.data || [];
    const parentMembers = members.filter((m: any) => m.role === 'parent');
    const emailById: Record<string, string> = {};
    await Promise.all(
      parentMembers.map(async (m: any) => {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        if (data?.user?.email) emailById[m.user_id] = data.user.email;
      })
    );

    const students = studentsRes.data || [];
    const enrollments = enrollmentsRes.data || [];

    const families = (familiesRes.data || []).map((f: any) => ({
      id: f.id,
      createdAt: f.created_at,
      parents: parentMembers
        .filter((m: any) => m.family_id === f.id)
        .map((m: any) => ({ userId: m.user_id, email: emailById[m.user_id] || '(không rõ)' })),
      students: students
        .filter((s: any) => s.family_id === f.id)
        .map((s: any) => ({
          ...s,
          enrollments: enrollments.filter((e: any) => e.student_id === s.id),
        })),
    }));

    return NextResponse.json({ ok: true, families, grades: gradesRes.data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
