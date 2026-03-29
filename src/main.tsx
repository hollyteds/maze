import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Reactアプリのエントリポイント。index.html の #root に App をマウントする。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
