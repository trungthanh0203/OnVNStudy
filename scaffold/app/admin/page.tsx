'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const SEMESTERS = [
  { value: 'hk1', label: 'Học kỳ 1' },
  { value: 'hk2', label: 'Học kỳ 2' },
];
const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'overdue', label: 'Quá hạn' },
];

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');

  const [families, setFamilies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [overviewError, setOverviewError] = useState('');

  // --- Form: thêm gia đình mới ---
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [familySaving, setFamilySaving] = useState(false);
  const [familyMsg, setFamilyMsg] = useState('');
  const [familyErr, setFamilyErr] = useState('');

  // --- Form: thêm học sinh ---
  const [studentFamilyId, setStudentFamilyId] = useState('');
  const [studentFullName, setStudentFullName] = useState('');
  const [studentGrade, setStudentGrade] = useState('3');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentMsg, setStudentMsg] = useState('');
  const [studentErr, setStudentErr] = useState('');

  // --- Form: cấp quyền học ---
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollGradeId, setEnrollGradeId] = useState('');
  const [enrollSchoolYear, setEnrollSchoolYear] = useState('2026-2027');
  const [enrollSemester, setEnrollSemester] = useState('hk1');
  const [enrollPrice, setEnrollPrice] = useState('');
  const [enrollPaymentStatus, setEnrollPaymentStatus] = useState('pending');
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollErr, setEnrollErr] = useState('');

  async function loadOverview(token: string) {
    setOverviewError('');
    const res = await fetch('/api/admin/overview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token }),
    });
    const data: any = await res.json();
    if (!res.ok) {
      setOverviewError(data.error || 'Không tải được dữ liệu.');
      return;
    }
    setFamilies(data.families || []);
    setGrades(data.grades || []);
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
      const { data: staff } = await supabase.from('staff').select('role').eq('id', session.user.id).maybeSingle();
      if (!staff || staff.role !== 'admin') {
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      setAccessToken(session.access_token);
      await loadOverview(session.access_token);
      setChecking(false);
    }
    init();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    setFamilyErr('');
    setFamilyMsg('');
    if (parentPassword.length < 6) {
      setFamilyErr('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    setFamilySaving(true);
    const res = await fetch('/api/admin/create-family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, parentEmail, parentPassword }),
    });
    const data: any = await res.json();
    setFamilySaving(false);
    if (!res.ok) {
      setFamilyErr(data.error || 'Có lỗi xảy ra.');
      return;
    }
    setFamilyMsg(`✅ Đã tạo gia đình cho phụ huynh ${data.parentEmail}. Giờ thêm học sinh cho gia đình này ở form bên dưới.`);
    setParentEmail('');
    setParentPassword('');
    setStudentFamilyId(data.familyId);
    await loadOverview(accessToken);
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setStudentErr('');
    setStudentMsg('');
    if (!studentFamilyId) {
      setStudentErr('Chọn gia đình trước.');
      return;
    }
    if (studentPassword.length < 6) {
      setStudentErr('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(studentUsername)) {
      setStudentErr('Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới, 3-20 ký tự (ví dụ: be_an).');
      return;
    }
    setStudentSaving(true);
    const res = await fetch('/api/admin/create-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        familyId: studentFamilyId,
        fullName: studentFullName,
        currentGrade: Number(studentGrade),
        username: studentUsername,
        password: studentPassword,
      }),
    });
    const data: any = await res.json();
    setStudentSaving(false);
    if (!res.ok) {
      setStudentErr(data.error || 'Có lỗi xảy ra.');
      return;
    }
    setStudentMsg(
      `✅ Đã tạo tài khoản học sinh. Đăng nhập bằng: ${data.loginEmail} — mật khẩu vừa đặt ở trên. Giờ cấp quyền học ở form bên dưới.`
    );
    setEnrollStudentId(data.studentId);
    setStudentFullName('');
    setStudentUsername('');
    setStudentPassword('');
    await loadOverview(accessToken);
  }

  async function handleSetEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setEnrollErr('');
    setEnrollMsg('');
    if (!enrollStudentId || !enrollGradeId) {
      setEnrollErr('Chọn học sinh và khối lớp trước.');
      return;
    }
    setEnrollSaving(true);
    const res = await fetch('/api/admin/set-enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        studentId: enrollStudentId,
        gradeId: Number(enrollGradeId),
        schoolYear: enrollSchoolYear,
        semester: enrollSemester,
        price: enrollPrice ? Number(enrollPrice) : null,
        paymentStatus: enrollPaymentStatus,
      }),
    });
    const data: any = await res.json();
    setEnrollSaving(false);
    if (!res.ok) {
      setEnrollErr(data.error || 'Có lỗi xảy ra.');
      return;
    }
    setEnrollMsg('✅ Đã cấp quyền học — học sinh vào được các bài học của khối lớp vừa chọn.');
    await loadOverview(accessToken);
  }

  if (checking) return <div style={{ padding: 24 }}>Đang tải...</div>;

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản này không có quyền quản trị.</p>
        <p>
          <a href="/login">← Về trang đăng nhập</a>
        </p>
      </main>
    );
  }

  // Gộp tất cả học sinh của mọi gia đình lại thành 1 danh sách phẳng, để dùng cho dropdown
  // ở form "Cấp quyền học" (chọn học sinh không cần biết trước thuộc gia đình nào).
  const allStudents = families.flatMap((f) =>
    f.students.map((s: any) => ({ ...s, parentEmails: f.parents.map((p: any) => p.email).join(', ') }))
  );

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Quản trị</h1>
        <button onClick={handleLogout}>Đăng xuất</button>
      </div>

      {overviewError && <p style={{ color: 'red' }}>{overviewError}</p>}

      {/* --- Danh sách gia đình --- */}
      <section style={{ marginBottom: 32 }}>
        <h2>Danh sách gia đình ({families.length})</h2>
        {families.length === 0 && <p>Chưa có gia đình nào.</p>}
        {families.map((f) => (
          <div key={f.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, marginBottom: 12 }}>
            <strong>Phụ huynh:</strong> {f.parents.map((p: any) => p.email).join(', ') || '(chưa có)'}
            <ul>
              {f.students.map((s: any) => (
                <li key={s.id} style={{ marginBottom: 4 }}>
                  {s.full_name} — Lớp {s.current_grade}
                  {s.enrollments.length === 0 ? (
                    <span style={{ color: '#900' }}> — chưa được cấp quyền học</span>
                  ) : (
                    <ul>
                      {s.enrollments.map((e: any) => (
                        <li key={e.id} style={{ fontSize: 13, color: '#555' }}>
                          {e.school_year} — {e.semester === 'hk1' ? 'HK1' : 'HK2'} —{' '}
                          {PAYMENT_STATUSES.find((p) => p.value === e.payment_status)?.label || e.payment_status}
                          {e.price ? ` — ${e.price.toLocaleString('vi-VN')}đ` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {f.students.length === 0 && <li>Chưa có học sinh nào.</li>}
            </ul>
          </div>
        ))}
      </section>

      {/* --- Form 1: thêm gia đình mới --- */}
      <section style={{ marginBottom: 32, borderTop: '2px solid #333', paddingTop: 16 }}>
        <h2>1. Thêm gia đình mới (tài khoản phụ huynh)</h2>
        <form onSubmit={handleCreateFamily}>
          <div style={{ marginBottom: 12 }}>
            <label>Email phụ huynh</label>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Đặt mật khẩu cho phụ huynh (ít nhất 6 ký tự)</label>
            <input
              type="text"
              value={parentPassword}
              onChange={(e) => setParentPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={familySaving} style={{ padding: '8px 16px' }}>
            {familySaving ? 'Đang tạo...' : 'Tạo gia đình'}
          </button>
        </form>
        {familyErr && <p style={{ color: 'red' }}>{familyErr}</p>}
        {familyMsg && <p style={{ color: '#0a7a0a' }}>{familyMsg}</p>}
      </section>

      {/* --- Form 2: thêm học sinh --- */}
      <section style={{ marginBottom: 32, borderTop: '2px solid #333', paddingTop: 16 }}>
        <h2>2. Thêm học sinh vào 1 gia đình</h2>
        <form onSubmit={handleCreateStudent}>
          <div style={{ marginBottom: 12 }}>
            <label>Gia đình</label>
            <select
              value={studentFamilyId}
              onChange={(e) => setStudentFamilyId(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">-- Chọn gia đình --</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.parents.map((p: any) => p.email).join(', ') || f.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Tên đầy đủ của học sinh</label>
            <input
              value={studentFullName}
              onChange={(e) => setStudentFullName(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Khối lớp hiện tại</label>
            <select value={studentGrade} onChange={(e) => setStudentGrade(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Tên đăng nhập (chỉ chữ thường/số/gạch dưới, ví dụ: be_an)</label>
            <input
              value={studentUsername}
              onChange={(e) => setStudentUsername(e.target.value.toLowerCase())}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Đặt mật khẩu cho học sinh (ít nhất 6 ký tự)</label>
            <input
              type="text"
              value={studentPassword}
              onChange={(e) => setStudentPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={studentSaving} style={{ padding: '8px 16px' }}>
            {studentSaving ? 'Đang tạo...' : 'Tạo tài khoản học sinh'}
          </button>
        </form>
        {studentErr && <p style={{ color: 'red' }}>{studentErr}</p>}
        {studentMsg && <p style={{ color: '#0a7a0a' }}>{studentMsg}</p>}
      </section>

      {/* --- Form 3: cấp quyền học --- */}
      <section style={{ marginBottom: 32, borderTop: '2px solid #333', paddingTop: 16 }}>
        <h2>3. Cấp quyền học cho 1 học sinh</h2>
        <p style={{ fontSize: 13, color: '#555' }}>
          Dùng sau khi phụ huynh đã đăng ký với tư vấn viên và trả tiền. Chọn đúng khối lớp sẽ tự động cấp toàn bộ
          môn học của khối đó (không cần chọn tay từng môn).
        </p>
        <form onSubmit={handleSetEnrollment}>
          <div style={{ marginBottom: 12 }}>
            <label>Học sinh</label>
            <select
              value={enrollStudentId}
              onChange={(e) => setEnrollStudentId(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">-- Chọn học sinh --</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.parentEmails})
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Khối lớp đăng ký học</label>
            <select
              value={enrollGradeId}
              onChange={(e) => setEnrollGradeId(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">-- Chọn khối lớp --</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Năm học</label>
            <input
              value={enrollSchoolYear}
              onChange={(e) => setEnrollSchoolYear(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Học kỳ</label>
            <select value={enrollSemester} onChange={(e) => setEnrollSemester(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {SEMESTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Học phí (VNĐ, không bắt buộc)</label>
            <input
              type="number"
              value={enrollPrice}
              onChange={(e) => setEnrollPrice(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Trạng thái thanh toán</label>
            <select
              value={enrollPaymentStatus}
              onChange={(e) => setEnrollPaymentStatus(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            >
              {PAYMENT_STATUSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={enrollSaving} style={{ padding: '8px 16px' }}>
            {enrollSaving ? 'Đang lưu...' : 'Cấp quyền học'}
          </button>
        </form>
        {enrollErr && <p style={{ color: 'red' }}>{enrollErr}</p>}
        {enrollMsg && <p style={{ color: '#0a7a0a' }}>{enrollMsg}</p>}
      </section>
    </main>
  );
}
