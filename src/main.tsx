import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 見出し・数字用のフォント（日本語も含む。使う文字の分だけ読み込まれます）
import '@fontsource/dela-gothic-one/latin.css';
import '@fontsource/dela-gothic-one/japanese.css';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// オフラインでも遊べるようにする（公開版だけ）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
