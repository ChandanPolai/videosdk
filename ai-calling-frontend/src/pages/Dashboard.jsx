import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  XCircle,
  Radio
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchSipCalls } from '../services/videosdkApi';
import { formatDate, formatDuration, formatTime } from '../utils/formatDate';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const SUCCESS_STATUSES = new Set(['completed', 'ended', 'answered']);
const FAIL_STATUSES = new Set([
  'failed',
  'busy',
  'rejected',
  'no-answer',
  'no_answer',
  'cancelled',
  'canceled',
  'missed'
]);
const LIVE_STATUSES = new Set(['ringing', 'initiated', 'incoming', 'verified', 'trying', 'in-progress', 'in_progress']);

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startDate: start.getTime(), endDate: end.getTime() };
};

const classifyCall = (call) => {
  const status = String(call?.status || '').toLowerCase();
  if (FAIL_STATUSES.has(status)) return 'failed';
  if (LIVE_STATUSES.has(status) && !call?.end) return 'live';
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (!call?.end) return 'live';
  return 'other';
};

const statusVariant = (call) => {
  const kind = classifyCall(call);
  if (kind === 'success') return 'success';
  if (kind === 'failed') return 'danger';
  if (kind === 'live') return 'warning';
  return 'info';
};

const fetchAllPages = async (params, maxPages = 5) => {
  const first = await fetchSipCalls({ page: 1, perPage: 100, ...params });
  const calls = Array.isArray(first.data) ? [...first.data] : [];
  const lastPage = Number(first.pageInfo?.lastPage || 1);
  const total = Number(first.pageInfo?.total ?? calls.length);

  for (let page = 2; page <= Math.min(lastPage, maxPages); page += 1) {
    const res = await fetchSipCalls({ page, perPage: 100, ...params });
    if (Array.isArray(res.data)) calls.push(...res.data);
  }

  return { calls, total };
};

const StatCard = ({ label, value, hint, icon: Icon, tone = 'brand' }) => {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    danger: 'bg-rose-50 text-rose-600',
    warning: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1.5 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone] || tones.brand}`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayCalls, setTodayCalls] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [recentCalls, setRecentCalls] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = todayRange();
      const [todayRes, allRes, recentRes] = await Promise.all([
        fetchAllPages(range),
        fetchSipCalls({ page: 1, perPage: 1 }),
        fetchSipCalls({ page: 1, perPage: 12 })
      ]);

      setTodayCalls(todayRes.calls);
      setTodayTotal(todayRes.total);
      setAllTimeTotal(Number(allRes.pageInfo?.total || 0));
      setRecentCalls(Array.isArray(recentRes.data) ? recentRes.data : []);
      setUpdatedAt(new Date());
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const counts = { success: 0, failed: 0, live: 0, other: 0, inbound: 0, outbound: 0 };
    todayCalls.forEach((call) => {
      counts[classifyCall(call)] += 1;
      const type = String(call.type || '').toLowerCase();
      if (type === 'inbound') counts.inbound += 1;
      if (type === 'outbound') counts.outbound += 1;
    });

    const placed = todayTotal || todayCalls.length;
    const connected = counts.success;
    const failed = counts.failed;
    const live = counts.live;
    const finished = connected + failed;
    const successRate = finished ? Math.round((connected / finished) * 100) : 0;

    return { ...counts, placed, connected, failed, live, successRate };
  }, [todayCalls, todayTotal]);

  const liveCalls = useMemo(
    () => recentCalls.filter((call) => classifyCall(call) === 'live'),
    [recentCalls]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Today’s calling activity · {formatDate(new Date())}
            {updatedAt ? ` · Updated ${formatTime(updatedAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate('/calls')}>
            View call history
          </Button>
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Today’s calls"
          value={loading ? '—' : stats.placed}
          hint="All calls placed today"
          icon={Phone}
          tone="brand"
        />
        <StatCard
          label="Connected"
          value={loading ? '—' : stats.connected}
          hint="Completed successfully"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Failed"
          value={loading ? '—' : stats.failed}
          hint="Busy, missed, or failed"
          icon={XCircle}
          tone="danger"
        />
        <StatCard
          label="Live now"
          value={loading ? '—' : stats.live}
          hint="Ringing or in progress"
          icon={Radio}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-1" title="Today at a glance" subtitle="What happened on these calls">
          {loading ? (
            <p className="text-sm text-slate-400 py-8 text-center">Loading today’s numbers…</p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Connect rate</p>
                  <p className="text-sm font-extrabold text-slate-900">{stats.successRate}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${stats.successRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {stats.connected} connected · {stats.failed} failed
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outbound</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">{stats.outbound}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inbound</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">{stats.inbound}</p>
                </div>
              </div>

              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">All-time calls</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">{allTimeTotal}</p>
              </div>
            </div>
          )}
        </Card>

        <Card
          className="xl:col-span-2"
          title="What’s happening"
          subtitle={liveCalls.length ? `${liveCalls.length} live call${liveCalls.length === 1 ? '' : 's'} right now` : 'Latest call activity'}
        >
          {loading ? (
            <p className="text-sm text-slate-400 py-10 text-center">Loading live activity…</p>
          ) : recentCalls.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No calls yet</p>
          ) : (
            <div className="space-y-2">
              {liveCalls.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 mb-3">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
                    <Activity className="w-3.5 h-3.5" />
                    Live calls
                  </div>
                  {liveCalls.map((call) => (
                    <div key={call.callId || call._id} className="flex items-center justify-between gap-3 py-1.5">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {call.from || '—'} → {call.to || '—'}
                      </p>
                      <Badge variant="warning">{call.status || 'live'}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Time', 'Type', 'From', 'To', 'Status', 'Duration'].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map((call) => {
                      const inbound = String(call.type).toLowerCase() === 'inbound';
                      return (
                        <tr key={call.callId || call._id} className="border-b border-slate-50">
                          <td className="px-3 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                            {formatTime(call.start)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 capitalize">
                              {inbound ? (
                                <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <PhoneOutgoing className="w-3.5 h-3.5 text-brand-600" />
                              )}
                              {call.type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">{call.from || '—'}</td>
                          <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">{call.to || '—'}</td>
                          <td className="px-3 py-3">
                            <Badge variant={statusVariant(call)}>{call.status || '—'}</Badge>
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                            {formatDuration(call.start, call.end)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
