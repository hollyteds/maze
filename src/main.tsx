import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 既定のbody余白を除去し、全画面レイアウトで意図しないスクロールを防ぐ。
document.body.style.margin = '0';

// Reactアプリのエントリポイント。index.html の #root に App をマウントする。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
