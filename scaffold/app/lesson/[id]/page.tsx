// Trang học 1 bài — ví dụ tối giản cho thấy cách đọc dữ liệu theo đúng schema
// đã thiết kế (lessons + content_blocks + flashcard_items + exercises).
// Đây là khung sườn để phát triển tiếp giao diện thật theo khung 11 bước
// trong file khung-chuong-trinh-tieng-anh-lop1-5.md (mục III).

import { createClient } from '@/lib/supabase';

export default async function LessonPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: lesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', params.id)
    .single();

  const { data: flashcards } = await supabase
    .from('flashcard_items')
    .select('*')
    .eq('lesson_id', params.id)
    .order('order_index');

  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('lesson_id', params.id)
    .order('order_index');

  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .eq('lesson_id', params.id)
    .order('order_index');

  if (!lesson) return <div>Không tìm thấy bài học.</div>;

  return (
    <main>
      {/* Bước 1: Khởi động — linh vật + audio */}
      <section>
        <h1>{lesson.title}</h1>
        {lesson.mascot_intro_audio_url && (
          <audio controls src={lesson.mascot_intro_audio_url} />
        )}
      </section>

      {/* Bước 3: Từ vựng mới — thẻ hình + audio bấm nghe lại */}
      <section>
        <h2>Từ vựng</h2>
        {flashcards?.map((f) => (
          <div key={f.id}>
            {f.image_url && <img src={f.image_url} alt={f.term} width={80} />}
            <strong>{f.term}</strong> {f.phonetic} — {f.meaning}
            {f.audio_url && (
              <button onClick={() => new Audio(f.audio_url).play()}>🔊</button>
            )}
          </div>
        ))}
      </section>

      {/* Bước 5-6: Mẫu câu + Truyện tranh — cùng lấy từ content_blocks,
          phân biệt bằng block_type */}
      <section>
        <h2>Mẫu câu</h2>
        {blocks
          ?.filter((b) => b.block_type === 'sentence_pattern')
          .map((b) => (
            <p key={b.id}>
              <strong>{b.text_content}</strong> — {b.text_translation}
              {b.audio_url && (
                <button onClick={() => new Audio(b.audio_url).play()}>🔊</button>
              )}
            </p>
          ))}
      </section>

      <section>
        <h2>Truyện tranh</h2>
        {blocks
          ?.filter((b) => b.block_type === 'story_panel')
          .map((b) => (
            <div key={b.id}>
              {b.image_url && <img src={b.image_url} width={200} />}
              <p>{b.text_content}</p>
            </div>
          ))}
      </section>

      {/* Bước 7-8: Luyện tập — render theo exercise.type,
          mỗi loại (flashcard_match, translate_write, phonetic_match...)
          cần 1 component riêng, đây chỉ là khung để thấy cách lấy dữ liệu */}
      <section>
        <h2>Luyện tập</h2>
        {exercises
          ?.filter((e) => e.exercise_group === 'practice')
          .map((e) => (
            <div key={e.id}>
              <p>{e.prompt_text}</p>
              {/* TODO: render đúng UI theo e.type */}
            </div>
          ))}
      </section>

      {/* Bước 10: Kiểm tra cuối bài */}
      <section>
        <h2>Kiểm tra cuối bài</h2>
        {exercises
          ?.filter((e) => e.exercise_group === 'final_quiz')
          .map((e) => (
            <div key={e.id}>
              <p>{e.prompt_text}</p>
              {/* TODO: render đúng UI theo e.type, ghi kết quả vào study_sessions khi xong */}
            </div>
          ))}
      </section>
    </main>
  );
}
