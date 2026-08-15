'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { speak } from '@/lib/speech';

export default function LessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);

  // Trạng thái làm bài kiểm tra cuối bài
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loginTime] = useState(() => new Date().toISOString());

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setStudentId(session.user.id);

      const [lessonRes, flashRes, blockRes, exRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', params.id).single(),
        supabase.from('flashcard_items').select('*').eq('lesson_id', params.id).order('order_index'),
        supabase.from('content_blocks').select('*').eq('lesson_id', params.id).order('order_index'),
        supabase.from('exercises').select('*').eq('lesson_id', params.id).order('order_index'),
      ]);

      // Gom lỗi thật của từng truy vấn (nếu có) để hiện thẳng lên màn hình,
      // thay vì âm thầm coi như không có gì và chỉ hiện danh sách rỗng.
      const errors = [lessonRes, flashRes, blockRes, exRes]
        .map((r, i) => (r.error ? `[${['lessons', 'flashcard_items', 'content_blocks', 'exercises'][i]}] ${r.error.message}` : null))
        .filter(Boolean);
      if (errors.length > 0) setLoadError(errors.join(' | '));

      setLesson(lessonRes.data);
      setFlashcards(flashRes.data || []);
      setBlocks(blockRes.data || []);
      setExercises(exRes.data || []);
      setLoading(false);
    }
    load();
  }, [params.id]);

  const quizItems = exercises.filter((e) => e.exercise_group === 'final_quiz' && e.type === 'quiz' && e.options);
  const practiceItems = exercises.filter((e) => e.exercise_group === 'practice');

  async function submitQuiz() {
    setSaveError(null);
    let score = 0;
    for (const q of quizItems) {
      if (selected[q.id] === q.answer_key?.correct) score++;
    }
    const total = quizItems.length;
    setResult({ score, total });

    if (total === 0) {
      setSaveError('Không có câu hỏi trắc nghiệm nào để chấm — không có gì để lưu.');
      return;
    }
    if (!studentId) {
      setSaveError('Không xác định được học sinh đang đăng nhập — chưa lưu được.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('study_sessions').insert({
      student_id: studentId,
      lesson_id: params.id,
      login_time: loginTime,
      logout_time: new Date().toISOString(),
      quiz_score: Math.round((score / total) * 100),
    });
    setSaving(false);
    if (error) setSaveError(`Lưu thất bại: ${error.message}`);
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <a href="/home">← Quay lại danh sách bài học</a>

      {loadError && (
        <p style={{ background: '#fee', color: '#900', padding: 8, marginTop: 12 }}>
          ⚠️ Lỗi khi tải dữ liệu bài học: {loadError}
        </p>
      )}

      {!lesson ? (
        <p>Không tìm thấy bài học (kiểm tra lại `id` trên đường dẫn, hoặc bài chưa ở trạng thái "published").</p>
      ) : (
        <>
          {/* Bước 1: Khởi động */}
          <h1>{lesson.title}</h1>
          {lesson.mascot_intro_text && (
            <p>
              <em>{lesson.mascot_intro_text}</em>{' '}
              <button onClick={() => speak(lesson.mascot_intro_text, lesson.mascot_intro_audio_url)}>🔊</button>
            </p>
          )}

          {/* Bước 3: Từ vựng mới */}
          <h2>Từ vựng ({flashcards.length})</h2>
          {flashcards.map((f) => (
            <div key={f.id} style={{ marginBottom: 6 }}>
              {f.image_url && <img src={f.image_url} alt={f.term} width={60} style={{ verticalAlign: 'middle', marginRight: 8 }} />}
              <strong>{f.term}</strong> {f.phonetic} — {f.meaning}{' '}
              <button onClick={() => speak(f.term, f.audio_url)}>🔊</button>
            </div>
          ))}

          {/* Bước 5: Mẫu câu */}
          <h2>Mẫu câu</h2>
          {blocks
            .filter((b) => b.block_type === 'sentence_pattern')
            .map((b) => (
              <p key={b.id}>
                <strong>{b.text_content}</strong> — {b.text_translation}{' '}
                <button onClick={() => speak(b.text_content, b.audio_url)}>🔊</button>
              </p>
            ))}

          {/* Bước 6: Truyện tranh */}
          <h2>Truyện tranh</h2>
          {blocks
            .filter((b) => b.block_type === 'story_panel')
            .map((b) => (
              <div key={b.id} style={{ marginBottom: 12 }}>
                {b.image_url && <img src={b.image_url} width={200} />}
                <p>
                  {b.text_content} <button onClick={() => speak(b.text_content, b.audio_url)}>🔊</button>
                </p>
              </div>
            ))}

          {/* Bước 7-8: Luyện tập — CHƯA có UI chấm tự động cho các loại này, làm ở giai đoạn sau */}
          <h2>Luyện tập ({practiceItems.length})</h2>
          <p style={{ color: '#888', fontStyle: 'italic' }}>
            Phần này hiện chỉ hiển thị đề bài, chưa bấm/chọn làm được — sẽ hoàn thiện dần cho từng loại bài tập.
          </p>
          {practiceItems.map((e) => (
            <div key={e.id} style={{ marginBottom: 8, opacity: 0.6 }}>
              <p>{e.prompt_text}</p>
            </div>
          ))}

          {/* Bước 10: Kiểm tra cuối bài — chấm điểm thật + lưu kết quả */}
          <h2>Kiểm tra cuối bài ({quizItems.length} câu trắc nghiệm)</h2>
          {quizItems.length === 0 && (
            <p style={{ color: '#900' }}>
              Không tìm thấy câu hỏi trắc nghiệm nào cho bài này (tổng số bài tập tải được: {exercises.length}).
            </p>
          )}
          {quizItems.map((q) => (
            <div key={q.id} style={{ marginBottom: 12 }}>
              <p>{q.prompt_text}</p>
              {(q.options as string[]).map((opt) => (
                <label key={opt} style={{ display: 'block' }}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    disabled={!!result}
                    checked={selected[q.id] === opt}
                    onChange={() => setSelected((prev) => ({ ...prev, [q.id]: opt }))}
                  />{' '}
                  {opt}
                </label>
              ))}
            </div>
          ))}
          {!result ? (
            <button
              onClick={submitQuiz}
              disabled={quizItems.length === 0 || Object.keys(selected).length < quizItems.length || saving}
            >
              {saving ? 'Đang lưu...' : 'Nộp bài'}
            </button>
          ) : (
            <>
              <p>
                Kết quả: <strong>{result.score}/{result.total}</strong> câu đúng.
              </p>
              {saveError ? (
                <p style={{ color: '#900' }}>❌ {saveError}</p>
              ) : (
                <p style={{ color: '#090' }}>✅ Đã lưu vào hệ thống.</p>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
