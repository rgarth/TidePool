import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { HomePage } from './pages/HomePage';
import { HostPage } from './pages/HostPage';
import { HostHubPage } from './pages/HostHubPage';
import { JoinPage } from './pages/JoinPage';
import { SessionPage } from './pages/SessionPage';
import { PrivacyPage } from './pages/PrivacyPage';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/u/:username" element={<HostHubPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:sessionId" element={<JoinPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
      <Analytics scriptSrc="/va/script.js" />
    </div>
  );
}

export default App;

