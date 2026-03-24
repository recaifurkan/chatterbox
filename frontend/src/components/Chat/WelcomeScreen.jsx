export default function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 text-center px-8">
      <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Chatterbox'a Hoş Geldiniz!</h2>
      <p className="text-gray-400 max-w-md leading-relaxed">
        Bir sohbet odası seçerek veya yeni bir oda oluşturarak mesajlaşmaya başlayın.
        Gerçek zamanlı, güvenli ve hızlı iletişim için hazır.
      </p>
      <div className="grid grid-cols-3 gap-4 mt-8 text-sm text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">💬</span>
          <span>Gerçek Zamanlı</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">🔒</span>
          <span>Güvenli</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">📱</span>
          <span>Mobil Uyumlu</span>
        </div>
      </div>
    </div>
  );
}

