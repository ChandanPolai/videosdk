import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Play, ExternalLink, Clapperboard } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchRecordings,
  fetchParticipantRecordings,
  fetchTrackRecordings,
  fetchRooms,
  fetchSessions
} from '../services/videosdkApi';
import { formatDateTime, formatDuration } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Drawer from '../components/ui/Drawer';

const RECORDING_TABS = [
  { id: 'participant', label: 'Participant' },
  { id: 'track', label: 'Track' },
  { id: 'session', label: 'Session' }
];

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

const getPrimaryFile = (item, mode) => {
  if (mode === 'session') return item?.file || null;
  const files = Array.isArray(item?.files) ? item.files : [];
  return files[0] || null;
};

const RecordingsPage = ({ focus = null, onFocusConsumed }) => {
  const [activeType, setActiveType] = useState('participant');
  const [rooms, setRooms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [recordings, setRecordings] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [roomId, setRoomId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [playback, setPlayback] = useState(null);

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
    if (!focus) return;
    if (focus.roomId) setRoomId(focus.roomId);
    if (focus.sessionId) setSessionId(focus.sessionId);
    setActiveType('participant');
    setPage(1);
    onFocusConsumed?.();
  }, [focus, onFocusConsumed]);

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

  const requiresRoom = activeType === 'session' || activeType === 'participant';

  const load = useCallback(async () => {
    if (requiresRoom && !roomId) {
      setRecordings([]);
      setPageInfo({ currentPage: 1, perPage, lastPage: 1, total: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {
        page,
        perPage,
        roomId: roomId || undefined,
        sessionId: sessionId || undefined
      };

      let res;
      if (activeType === 'track') {
        res = await fetchTrackRecordings(params);
      } else if (activeType === 'participant') {
        res = await fetchParticipantRecordings(params);
      } else {
        res = await fetchRecordings(params);
      }

      setRecordings(Array.isArray(res.data) ? res.data : []);
      setPageInfo(
        res.pageInfo || {
          currentPage: page,
          perPage,
          lastPage: 1,
          total: Array.isArray(res.data) ? res.data.length : 0
        }
      );
    } catch (err) {
      toast.error(err.message || 'Failed to load recordings');
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, roomId, sessionId, activeType, requiresRoom]);

  useEffect(() => {
    load();
  }, [load]);

  const emptyMessage = useMemo(() => {
    if (requiresRoom && !roomId) {
      return {
        title: 'Select a room to continue',
        body: 'Choose a room from the dropdown above to load participant or session recordings.'
      };
    }
    return {
      title: `No ${activeType} recordings found`,
      body: 'No files are available for this filter yet. Try another room, session, or recording type.'
    };
  }, [requiresRoom, roomId, activeType]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Recordings</h2>
          <p className="text-sm text-slate-500">
            Browse participant, track, and session recordings for each meeting
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={RefreshCw}
          onClick={load}
          disabled={loading || (requiresRoom && !roomId)}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 mb-5">
          {RECORDING_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveType(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeType === tab.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Room {requiresRoom ? '' : '(optional)'}
            </label>
            <select
              className="custom-input text-sm font-semibold"
              value={roomId}
              disabled={roomsLoading}
              onChange={(e) => {
                setRoomId(e.target.value);
                setSessionId('');
                setPage(1);
              }}
            >
              <option value="">
                {roomsLoading
                  ? 'Loading rooms…'
                  : requiresRoom
                    ? 'Select a room'
                    : 'All rooms'}
              </option>
              {rooms.map((room) => (
                <option key={room.id || room.roomId} value={room.roomId}>
                  {room.roomId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Session (optional)
            </label>
            <select
              className="custom-input text-sm font-semibold"
              value={sessionId}
              disabled={!roomId || sessionsLoading}
              onChange={(e) => {
                setSessionId(e.target.value);
                setPage(1);
              }}
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
              Per page
            </label>
            <select
              className="custom-input text-sm font-semibold"
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

        {requiresRoom && !roomId ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
              <Clapperboard className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-800">{emptyMessage.title}</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{emptyMessage.body}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[1040px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    {[
                      'Participant',
                      'Kind',
                      'Room',
                      'Session',
                      'Duration',
                      'Size',
                      'Start',
                      'Type',
                      ''
                    ].map((h) => (
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
                      <td colSpan={9} className="px-3 py-16 text-center text-slate-400">
                        Loading recordings…
                      </td>
                    </tr>
                  ) : recordings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-16 text-center">
                        <p className="font-semibold text-slate-700">{emptyMessage.title}</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">{emptyMessage.body}</p>
                      </td>
                    </tr>
                  ) : (
                    recordings.map((rec) => {
                      const file = getPrimaryFile(rec, activeType);
                      const meta = file?.meta || {};
                      const fileUrl = file?.fileUrl || '';
                      const durationLabel = meta.duration
                        ? formatSeconds(meta.duration)
                        : formatDuration(rec.start, rec.end);

                      return (
                        <tr
                          key={rec.id || `${rec.participantId}-${rec.sessionId}-${rec.kind}`}
                          className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="px-3 py-3.5">
                            <p className="text-sm font-semibold text-slate-800">
                              {rec.participantName || rec.participantId || shortId(rec.id)}
                            </p>
                            {rec.participantId && (
                              <p className="text-xs font-mono text-slate-400 mt-0.5">
                                {rec.participantId}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge variant="info">{rec.kind || file?.type || activeType}</Badge>
                          </td>
                          <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                            {rec.roomId || '—'}
                          </td>
                          <td
                            className="px-3 py-3.5 text-xs font-mono text-slate-600 whitespace-nowrap"
                            title={rec.sessionId}
                          >
                            {shortId(rec.sessionId)}
                          </td>
                          <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                            {durationLabel}
                          </td>
                          <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {formatBytes(file?.size)}
                          </td>
                          <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {formatDateTime(rec.start || rec.createdAt)}
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge>{file?.type || rec.fileFormat || 'file'}</Badge>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Play}
                                disabled={!fileUrl}
                                onClick={() =>
                                  setPlayback({
                                    ...rec,
                                    primaryFile: file,
                                    recordingType: activeType
                                  })
                                }
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing page <span className="font-semibold text-slate-700">{pageInfo.currentPage || page}</span> of{' '}
                <span className="font-semibold text-slate-700">{Math.max(pageInfo.lastPage || 1, 1)}</span>
                {' · '}
                <span className="font-semibold text-slate-700">{pageInfo.total || 0}</span> total recordings
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
                  disabled={loading || page >= Math.max(pageInfo.lastPage || 1, 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Drawer
        isOpen={Boolean(playback)}
        onClose={() => setPlayback(null)}
        title="Play Recording"
        size="xl"
      >
        {playback && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Participant</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {playback.participantName || playback.participantId || '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kind</p>
                <p className="text-sm font-semibold text-slate-800 mt-1 capitalize">
                  {playback.kind || playback.primaryFile?.type || playback.recordingType}
                </p>
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
                {String(playback.primaryFile.type || playback.kind || '').includes('audio') &&
                !String(playback.kind || '').includes('video') ? (
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
