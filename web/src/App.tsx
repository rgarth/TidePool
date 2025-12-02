import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { HomePage } from './pages/HomePage';
import { HostPage } from './pages/HostPage';
import { JoinPage } from './pages/JoinPage';
import { SessionPage } from './pages/SessionPage';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:sessionId" element={<JoinPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
      </Routes>
      <Analytics />
    </div>
  );
}

export default App;

