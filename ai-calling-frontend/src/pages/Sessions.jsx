import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Users, Eye, Clapperboard } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchSessions, fetchSessionById, fetchRooms } from '../services/videosdkApi';
import { formatDateTime, formatDuration } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Drawer from '../components/ui/Drawer';

const statusVariant = (status = '') => {
  const s = String(status).toLowerCase();
  if (['ended', 'completed'].includes(s)) return 'success';
  if (['ongoing', 'live', 'active'].includes(s)) return 'warning';
  if (['failed', 'error'].includes(s)) return 'danger';
  return 'info';
};

const shortId = (id = '') => {
  if (!id) return '—';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

const SessionsPage = ({ onOpenRecordings }) => {
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sessionDetail, setSessionDetail] = useState(null);

  useEffect(() => {
    const loadRooms = async () => {
      setRoomsLoading(true);
      try {
        const res = await fetchRooms({ page: 1, perPage: 50 });
        setRooms(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        toast.error(err.message || 'Failed to load rooms');
      } finally {
        setRoomsLoading(false);
      }
    };
    loadRooms();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSessions({
        page,
        perPage,
        roomId: roomId || undefined
      });
      setSessions(Array.isArray(res.data) ? res.data : []);
      setPageInfo(
        res.pageInfo || {
          currentPage: page,
          perPage,
          lastPage: 1,
          total: Array.isArray(res.data) ? res.data.length : 0
        }
      );
    } catch (err) {
      toast.error(err.message || 'Failed to load sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (session) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSessionDetail(session);
    try {
      const res = await fetchSessionById(session.id);
      setSessionDetail(res?.id ? res : { ...session, ...res });
    } catch (err) {
      toast.error(err.message || 'Failed to load session detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const participants = sessionDetail?.participants || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Sessions</h2>
          <p className="text-sm text-slate-500">
            Review session history and open recordings for any selected meeting
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Room
            </label>
            <select
              className="custom-input text-sm font-semibold"
              value={roomId}
              disabled={roomsLoading}
              onChange={(e) => {
                setRoomId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{roomsLoading ? 'Loading rooms…' : 'All rooms'}</option>
              {rooms.map((room) => (
                <option key={room.id || room.roomId} value={room.roomId}>
                  {room.roomId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Per page
            </label>
            <select
              className="custom-input text-sm font-semibold !w-auto"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {['Session ID', 'Room ID', 'Status', 'Participants', 'Start', 'End', 'Duration', ''].map((h) => (
                  <th
                    key={h || 'actions'}
                    className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-slate-400">
                    Loading sessions…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-slate-400">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                  >
                    <td
                      className="px-3 py-3.5 text-xs font-mono text-slate-600 whitespace-nowrap"
                      title={session.id}
                    >
                      {shortId(session.id)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {session.roomId || '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge variant={statusVariant(session.status)}>{session.status || '—'}</Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <Users className="w-4 h-4 text-slate-400" />
                        {session.participants?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {formatDateTime(session.start)}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {formatDateTime(session.end)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {formatDuration(session.start, session.end)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" icon={Eye} onClick={() => openDetail(session)}>
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Clapperboard}
                          onClick={() =>
                            onOpenRecordings?.({
                              roomId: session.roomId,
                              sessionId: session.id
                            })
                          }
                        >
                          Recordings
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing page <span className="font-semibold text-slate-700">{pageInfo.currentPage || page}</span> of{' '}
            <span className="font-semibold text-slate-700">{pageInfo.lastPage || 1}</span>
            {' · '}
            <span className="font-semibold text-slate-700">{pageInfo.total || 0}</span> total sessions
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={ChevronLeft}
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={loading || page >= (pageInfo.lastPage || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>

      <Drawer
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSessionDetail(null);
        }}
        title="Session Details"
        size="lg"
      >
        {detailLoading && !sessionDetail ? (
          <p className="text-center py-10 text-slate-400">Loading…</p>
        ) : sessionDetail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Session ID</p>
                <p className="text-sm font-mono text-slate-800 mt-1 break-all">{sessionDetail.id}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room ID</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{sessionDetail.roomId || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                <div className="mt-1">
                  <Badge variant={statusVariant(sessionDetail.status)}>{sessionDetail.status || '—'}</Badge>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Duration</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {formatDuration(sessionDetail.start, sessionDetail.end)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start</p>
                <p className="text-sm text-slate-800 mt-1">{formatDateTime(sessionDetail.start)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End</p>
                <p className="text-sm text-slate-800 mt-1">{formatDateTime(sessionDetail.end)}</p>
              </div>
            </div>

            <Button
              fullWidth
              variant="secondary"
              icon={Clapperboard}
              onClick={() => {
                onOpenRecordings?.({
                  roomId: sessionDetail.roomId,
                  sessionId: sessionDetail.id
                });
                setDetailOpen(false);
              }}
            >
              View Recordings for this Session
            </Button>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-800">Participants ({participants.length})</h4>
                {detailLoading && <span className="text-xs text-slate-400">Updating…</span>}
              </div>

              {participants.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No participants</p>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => {
                    const firstLog = p.timelog?.[0];
                    return (
                      <div
                        key={p._id || p.id || p.participantId}
                        className="p-3 rounded-xl border border-slate-100 hover:border-brand-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{p.name || 'Unknown'}</p>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">{p.participantId}</p>
                          </div>
                          {p.type && <Badge variant="info">{p.type}</Badge>}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {formatDateTime(firstLog?.start)} → {formatDateTime(firstLog?.end)}
                          {firstLog?.start && firstLog?.end
                            ? ` · ${formatDuration(firstLog.start, firstLog.end)}`
                            : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default SessionsPage;
