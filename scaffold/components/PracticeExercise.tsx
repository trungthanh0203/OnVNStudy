'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { speak } from '@/lib/speech';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// 7 loại đã chấm điểm được. Còn lại (vd 'drag_drop') tạm hiện placeholder "để giai đoạn sau".
const SUPPORTED_TYPES = [
  'translate_write',
  'phonetic_match',
  'match_meaning',
  'flashcard_match',
  'listen_choose',
  'dialogue_complete',
  'creative_write',
];

export default function PracticeExercise({
  exercise,
  studentId,
  refFlashcards = [],
  lessonFlashcards = [],
}: {
  exercise: any;
  studentId: string | null;
  // Thẻ ghi nhớ đã gán riêng cho bài tập này qua bảng exercise_flashcard_refs — dùng cho type 'flashcard_match'.
  refFlashcards?: any[];
  // Toàn bộ từ vựng của bài học — dùng để TỰ TẠO bài nghe-chọn-nghĩa cho 'listen_choose' khi bài
  // chưa có answer_key soạn sẵn (xem giải thích bên dưới).
  lessonFlashcards?: any[];
}) {
  const supabase = createClient();

  // Khai báo TOÀN BỘ hook ở đây, gọi vô điều kiện mỗi lần render (đúng Rules of Hooks của React) —
  // các nhánh "chưa chấm được"/"chưa có dữ liệu" bên dưới chỉ đổi phần return JSX, không đổi số hook.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false); // riêng cho creative_write: không có điểm, chỉ có "đã nộp"
  const [essay, setEssay] = useState('');

  // listen_choose khi CHƯA có answer_key soạn sẵn: tự chọn ngẫu nhiên tối đa 4 từ trong chính bài học
  // để tạo bài "nghe từ - chọn nghĩa". Chọn 1 lần khi mở bài (không chọn lại mỗi lần render) để câu hỏi
  // không đổi giữa chừng lúc học sinh đang làm.
  const isAutoListenFromVocab = exercise.type === 'listen_choose' && !exercise.answer_key;
  const [listenPool] = useState<any[]>(() => (isAutoListenFromVocab ? shuffle(lessonFlashcards).slice(0, 4) : []));

  // --- Chuẩn hoá "keys" (mỗi câu hỏi/thẻ) và "choicePool" (các đáp án đưa vào ô chọn) theo từng loại ---
  let keys: string[] = [];
  let answerFor: (k: string) => string | undefined = () => undefined;
  let choicePool: string[] = [];
  let isFreeText = false; // true => ô nhập chữ (gõ tay), false => ô chọn (select)
  let isListen = false; // true => hiện nút 🔊 thay vì hiện sẵn chữ tiếng Anh

  if (exercise.type === 'translate_write') {
    keys = Object.keys(exercise.answer_key || {});
    answerFor = (k) => exercise.answer_key?.[k];
    isFreeText = true;
  } else if (exercise.type === 'dialogue_complete' && exercise.answer_key) {
    // Quy ước: answer_key là { "nhãn chỗ trống": "câu trả lời đúng đầy đủ" }, ví dụ
    // { "B (lượt 1)": "Hi! I'm Lan.", "B (lượt 2)": "My name is Lan." } — cùng khuôn với translate_write.
    keys = Object.keys(exercise.answer_key || {});
    answerFor = (k) => exercise.answer_key?.[k];
    isFreeText = true;
  } else if (exercise.type === 'match_meaning') {
    keys = (exercise.options as string[]) || [];
    answerFor = (k) => exercise.answer_key?.[k];
    choicePool = Object.values(exercise.answer_key || {}) as string[];
  } else if (exercise.type === 'phonetic_match') {
    keys = Object.keys(exercise.answer_key || {});
    answerFor = (k) => exercise.answer_key?.[k];
    choicePool = Object.values(exercise.answer_key || {}) as string[];
  } else if (exercise.type === 'flashcard_match') {
    keys = refFlashcards.map((f) => f.term);
    answerFor = (k) => refFlashcards.find((f) => f.term === k)?.meaning;
    choicePool = refFlashcards.map((f) => f.meaning);
  } else if (exercise.type === 'listen_choose' && exercise.answer_key) {
    // Nội dung đã soạn sẵn answer_key (vd nghe cả câu hội thoại) — key chính là câu/từ tiếng Anh cần nghe.
    keys = Object.keys(exercise.answer_key || {});
    answerFor = (k) => exercise.answer_key?.[k];
    choicePool = Object.values(exercise.answer_key || {}) as string[];
    isListen = true;
  } else if (isAutoListenFromVocab) {
    keys = listenPool.map((f: any) => f.term);
    answerFor = (k) => listenPool.find((f: any) => f.term === k)?.meaning;
    choicePool = listenPool.map((f: any) => f.meaning);
    isListen = true;
  }

  const [choices] = useState<string[]>(() => shuffle(choicePool)); // xáo trộn 1 lần, không xáo lại mỗi lần chọn

  function isCorrect(k: string) {
    const expected = answerFor(k);
    const given = inputs[k] ?? '';
    if (isFreeText) {
      return given.trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
    }
    return given === expected;
  }

  async function check() {
    let correct = 0;
    for (const k of keys) if (isCorrect(k)) correct++;
    setResult({ correct, total: keys.length });

    if (studentId) {
      setSaving(true);
      await supabase.from('exercise_attempts').insert({
        student_id: studentId,
        exercise_id: exercise.id,
        given_answer: inputs,
        correct_count: correct,
        total_count: keys.length,
      });
      setSaving(false);
    }
  }

  async function submitEssay() {
    setSaving(true);
    if (studentId) {
      await supabase.from('exercise_attempts').insert({
        student_id: studentId,
        exercise_id: exercise.id,
        given_answer: { text: essay },
        correct_count: null, // không áp dụng — bài này giáo viên chấm tay, không có điểm tự động
        total_count: null,
      });
    }
    setSaving(false);
    setSubmitted(true);
  }

  // ---------------------------------------------------------------------
  // Từ đây trở xuống chỉ là các nhánh JSX khác nhau — không còn hook nào nữa.
  // ---------------------------------------------------------------------

  if (!SUPPORTED_TYPES.includes(exercise.type)) {
    return (
      <div style={{ marginBottom: 8, opacity: 0.6 }}>
        <p>{exercise.prompt_text}</p>
        <p style={{ fontSize: 12, color: '#888' }}>(Loại bài này chưa làm được, để giai đoạn sau)</p>
      </div>
    );
  }

  if (exercise.type === 'creative_write') {
    return (
      <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
        <p>
          <strong>{exercise.prompt_text}</strong>
        </p>
        <textarea
          rows={4}
          style={{ width: '100%' }}
          disabled={submitted}
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
        />
        {!submitted ? (
          <button onClick={submitEssay} disabled={!essay.trim() || saving}>
            {saving ? 'Đang nộp...' : 'Nộp bài'}
          </button>
        ) : (
          <p style={{ color: '#090' }}>✅ Đã nộp — chờ giáo viên chấm.</p>
        )}
      </div>
    );
  }

  if (exercise.type === 'dialogue_complete' && !exercise.answer_key) {
    return (
      <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6, opacity: 0.7 }}>
        <p>
          <strong>{exercise.prompt_text}</strong>
        </p>
        <p style={{ fontSize: 12, color: '#888' }}>
          (Bài này chưa có đáp án mẫu trong nội dung — chưa chấm điểm tự động được. Cần đội ngũ nội dung bổ sung
          `answer_key` cho bài tập này, dạng {'{ "nhãn chỗ trống": "câu trả lời đúng" }'}.)
        </p>
      </div>
    );
  }

  if (exercise.type === 'flashcard_match' && refFlashcards.length === 0) {
    return (
      <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6, opacity: 0.7 }}>
        <p>
          <strong>{exercise.prompt_text}</strong>
        </p>
        <p style={{ fontSize: 12, color: '#888' }}>
          (Chưa có thẻ ghi nhớ nào được gán cho bài tập này trong bảng `exercise_flashcard_refs`.)
        </p>
      </div>
    );
  }

  if (isAutoListenFromVocab && listenPool.length === 0) {
    return (
      <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6, opacity: 0.7 }}>
        <p>
          <strong>{exercise.prompt_text}</strong>
        </p>
        <p style={{ fontSize: 12, color: '#888' }}>(Bài học chưa có từ vựng để tạo bài nghe.)</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <p>
        <strong>{exercise.prompt_text}</strong>
      </p>
      {keys.map((k, i) => (
        <div key={k} style={{ marginBottom: 6 }}>
          {isListen ? (
            <>
              <button type="button" onClick={() => speak(k)}>
                🔊 Nghe #{i + 1}
              </button>{' '}
              {result && <span style={{ marginRight: 8 }}>({k})</span>}
            </>
          ) : (
            <>{k} → </>
          )}
          {isFreeText ? (
            <input
              type="text"
              disabled={!!result}
              value={inputs[k] || ''}
              onChange={(e) => setInputs((prev) => ({ ...prev, [k]: e.target.value }))}
            />
          ) : (
            <select
              disabled={!!result}
              value={inputs[k] || ''}
              onChange={(e) => setInputs((prev) => ({ ...prev, [k]: e.target.value }))}
            >
              <option value="">-- chọn --</option>
              {choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {result && (
            <span style={{ marginLeft: 8, color: isCorrect(k) ? 'green' : 'red' }}>
              {isCorrect(k) ? '✓' : `✗ (đúng: ${answerFor(k)})`}
            </span>
          )}
        </div>
      ))}
      {!result ? (
        <button onClick={check} disabled={Object.keys(inputs).length < keys.length || saving}>
          {saving ? 'Đang kiểm tra...' : 'Kiểm tra'}
        </button>
      ) : (
        <p>
          Kết quả: {result.correct}/{result.total} đúng
        </p>
      )}
    </div>
  );
}
