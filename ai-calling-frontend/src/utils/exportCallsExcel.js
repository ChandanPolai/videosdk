import * as XLSX from 'xlsx';
import { formatDateTime, formatDuration } from './formatDate';
import {
  getCallFrom,
  getCallParticipantName,
  getCallStatus,
  getCallTo,
  getPrimaryNumber,
  getTransferDestination,
  isCallTransferred
} from './callTransfer';

const fetchAllSipCalls = async (fetchSipCalls, baseParams = {}, maxPages = 30) => {
  const first = await fetchSipCalls({ page: 1, perPage: 100, ...baseParams });
  const calls = Array.isArray(first.data) ? [...first.data] : [];
  const lastPage = Number(first.pageInfo?.lastPage || 1);

  for (let page = 2; page <= Math.min(lastPage, maxPages); page += 1) {
    const res = await fetchSipCalls({ page, perPage: 100, ...baseParams });
    if (Array.isArray(res.data)) calls.push(...res.data);
  }

  return calls;
};

const EMPTY_ROW = {
  Name: '',
  Number: '',
  Type: '',
  Status: '',
  Transferred: '',
  'Transfer To': '',
  From: '',
  To: '',
  Duration: '',
  Start: '',
  End: '',
  Gateway: '',
  Rule: '',
  'Call ID': ''
};

const rowFromCall = (call) => {
  const transferred = isCallTransferred(call);
  return {
    Name: getCallParticipantName(call) || '—',
    Number: getPrimaryNumber(call) || '—',
    Type: call.type || '—',
    Status: getCallStatus(call) || '—',
    Transferred: transferred ? 'Yes' : 'No',
    'Transfer To': getTransferDestination(call) || '—',
    From: getCallFrom(call) || '—',
    To: getCallTo(call) || '—',
    Duration: formatDuration(call.start, call.end),
    Start: formatDateTime(call.start),
    End: formatDateTime(call.end),
    Gateway: call.gatewayName || '—',
    Rule: call.ruleName || '—',
    'Call ID': call.callId || call._id || '—'
  };
};

export const buildCallsExportWorkbook = (calls = []) => {
  const transferredCalls = calls.filter(isCallTransferred);
  const inbound = calls.filter((c) => String(c.type).toLowerCase() === 'inbound').length;
  const outbound = calls.filter((c) => String(c.type).toLowerCase() === 'outbound').length;

  const summary = [
    { Metric: 'Total calls', Count: calls.length },
    { Metric: 'Transferred (status = Transferred)', Count: transferredCalls.length },
    { Metric: 'Not transferred', Count: calls.length - transferredCalls.length },
    { Metric: 'Inbound', Count: inbound },
    { Metric: 'Outbound', Count: outbound },
    { Metric: 'Export generated at', Count: new Date().toLocaleString() }
  ];

  const detail = calls.map(rowFromCall);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(detail.length ? detail : [EMPTY_ROW]),
    'Calls'
  );
  return wb;
};

export const downloadCallsExcel = async ({
  fetchSipCalls,
  baseParams = {},
  statusFilter = 'all',
  fileName
}) => {
  let calls = await fetchAllSipCalls(fetchSipCalls, baseParams);

  if (statusFilter === 'transferred') {
    calls = calls.filter(isCallTransferred);
  } else if (statusFilter === 'not_transferred') {
    calls = calls.filter((call) => !isCallTransferred(call));
  } else if (statusFilter && statusFilter !== 'all') {
    const wanted = String(statusFilter).toLowerCase();
    calls = calls.filter((call) => getCallStatus(call).toLowerCase() === wanted);
  }

  const wb = buildCallsExportWorkbook(calls);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = fileName || `call-history-${statusFilter}-${stamp}.xlsx`;
  XLSX.writeFile(wb, name);

  return {
    total: calls.length,
    transferred: calls.filter(isCallTransferred).length
  };
};
