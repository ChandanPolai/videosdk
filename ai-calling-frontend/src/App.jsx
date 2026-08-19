import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/Dashboard';
import CallsPage from './pages/Calls';
import RoomsPage from './pages/Rooms';
import SessionsPage from './pages/Sessions';
import RecordingsPage from './pages/Recordings';
import TestCallPage from './pages/TestCall';
import AgentScriptPage from './pages/AgentScript';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/test-call" element={<TestCallPage />} />
        <Route path="/agent-script" element={<AgentScriptPage />} />
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/recordings" element={<RecordingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
