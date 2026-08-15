'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const SUPPORTED_TYPES = ['translate_write', 'phonetic_match', 'match_meaning'];

export default function PracticeExercise({ exercise, studentId }: { exercise: any; studentId: string | null }) {
  const supabase = createClient();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!SUPPORTED_TYPES.includes(exercise.type)) {
    return (
      <div style={{ marginBottom: 8, opacity: 0.6 }}>
        <p>{exercise.prompt_text}</p>
        <p style={{ fontSize: 12, color: '#888' }}>(Loại bài này chưa làm được, để giai đoạn sau)</p>
      </div>
    );
  }

  // translate_write: các "chìa khóa" là nghĩa tiếng Việt, người học tự gõ từ tiếng Anh
  // match_meaning: các "chìa khóa" là danh sách câu hỏi/câu mở đầu (options)
  // phonetic_match: các "chìa khóa" là từ tiếng Anh, cần chọn đúng phiên âm
  const keys = exercise.type === 'match_meaning' ? (exercise.options as string[]) : Object.keys(exercise.answer_key || {});

  // Với 2 loại chọn (không phải gõ chữ), chuẩn bị sẵn danh sách đáp án xáo trộn để chọn
  const choices =
    exercise.type !== 'translate_write' ? shuffle(Object.values(exercise.answer_key || {}) as string[]) : null;

  function isCorrect(k: string) {
    const expected = exercise.answer_key?.[k];
    const given = inputs[k] ?? '';
    if (exercise.type === 'translate_write') {
      return given.trim().toLowerCase() === String(expected).trim().toLowerCase();
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

  return (
    <div style={{ marginBottom: 16, border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <p>
        <strong>{exercise.prompt_text}</strong>
      </p>
      {keys.map((k) => (
        <div key={k} style={{ marginBottom: 6 }}>
          {k} →{' '}
          {exercise.type === 'translate_write' ? (
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
              {choices!.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {result && (
            <span style={{ marginLeft: 8, color: isCorrect(k) ? 'green' : 'red' }}>
              {isCorrect(k) ? '✓' : `✗ (đúng: ${exercise.answer_key?.[k]})`}
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
