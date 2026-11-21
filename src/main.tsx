import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Predict from './pages/Predict';
import Guide from './pages/Guide';
import './index.css';

const NAV_ITEMS = [
  { to: '/', label: '실시간', icon: '⏱️', end: true },
  { to: '/predict', label: '예측', icon: '🔮', end: false },
  { to: '/guide', label: '이용안내', icon: 'ℹ️', end: false },
];

function App() {
  return (
    <BrowserRouter basename="/ksponco-goldentime">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <strong className="app-title">올팍 골든타임</strong>
        <nav className="app-nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </main>
      <footer className="app-footer">
        출처: 한국체육산업개발(주) 실시간 주차현황 · 올림픽공원 홈페이지 · 공공데이터포털(예측
        데이터 활용 신청 중)
      </footer>
    </BrowserRouter>
  );
}

// GitHub Pages SPA 폴백 복원: public/404.html이 ?r=<원래 pathname+search>로
// 루트를 다시 서빙하면, 라우터가 마운트되기 전에 원래 URL을 복원한다.
{
  const r = new URLSearchParams(window.location.search).get('r');
  if (r && r.startsWith('/')) {
    window.history.replaceState(null, '', r);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
