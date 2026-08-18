import React, { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/Dashboard';
import CallsPage from './pages/Calls';
import RoomsPage from './pages/Rooms';
import SessionsPage from './pages/Sessions';
import RecordingsPage from './pages/Recordings';
import TestCallPage from './pages/TestCall';
import AgentScriptPage from './pages/AgentScript';

const DashboardShell = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [recordingFocus, setRecordingFocus] = useState(null);

  const openRecordings = useCallback((focus) => {
    setRecordingFocus(focus || null);
    setActiveTab('recordings');
  }, []);

  const consumeRecordingFocus = useCallback(() => {
    setRecordingFocus(null);
  }, []);

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onOpenCalls={() => setActiveTab('calls')} />;
      case 'test-call':
        return <TestCallPage />;
      case 'agent-script':
        return <AgentScriptPage />;
      case 'rooms':
        return <RoomsPage />;
      case 'sessions':
        return <SessionsPage onOpenRecordings={openRecordings} />;
      case 'recordings':
        return <RecordingsPage focus={recordingFocus} onFocusConsumed={consumeRecordingFocus} />;
      case 'calls':
        return <CallsPage />;
      default:
        return <DashboardPage onOpenCalls={() => setActiveTab('calls')} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderView()}
    </Layout>
  );
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<DashboardShell />} />
      <Route path="/dashboard" element={<DashboardShell />} />
      <Route path="/test-call" element={<DashboardShell />} />
      <Route path="/agent-script" element={<DashboardShell />} />
      <Route path="/calls" element={<DashboardShell />} />
      <Route path="/rooms" element={<DashboardShell />} />
      <Route path="/sessions" element={<DashboardShell />} />
      <Route path="/recordings" element={<DashboardShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
