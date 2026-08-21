import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Download,
  ArrowRightLeft,
  PhoneOff,
  ListFilter
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchSipCalls } from '../services/videosdkApi';
import { formatDateTime, formatDuration } from '../utils/formatDate';
import {
  getCallFrom,
  getCallParticipantName,
  getCallStatus,
  getCallTo,
  getPrimaryNumber,
  getTransferDestination,
  isCallTransferred
} from '../utils/callTransfer';
import { downloadCallsExcel } from '../utils/exportCallsExcel';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';

const statusVariant = (status = '') => {
  const s = String(status).toLowerCase();
  if (s === 'transferred') return 'info';
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

const STATUS_FILTERS = [
  { value: 'all', label: 'All', icon: ListFilter },
  { value: 'transferred', label: 'Transferred', icon: ArrowRightLeft },
  { value: 'not_transferred', label: 'Not transferred', icon: PhoneOff }
];

const CallsPage = () => {
  const [calls, setCalls] = useState([]);
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, perPage: 10, lastPage: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({ total: 0, transferred: 0 });

  const matchesStatusFilter = useCallback((call) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'transferred') return isCallTransferred(call);
    if (statusFilter === 'not_transferred') return !isCallTransferred(call);
    return getCallStatus(call).toLowerCase() === String(statusFilter).toLowerCase();
  }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (statusFilter !== 'all') {
        const pages = [];
        let lastPage = 1;
        for (let p = 1; p <= 30; p += 1) {
          const res = await fetchSipCalls({
            page: p,
            perPage: 100,
            type: typeFilter || undefined,
            search: search || undefined
          });
          const chunk = Array.isArray(res.data) ? res.data : [];
          pages.push(...chunk);
          lastPage = Number(res.pageInfo?.lastPage || 1);
          if (p >= lastPage) break;
        }

        const filtered = pages.filter(matchesStatusFilter);
        setStats({
          total: pages.length,
          transferred: pages.filter(isCallTransferred).length
        });

        const start = (page - 1) * perPage;
        setCalls(filtered.slice(start, start + perPage));
        setPageInfo({
          currentPage: page,
          perPage,
          lastPage: Math.max(1, Math.ceil(filtered.length / perPage) || 1),
          total: filtered.length
        });
      } else {
        const res = await fetchSipCalls({
          page,
          perPage,
          type: typeFilter || undefined,
          search: search || undefined
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setCalls(list);
        setPageInfo(
          res.pageInfo || {
            currentPage: page,
            perPage,
            lastPage: 1,
            total: list.length
          }
        );

        const sampleRes = await fetchSipCalls({
          page: 1,
          perPage: 100,
          type: typeFilter || undefined,
          search: search || undefined
        });
        const sample = Array.isArray(sampleRes.data) ? sampleRes.data : [];
        setStats({
          total: Number(res.pageInfo?.total || sample.length),
          transferred: sample.filter(isCallTransferred).length
        });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load calls');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, typeFilter, statusFilter, search, matchesStatusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await downloadCallsExcel({
        fetchSipCalls,
        baseParams: {
          type: typeFilter || undefined,
          search: search || undefined
        },
        statusFilter
      });
      toast.success(`Excel ready · ${result.total} rows · ${result.transferred} transferred`);
    } catch (err) {
      toast.error(err.message || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const pageTransferredCount = useMemo(() => calls.filter(isCallTransferred).length, [calls]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Call History</h2>
          <p className="text-sm text-slate-500">
            Filter by Status (Transferred = status Transferred only). Export Name, Number, Type, Status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" icon={Download} onClick={handleExport} disabled={exporting || loading}>
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Calls in view</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{pageInfo.total || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Status = Transferred
          </p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {statusFilter === 'transferred' ? pageInfo.total || 0 : stats.transferred}
          </p>
          <p className="text-xs text-slate-500 mt-1">Only rows whose Status is Transferred</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">On this page</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{pageTransferredCount}</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <form onSubmit={applySearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="custom-input !pl-10"
                placeholder="Search by phone or call id"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" size="md">
              Search
            </Button>
          </form>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
              {[
                { value: '', label: 'All types' },
                { value: 'inbound', label: 'Inbound' },
                { value: 'outbound', label: 'Outbound' }
              ].map((f) => (
                <button
                  key={f.value || 'all-types'}
                  type="button"
                  onClick={() => {
                    setTypeFilter(f.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === f.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
              {STATUS_FILTERS.map((f) => {
                const Icon = f.icon;
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(f.value);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                      active
                        ? f.value === 'transferred'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : f.value === 'not_transferred'
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'bg-brand-500 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>

            <select
              className="custom-input !h-9 !w-auto text-xs font-semibold self-start"
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
          <table className="w-full min-w-[1100px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {['Type', 'Name', 'Number', 'From', 'To', 'Status', 'Transferred', 'Start', 'Duration', 'Call ID'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
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
                  const transferred = isCallTransferred(call);
                  const name = getCallParticipantName(call);
                  const number = getPrimaryNumber(call);
                  const transferTo = getTransferDestination(call);
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
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {name || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {number || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {getCallFrom(call) || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {getCallTo(call) || '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge variant={statusVariant(getCallStatus(call))}>
                          {getCallStatus(call) || '—'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3.5">
                        {transferred ? (
                          <div className="space-y-0.5">
                            <Badge variant="success">Yes</Badge>
                            {transferTo ? (
                              <p className="text-[11px] text-slate-500 font-mono">{transferTo}</p>
                            ) : null}
                          </div>
                        ) : (
                          <Badge variant="info">No</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateTime(call.start)}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {formatDuration(call.start, call.end)}
                      </td>
                      <td
                        className="px-3 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap"
                        title={call.callId}
                      >
                        {shortId(call.callId)}
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
          lastPage={pageInfo.lastPage || 1}
          total={pageInfo.total || 0}
          loading={loading}
          itemLabel="calls"
          windowSize={5}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
};

export default CallsPage;
