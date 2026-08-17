import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchRooms } from '../services/videosdkApi';
import { formatDateTime } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRooms({ page, perPage });
      setRooms(Array.isArray(res.data) ? res.data : []);
      setPageInfo(
        res.pageInfo || {
          currentPage: page,
          perPage,
          lastPage: 1,
          total: Array.isArray(res.data) ? res.data.length : 0
        }
      );
    } catch (err) {
      toast.error(err.message || 'Failed to load rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  const copyRoomId = async (roomId) => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedId(roomId);
      toast.success('Room ID copied');
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      toast.error('Unable to copy Room ID');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Rooms</h2>
          <p className="text-sm text-slate-500">Manage and review rooms used by your AI calling agent</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="custom-input !h-9 !w-auto text-xs font-semibold"
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
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[860px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {['Room ID', 'Custom ID', 'Status', 'Created', 'Updated', 'Owner', 'Actions'].map((h) => (
                  <th
                    key={h}
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
                  <td colSpan={7} className="px-3 py-16 text-center text-slate-400">
                    Loading rooms…
                  </td>
                </tr>
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-16 text-center text-slate-400">
                    No rooms found
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr
                    key={room.id || room.roomId}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-3 py-3.5 text-sm font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {room.roomId || '—'}
                    </td>
                    <td
                      className="px-3 py-3.5 text-sm text-slate-700 max-w-[220px] truncate"
                      title={room.customRoomId || room.customMeetingId || ''}
                    >
                      {room.customRoomId || room.customMeetingId || '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge variant={room.disabled ? 'danger' : 'success'}>
                        {room.disabled ? 'Disabled' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {formatDateTime(room.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {formatDateTime(room.updatedAt)}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">
                          {room.user?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">
                          {room.user?.email || ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={copiedId === room.roomId ? Check : Copy}
                        onClick={() => copyRoomId(room.roomId)}
                        disabled={!room.roomId}
                      >
                        Copy ID
                      </Button>
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
            <span className="font-semibold text-slate-700">{pageInfo.total || 0}</span> total rooms
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
    </div>
  );
};

export default RoomsPage;
