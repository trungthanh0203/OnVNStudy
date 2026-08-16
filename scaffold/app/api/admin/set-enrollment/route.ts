// [ADMIN] Cấp quyền học cho 1 học sinh: tạo 1 dòng enrollments (khối lớp + năm học + học
// kỳ + học phí + trạng thái thanh toán), rồi tự động gắn hết các môn của khối đó (đúng
// quy tắc cấp 1-2: tự động toàn bộ môn, không cần chọn tay từng môn — xem
// HUONG-DAN-TRIEN-KHAI.md phần "Nội dung học nằm trong database"). Chỉ admin gọi được.
// Mỗi lần gọi tạo 1 dòng enrollment MỚI (không sửa dòng cũ) — muốn xem lịch sử đăng ký
// học của 1 học sinh, xem trực tiếp bảng enrollments trong Supabase.
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, studentId, gradeId, schoolYear, semester, price, paymentStatus } = body || {};

    const auth = await verifyAdmin(accessToken);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    if (!studentId || !gradeId || !schoolYear || !semester) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc (học sinh / khối lớp / năm học / học kỳ).' },
        { status: 400 }
      );
    }
    if (!['hk1', 'hk2'].includes(semester)) {
      return NextResponse.json({ error: 'Học kỳ không hợp lệ.' }, { status: 400 });
    }

    const { data: student, error: studentLookupErr } = await admin
      .from('students')
      .select('id')
      .eq('id', studentId)
      .maybeSingle();
    if (studentLookupErr || !student) {
      return NextResponse.json({ error: 'Không tìm thấy học sinh này.' }, { status: 404 });
    }

    const { data: enrollment, error: enrollErr } = await admin
      .from('enrollments')
      .insert({
        student_id: studentId,
        grade_id: gradeId,
        school_year: schoolYear,
        semester,
        price: price || null,
        payment_status: paymentStatus || 'pending',
      })
      .select('id')
      .single();
    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: `Tạo đăng ký học thất bại: ${enrollErr?.message}` }, { status: 500 });
    }

    const { data: gradeSubjects, error: gsErr } = await admin
      .from('grade_subjects')
      .select('subject_id')
      .eq('grade_id', gradeId);
    if (gsErr) {
      return NextResponse.json(
        { error: `Đăng ký học đã tạo (mã ${enrollment.id}) nhưng gắn môn học thất bại: ${gsErr.message}` },
        { status: 500 }
      );
    }
    if (gradeSubjects && gradeSubjects.length > 0) {
      const rows = gradeSubjects.map((gs: any) => ({ enrollment_id: enrollment.id, subject_id: gs.subject_id }));
      const { error: esErr } = await admin.from('enrollment_subjects').insert(rows);
      if (esErr) {
        return NextResponse.json(
          { error: `Đăng ký học đã tạo (mã ${enrollment.id}) nhưng gắn môn học thất bại: ${esErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, enrollmentId: enrollment.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
