import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Play, ExternalLink, Clapperboard, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchMergedParticipantRecordings,
  fetchRooms,
  fetchSessions,
  fetchSipCalls
} from '../services/videosdkApi';
import { formatDateTime, formatDuration } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Drawer from '../components/ui/Drawer';
import Pagination from '../components/ui/Pagination';

const shortId = (id = '') => {
  if (!id) return '—';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

const formatBytes = (bytes) => {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSeconds = (seconds) => {
  const total = Math.round(Number(seconds) || 0);
  if (!total) return '—';
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const statusVariant = (status = '') => {
  const s = String(status).toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'failed') return 'danger';
  if (['processing', 'pending', 'in-progress'].includes(s)) return 'warning';
  return 'info';
};

const readList = (res) => {
  if (Array.isArray(res?.recordings)) return res.recordings;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

const looksLikePhone = (value) => /^\+?\d{8,15}$/.test(String(value || '').replace(/[\s-()]/g, ''));

const pickPhone = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const text = String(value).trim();
    if (looksLikePhone(text)) return text;
  }
  return '';
};

const numbersFromCall = (call) => ({
  from: pickPhone(call?.from, call?.sipCallFrom),
  to: pickPhone(call?.to, call?.sipCallTo)
});

const numbersFromRecording = (rec) => {
  const channelIds = [...(rec.channel1 || []), ...(rec.channel2 || [])].map(
    (item) => item?.participantId || item?.name
  );
  return {
    from: pickPhone(rec.from, rec.sipCallFrom, rec.callerId, rec.callerNumber),
    to: pickPhone(rec.to, rec.sipCallTo, rec.phone, rec.phoneNumber, rec.participantName, rec.participantId, ...channelIds)
  };
};

const dateToStartMs = (value) => (value ? new Date(`${value}T00:00:00`).getTime() : undefined);
const dateToEndMs = (value) => (value ? new Date(`${value}T23:59:59.999`).getTime() : undefined);

const indexCalls = (calls = []) => {
  const bySession = new Map();
  const byRoom = new Map();
  calls.forEach((call) => {
    if (call?.sessionId && !bySession.has(call.sessionId)) bySession.set(call.sessionId, call);
    if (call?.roomId && !byRoom.has(call.roomId)) byRoom.set(call.roomId, call);
  });
  return { bySession, byRoom };
};

const attachPhoneNumbers = async (recordings, { roomId, sessionId, startDate, endDate }) => {
  let calls = [];
  try {
    const sipParams = {
      page: 1,
      perPage: 100,
      roomId: roomId || undefined,
      sessionId: sessionId || undefined
    };
    if (startDate) sipParams.startDate = dateToStartMs(startDate);
    if (endDate) sipParams.endDate = dateToEndMs(endDate);

    const sipRes = await fetchSipCalls(sipParams);
    calls = Array.isArray(sipRes.data) ? sipRes.data : [];
  } catch {
    calls = [];
  }

  const { bySession, byRoom } = indexCalls(calls);
  const missingSessionIds = [
    ...new Set(
      recordings
        .map((rec) => rec.sessionId)
        .filter((id) => id && !bySession.has(id))
    )
  ].slice(0, 20);

  await Promise.all(
    missingSessionIds.map(async (id) => {
      try {
        const res = await fetchSipCalls({ sessionId: id, page: 1, perPage: 5 });
        const call = Array.isArray(res.data) ? res.data[0] : null;
        if (call) bySession.set(id, call);
      } catch {
        /* ignore unmatched sessions */
      }
    })
  );

  return recordings.map((rec) => {
    const call = (rec.sessionId && bySession.get(rec.sessionId)) || (rec.roomId && byRoom.get(rec.roomId)) || null;
    const fromRec = numbersFromRecording(rec);
    const fromCall = numbersFromCall(call);
    return {
      ...rec,
      from: fromRec.from || fromCall.from || '',
      to: fromRec.to || fromCall.to || '',
      callType: call?.type || rec.callType || ''
    };
  });
};

const RecordingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [recordings, setRecordings] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [playback, setPlayback] = useState(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Number(searchParams.get('perPage')) || 10;
  const roomId = searchParams.get('roomId') || '';
  const sessionId = searchParams.get('sessionId') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const search = searchParams.get('q') || '';

  const updateParams = useCallback(
    (patch, resetPage = false) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.set('page', '1');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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

  useEffect(() => {
    if (!roomId) {
      setSessions([]);
      return;
    }

    const loadSessions = async () => {
      setSessionsLoading(true);
      try {
        const res = await fetchSessions({ roomId, page: 1, perPage: 50 });
        setSessions(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        toast.error(err.message || 'Failed to load sessions');
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };

    loadSessions();
  }, [roomId]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const load = useCallback(async () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error('Start date cannot be after end date');
      setRecordings([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchMergedParticipantRecordings({
        page,
        perPage,
        roomId: roomId || undefined,
        sessionId: sessionId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      const list = await attachPhoneNumbers(readList(res), {
        roomId,
        sessionId,
        startDate,
        endDate
      });
      const query = search.trim().toLowerCase();
      const filtered = query
        ? list.filter((rec) =>
            [rec.id, rec.sessionId, rec.roomId, rec.status, rec.from, rec.to, rec.file?.fileUrl]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query))
          )
        : list;

      const apiLast = Number(res.pageInfo?.lastPage) || 1;
      const inferredLast =
        list.length >= perPage ? Math.max(apiLast, page + 1, page) : Math.max(apiLast, page);

      setRecordings(filtered);
      setPageInfo({
        currentPage: Number(res.pageInfo?.currentPage) || page,
        perPage: Number(res.pageInfo?.perPage) || perPage,
        lastPage: Math.max(inferredLast, 1),
        total: Number(res.pageInfo?.total) || filtered.length
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load recordings');
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, roomId, sessionId, startDate, endDate, search]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = (e) => {
    e.preventDefault();
    updateParams({ q: searchInput.trim() }, true);
  };

  const lastPage = Math.max(pageInfo.lastPage || 1, 1);

  const emptyMessage = useMemo(() => {
    if (search || startDate || endDate || roomId || sessionId) {
      return {
        title: 'No merge recordings found',
        body: 'No files match this filter. Try another date range, room, session, or search term.'
      };
    }
    return {
      title: 'No merge recordings yet',
      body: 'Merged participant recordings will appear here once they are generated.'
    };
  }, [search, startDate, endDate, roomId, sessionId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Recordings</h2>
          <p className="text-sm text-slate-500">Browse merged participant recordings by room, session, and date</p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <form onSubmit={applySearch} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Room
            </label>
            <select
              className="custom-input text-sm font-semibold"
              value={roomId}
              disabled={roomsLoading}
              onChange={(e) => updateParams({ roomId: e.target.value, sessionId: '' }, true)}
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
              Session
            </label>
            <select
              className="custom-input text-sm font-semibold"
              value={sessionId}
              disabled={!roomId || sessionsLoading}
              onChange={(e) => updateParams({ sessionId: e.target.value }, true)}
            >
              <option value="">
                {!roomId
                  ? 'Select a room first'
                  : sessionsLoading
                    ? 'Loading sessions…'
                    : `All sessions (${sessions.length})`}
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {shortId(session.id)} · {formatDateTime(session.start)} · {session.status || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="custom-input text-sm font-semibold !pl-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Phone, room, session, or recording ID"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Start date
            </label>
            <input
              type="date"
              className="custom-input text-sm font-semibold"
              value={startDate}
              onChange={(e) => updateParams({ startDate: e.target.value }, true)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              End date
            </label>
            <input
              type="date"
              className="custom-input text-sm font-semibold"
              value={endDate}
              onChange={(e) => updateParams({ endDate: e.target.value }, true)}
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Per page
              </label>
              <select
                className="custom-input text-sm font-semibold"
                value={perPage}
                onChange={(e) => updateParams({ perPage: e.target.value }, true)}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" className="mb-0.5">
              Search
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[1040px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {['Phone', 'From', 'Status', 'Room', 'Session', 'Duration', 'Size', 'Start', 'Type', ''].map((h) => (
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
                  <td colSpan={10} className="px-3 py-16 text-center text-slate-400">
                    Loading recordings…
                  </td>
                </tr>
              ) : recordings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                      <Clapperboard className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700">{emptyMessage.title}</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">{emptyMessage.body}</p>
                  </td>
                </tr>
              ) : (
                recordings.map((rec) => {
                  const file = rec.file || rec.files?.[0] || null;
                  const meta = file?.meta || {};
                  const fileUrl = file?.fileUrl || '';
                  const durationLabel = meta.duration
                    ? formatSeconds(meta.duration)
                    : formatDuration(rec.start, rec.end);

                  return (
                    <tr
                      key={rec.id || `${rec.sessionId}-${rec.start}`}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3 py-3.5">
                        <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                          {rec.to || rec.from || '—'}
                        </p>
                        {rec.callType && (
                          <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{rec.callType}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {rec.from || '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge variant={statusVariant(rec.status)}>{rec.status || 'merge'}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {rec.roomId || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-xs font-mono text-slate-600 whitespace-nowrap" title={rec.sessionId}>
                        {shortId(rec.sessionId)}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {durationLabel}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">{formatBytes(file?.size)}</td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateTime(rec.start || rec.createdAt || file?.createdAt)}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge>{file?.type || file?.meta?.format || rec.fileFormat || 'file'}</Badge>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Play}
                            disabled={!fileUrl}
                            onClick={() => setPlayback({ ...rec, primaryFile: file })}
                          >
                            Play
                          </Button>
                          {fileUrl && (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-3 py-1.5 text-xs h-9 font-semibold rounded-btn text-slate-600 hover:bg-slate-100"
                            >
                              <ExternalLink className="w-4 h-4 mr-1.5" />
                              Open
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pageInfo.currentPage || page}
          lastPage={lastPage}
          total={pageInfo.total || 0}
          loading={loading}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      </Card>

      <Drawer isOpen={Boolean(playback)} onClose={() => setPlayback(null)} title="Play Recording" size="xl">
        {playback && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{playback.to || playback.from || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">From</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{playback.from || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{playback.roomId || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Session</p>
                <p className="text-sm font-mono text-slate-800 mt-1 break-all">{playback.sessionId || '—'}</p>
              </div>
            </div>

            {playback.primaryFile?.fileUrl ? (
              <div className="rounded-xl overflow-hidden bg-slate-900">
                {String(playback.primaryFile.type || playback.file?.meta?.format || '').includes('audio') ||
                String(playback.primaryFile.meta?.format || '').includes('mp3') ? (
                  <div className="p-6">
                    <audio src={playback.primaryFile.fileUrl} controls className="w-full">
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ) : (
                  <video
                    src={playback.primaryFile.fileUrl}
                    controls
                    className="w-full max-h-[60vh]"
                    controlsList="nodownload"
                  >
                    Your browser does not support video playback.
                  </video>
                )}
              </div>
            ) : (
              <p className="text-center py-10 text-slate-400">No playable file URL</p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RecordingsPage;
