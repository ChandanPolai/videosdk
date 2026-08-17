import React, { useCallback, useEffect, useState } from 'react';
import { PhoneIncoming, PhoneOutgoing, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchSipCalls } from '../services/videosdkApi';
import { formatDateTime, formatDuration } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const statusVariant = (status = '') => {
  const s = String(status).toLowerCase();
  if (['completed', 'ended', 'answered'].includes(s)) return 'success';
  if (['failed', 'busy', 'rejected', 'no-answer', 'cancelled'].includes(s)) return 'danger';
  if (['ringing', 'initiated', 'incoming', 'verified', 'trying'].includes(s)) return 'warning';
  return 'info';
};

const shortId = (id = '') => {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

const CallsPage = () => {
  const [calls, setCalls] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSipCalls({
        page,
        perPage,
        type: typeFilter || undefined,
        search: search || undefined
      });
      setCalls(Array.isArray(res.data) ? res.data : []);
      setPageInfo(
        res.pageInfo || {
          currentPage: page,
          perPage,
          lastPage: 1,
          total: Array.isArray(res.data) ? res.data.length : 0
        }
      );
    } catch (err) {
      toast.error(err.message || 'Failed to load calls');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, typeFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Call History</h2>
          <p className="text-sm text-slate-500">
            Review inbound and outbound call activity for your AI calling agent
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <form onSubmit={applySearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="custom-input !pl-10"
                placeholder="Search by phone number"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" size="md">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: 'All' },
              { value: 'inbound', label: 'Inbound' },
              { value: 'outbound', label: 'Outbound' }
            ].map((f) => (
              <button
                key={f.value || 'all'}
                onClick={() => {
                  setTypeFilter(f.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  typeFilter === f.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}

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
          </div>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {[
                  'Type',
                  'From',
                  'To',
                  'Status',
                  'Gateway',
                  'Rule',
                  'Start',
                  'End',
                  'Duration',
                  'Call ID'
                ].map((h) => (
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
                  <td colSpan={10} className="px-3 py-16 text-center text-slate-400">
                    Loading calls…
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center text-slate-400">
                    No calls found
                  </td>
                </tr>
              ) : (
                calls.map((call) => {
                  const isInbound = String(call.type).toLowerCase() === 'inbound';
                  return (
                    <tr
                      key={call._id || call.callId}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isInbound ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'
                            }`}
                          >
                            {isInbound ? (
                              <PhoneIncoming className="w-4 h-4" />
                            ) : (
                              <PhoneOutgoing className="w-4 h-4" />
                            )}
                          </span>
                          <span className="text-sm font-semibold text-slate-700 capitalize">
                            {call.type || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {call.from || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {call.to || '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge variant={statusVariant(call.status)}>{call.status || '—'}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 max-w-[160px] truncate" title={call.gatewayName}>
                        {call.gatewayName || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 max-w-[140px] truncate" title={call.ruleName}>
                        {call.ruleName || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateTime(call.start)}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateTime(call.end)}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {formatDuration(call.start, call.end)}
                      </td>
                      <td className="px-3 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap" title={call.callId}>
                        {shortId(call.callId)}
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
            <span className="font-semibold text-slate-700">{pageInfo.lastPage || 1}</span>
            {' · '}
            <span className="font-semibold text-slate-700">{pageInfo.total || 0}</span> total calls
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

export default CallsPage;
