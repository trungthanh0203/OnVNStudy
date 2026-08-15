// Đọc to một đoạn tiếng Anh bằng giọng nói có sẵn trong trình duyệt (Web Speech API).
// Miễn phí, không cần dịch vụ ngoài, không cần chuẩn bị file âm thanh trước.
//
// Nếu sau này muốn dùng giọng đọc riêng đã thu âm sẵn cho vài chỗ đặc biệt
// (ví dụ giọng cố định của linh vật), truyền thêm audioUrl — hàm sẽ ưu tiên
// phát file đó thay vì đọc bằng máy.

export function speak(text: string, audioUrl?: string | null) {
  if (audioUrl) {
    new Audio(audioUrl).play();
    return;
  }
  if (!('speechSynthesis' in window)) {
    console.warn('Trình duyệt này chưa hỗ trợ đọc chữ tự động.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;   // đọc chậm hơn bình thường một chút, phù hợp trẻ mới học
  speechSynthesis.speak(utterance);
}
