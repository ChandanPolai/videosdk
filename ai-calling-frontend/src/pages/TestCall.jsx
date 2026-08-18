import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, RefreshCw, Upload, FileSpreadsheet, X, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  createSipCall,
  fetchSipPhoneNumbers,
  fetchSipRoutingRules
} from '../services/videosdkApi';
import { COUNTRY_CODES, buildE164, getDialCode } from '../utils/countryCodes';
import { parseSpreadsheetFile } from '../utils/parseSpreadsheet';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const PREFERRED_FROM = '+912269980418';
const PREFERRED_RULE = 'rr_vuzrma';
const MAX_BULK_NUMBERS = 200;
const CALL_GAP_MS = 400;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePhone = (value = '') => {
  const trimmed = String(value).trim().replace(/[\s()-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d+$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
};

const TestCallPage = () => {
  const fileInputRef = useRef(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [callingId, setCallingId] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [routingRules, setRoutingRules] = useState([]);

  const [sipCallFrom, setSipCallFrom] = useState('');
  const [routingRuleId, setRoutingRuleId] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [localNumber, setLocalNumber] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const [entryMode, setEntryMode] = useState('single');
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [parsingFile, setParsingFile] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const cancelBulkRef = useRef(false);

  const activeOutboundNumbers = useMemo(
    () =>
      phoneNumbers.filter(
        (item) =>
          item?.phoneNumber?.status === 'ACTIVE' &&
          item?.outbound?.id &&
          (item?.phoneNumber?.e164 || item?.outbound?.numbers?.[0])
      ),
    [phoneNumbers]
  );

  const outboundRules = useMemo(
    () => routingRules.filter((rule) => String(rule.type).toLowerCase() === 'outbound'),
    [routingRules]
  );

  const selectedRule = useMemo(
    () => outboundRules.find((rule) => rule.id === routingRuleId) || null,
    [outboundRules, routingRuleId]
  );

  const mappedContacts = useMemo(() => {
    if (!spreadsheet || !phoneColumn) return [];

    const seen = new Set();
    const items = [];

    spreadsheet.rows.forEach((row, index) => {
      const raw = row[phoneColumn];
      const e164 = buildE164(countryCode, raw);
      const digits = e164.replace(/\D/g, '');
      if (digits.length < 8) return;
      if (seen.has(e164)) return;
      seen.add(e164);
      items.push({
        id: `${index}-${e164}`,
        row: index + 2,
        raw,
        e164,
        name: nameColumn ? String(row[nameColumn] || '').trim() : ''
      });
    });

    return items;
  }, [spreadsheet, phoneColumn, nameColumn, countryCode]);

  const loadSetup = async () => {
    setLoadingSetup(true);
    try {
      const [numbersRes, rulesRes] = await Promise.all([
        fetchSipPhoneNumbers({ page: 1, perPage: 50 }),
        fetchSipRoutingRules({ page: 1, perPage: 50 })
      ]);

      const numbers = Array.isArray(numbersRes.data) ? numbersRes.data : [];
      const rules = Array.isArray(rulesRes.data) ? rulesRes.data : [];
      setPhoneNumbers(numbers);
      setRoutingRules(rules);

      const preferredFrom = numbers.find((item) => item?.phoneNumber?.e164 === PREFERRED_FROM);
      const firstActive = numbers.find(
        (item) => item?.phoneNumber?.status === 'ACTIVE' && item?.outbound?.id
      );
      const preferredRule = rules.find((rule) => rule.id === PREFERRED_RULE);
      const firstOutboundRule = rules.find((rule) => String(rule.type).toLowerCase() === 'outbound');

      setSipCallFrom((prev) => prev || preferredFrom?.phoneNumber?.e164 || firstActive?.phoneNumber?.e164 || '');
      setRoutingRuleId((prev) => prev || preferredRule?.id || firstOutboundRule?.id || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load call setup');
    } finally {
      setLoadingSetup(false);
    }
  };

  useEffect(() => {
    loadSetup();
  }, []);

  const clearSpreadsheet = () => {
    cancelBulkRef.current = true;
    setSpreadsheet(null);
    setPhoneColumn('');
    setNameColumn('');
    setBulkProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startBulkCalls = async (contacts) => {
    const from = normalizePhone(sipCallFrom);
    if (!from) {
      toast.error('Please select a caller ID number');
      return;
    }
    if (!routingRuleId) {
      toast.error('Please select an outbound routing rule');
      return;
    }

    const ready = contacts
      .filter((item) => item.e164)
      .slice(0, MAX_BULK_NUMBERS)
      .map((item) => ({
        ...item,
        name: item.name || 'Customer',
        status: 'queued',
        message: ''
      }));

    if (!ready.length) {
      toast.error('No valid numbers found in the Excel file');
      return;
    }

    if (contacts.length > MAX_BULK_NUMBERS) {
      toast.warn(`Only the first ${MAX_BULK_NUMBERS} numbers will be called`);
    }

    cancelBulkRef.current = false;
    setSubmitting(true);
    setLastResult(null);
    setBulkProgress({ total: ready.length, done: 0, results: ready });

    let successCount = 0;
    let failCount = 0;
    let lastSuccess = null;

    for (let i = 0; i < ready.length; i += 1) {
      if (cancelBulkRef.current) break;

      const item = ready[i];
      setCallingId(item.id);
      setBulkProgress((prev) => ({
        ...prev,
        results: prev.results.map((row, idx) => (idx === i ? { ...row, status: 'calling' } : row))
      }));

      try {
        const res = await createSipCall({
          sipCallFrom: from,
          sipCallTo: item.e164,
          routingRuleId,
          metadata: { name: item.name }
        });
        successCount += 1;
        lastSuccess = { ...res, participantName: item.name };
        setBulkProgress((prev) => ({
          ...prev,
          done: i + 1,
          results: prev.results.map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  status: 'success',
                  message: res.message || 'Call initiated',
                  callId: res.data?.callId || ''
                }
              : row
          )
        }));
      } catch (err) {
        failCount += 1;
        setBulkProgress((prev) => ({
          ...prev,
          done: i + 1,
          results: prev.results.map((row, idx) =>
            idx === i ? { ...row, status: 'failed', message: err.message || 'Failed to place call' } : row
          )
        }));
      }

      if (i < ready.length - 1 && !cancelBulkRef.current) {
        await wait(CALL_GAP_MS);
      }
    }

    if (lastSuccess) setLastResult(lastSuccess);

    if (cancelBulkRef.current) {
      toast.warn('Calling stopped');
    } else if (failCount === 0) {
      toast.success(`Calls started for all ${successCount} numbers`);
    } else if (successCount === 0) {
      toast.error(`All ${failCount} calls failed`);
    } else {
      toast.warn(`${successCount} calls started, ${failCount} failed`);
    }

    setSubmitting(false);
    setCallingId('');
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsingFile(true);
    setBulkProgress(null);
    let parsedOk = false;
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.headers.length) {
        throw new Error('No columns found in the Excel file');
      }

      const phoneCol = parsed.phoneColumn || '';
      const nameCol = parsed.nameColumn || '';
      setSpreadsheet(parsed);
      setPhoneColumn(phoneCol);
      setNameColumn(nameCol);
      parsedOk = true;

      const seen = new Set();
      const contacts = [];
      parsed.rows.forEach((row, index) => {
        const raw = row[phoneCol];
        const e164 = buildE164(countryCode, raw);
        const digits = e164.replace(/\D/g, '');
        if (digits.length < 8 || seen.has(e164)) return;
        seen.add(e164);
        contacts.push({
          id: `${index}-${e164}`,
          row: index + 2,
          raw,
          e164,
          name: nameCol ? String(row[nameCol] || '').trim() : ''
        });
      });

      toast.success(`Loaded ${contacts.length} contacts. Starting calls automatically…`);
      setParsingFile(false);
      await startBulkCalls(contacts);
    } catch (err) {
      if (!parsedOk) clearSpreadsheet();
      toast.error(err.message || 'Failed to read Excel file');
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateSetup = () => {
    const from = normalizePhone(sipCallFrom);
    if (!from) {
      toast.error('Please select a caller ID number');
      return false;
    }
    if (!routingRuleId) {
      toast.error('Please select an outbound routing rule');
      return false;
    }
    return true;
  };

  const placeCall = async ({ to, name, rowId }) => {
    if (!validateSetup()) return;

    const customerName = String(name || '').trim();
    if (!customerName) {
      toast.error('Please enter the participant name');
      return;
    }
    if (!to) {
      toast.error('Please enter a valid destination phone number');
      return;
    }

    setSubmitting(true);
    setCallingId(rowId || 'single');
    try {
      const res = await createSipCall({
        sipCallFrom: normalizePhone(sipCallFrom),
        sipCallTo: to,
        routingRuleId,
        metadata: { name: customerName }
      });
      setLastResult({ ...res, participantName: customerName });
      toast.success(res.message || `Call started for ${customerName}`);
    } catch (err) {
      toast.error(err.message || 'Failed to place test call');
    } finally {
      setSubmitting(false);
      setCallingId('');
    }
  };

  const placeSingleCall = async (e) => {
    e.preventDefault();
    const to = buildE164(countryCode, localNumber);
    if (!to || localNumber.trim().length < 6) {
      toast.error('Please enter a valid destination phone number');
      return;
    }
    await placeCall({ to, name: participantName });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Test Call</h2>
          <p className="text-sm text-slate-500">
            Single number, or upload Excel — every contact is called automatically with their name.
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadSetup} disabled={loadingSetup}>
          {loadingSetup ? 'Loading…' : 'Reload Setup'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2" title="Get a Test Call" subtitle="Caller ID, routing rule, name, and destination">
          <form onSubmit={placeSingleCall} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Call From *
                </label>
                <select
                  className="custom-input text-sm font-semibold"
                  value={sipCallFrom}
                  disabled={loadingSetup}
                  onChange={(e) => setSipCallFrom(e.target.value)}
                  required
                >
                  <option value="">{loadingSetup ? 'Loading numbers…' : 'Select caller ID'}</option>
                  {activeOutboundNumbers.map((item) => (
                    <option key={item.phoneNumber.phoneNumberId} value={item.phoneNumber.e164}>
                      {item.phoneNumber.e164}
                      {item.phoneNumber.name ? ` · ${item.phoneNumber.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Routing Rule *
                </label>
                <select
                  className="custom-input text-sm font-semibold"
                  value={routingRuleId}
                  disabled={loadingSetup}
                  onChange={(e) => setRoutingRuleId(e.target.value)}
                  required
                >
                  <option value="">{loadingSetup ? 'Loading rules…' : 'Select outbound rule'}</option>
                  {outboundRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} ({rule.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Agent ID
                </label>
                <input
                  className="custom-input text-sm font-semibold bg-slate-50"
                  value={selectedRule?.dispatch?.agent?.id || '—'}
                  readOnly
                />
              </div>

              {entryMode === 'single' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Participant Name *
                  </label>
                  <input
                    className="custom-input text-sm"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Indu"
                    required={entryMode === 'single'}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Destination *
              </p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 mb-4">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    entryMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setEntryMode('single')}
                >
                  Single number
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    entryMode === 'excel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setEntryMode('excel')}
                >
                  Excel upload
                </button>
              </div>

              {entryMode === 'single' ? (
                <div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      className="custom-input text-sm font-semibold sm:!w-[220px] shrink-0"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={`${country.code}-${country.dial}`} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                        {getDialCode(countryCode)}
                      </span>
                      <input
                        className="custom-input text-sm font-semibold !pl-14"
                        value={localNumber}
                        onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
                        placeholder="9535051051"
                        inputMode="tel"
                        required={entryMode === 'single'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Full number:{' '}
                    <span className="font-semibold text-slate-600">
                      {buildE164(countryCode, localNumber) || '—'}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      className="custom-input text-sm font-semibold sm:!w-[220px] shrink-0"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={`${country.code}-${country.dial}`} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 self-center">
                      Upload Excel and every contact is called automatically. No extra clicks.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleExcelUpload}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      icon={Upload}
                      disabled={parsingFile || submitting}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {parsingFile ? 'Reading file…' : 'Upload Excel'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      icon={Download}
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = '/demo-test-call.xlsx';
                        link.download = 'demo-test-call.xlsx';
                        link.click();
                      }}
                    >
                      Download demo Excel
                    </Button>
                    {spreadsheet && (
                      <Button type="button" variant="ghost" icon={X} onClick={clearSpreadsheet}>
                        Clear file
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Header names can be anything. Only name and number are used. Calls start as soon as the file is uploaded.
                  </p>

                  {spreadsheet && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FileSpreadsheet className="w-4 h-4 mt-0.5 text-brand-600" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{spreadsheet.fileName}</p>
                            <p className="text-xs text-slate-500">
                              {bulkProgress
                                ? `Calling ${bulkProgress.done}/${bulkProgress.total}`
                                : `${mappedContacts.length} contacts loaded`}
                            </p>
                          </div>
                        </div>
                        {submitting && entryMode === 'excel' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              cancelBulkRef.current = true;
                            }}
                          >
                            Stop
                          </Button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
                        {(bulkProgress?.results || mappedContacts).length === 0 ? (
                          <p className="text-xs text-slate-400 p-3">
                            No valid name and number pairs found in this file.
                          </p>
                        ) : (
                          (bulkProgress?.results || mappedContacts).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {item.name || 'No name'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.e164} · Row {item.row}
                                  {item.message ? ` · ${item.message}` : ''}
                                </p>
                              </div>
                              {item.status ? (
                                item.status === 'success' ? (
                                  <Badge variant="success">Called</Badge>
                                ) : item.status === 'failed' ? (
                                  <Badge variant="danger">Failed</Badge>
                                ) : item.status === 'calling' ? (
                                  <Badge variant="warning">Calling…</Badge>
                                ) : (
                                  <Badge variant="info">Queued</Badge>
                                )
                              ) : callingId === item.id ? (
                                <Badge variant="warning">Calling…</Badge>
                              ) : (
                                <Badge variant="info">Ready</Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {entryMode === 'single' && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button type="submit" icon={PhoneCall} disabled={submitting || loadingSetup} className="sm:min-w-[220px]">
                  {submitting ? 'Placing call…' : 'Place Test Call'}
                </Button>
              </div>
            )}
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="Setup Summary">
            {loadingSetup ? (
              <p className="text-sm text-slate-400 py-6 text-center">Loading setup…</p>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active numbers</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{activeOutboundNumbers.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outbound rules</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{outboundRules.length}</p>
                </div>
                {selectedRule && (
                  <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Selected rule</p>
                    <p className="text-sm font-semibold text-slate-800 mt-1">{selectedRule.name}</p>
                    <p className="text-xs font-mono text-slate-500 mt-1">{selectedRule.id}</p>
                    <div className="mt-2">
                      <Badge variant="info">Agent {selectedRule.dispatch?.agent?.id || '—'}</Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title={bulkProgress ? 'Bulk Call Progress' : 'Last Call Result'}>
            {bulkProgress ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {bulkProgress.done}/{bulkProgress.total} numbers processed
                </p>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-brand-500"
                    style={{
                      width: `${bulkProgress.total ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0}%`
                    }}
                  />
                </div>
                <div className="max-h-72 overflow-auto space-y-2">
                  {bulkProgress.results.map((row) => (
                    <div key={row.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {row.name} · {row.e164}
                        </span>
                        {row.status === 'success' ? (
                          <Badge variant="success">Called</Badge>
                        ) : row.status === 'failed' ? (
                          <Badge variant="danger">Failed</Badge>
                        ) : row.status === 'calling' ? (
                          <Badge variant="warning">Calling…</Badge>
                        ) : (
                          <Badge variant="info">Queued</Badge>
                        )}
                      </div>
                      {row.message && <p className="text-[11px] text-slate-500">{row.message}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : !lastResult ? (
              <p className="text-sm text-slate-400 py-6 text-center">No test call placed yet</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{lastResult.message || 'Call initiated'}</p>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Name</span>
                    <span className="text-xs font-semibold text-slate-800">{lastResult.participantName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Call ID</span>
                    <span className="text-xs font-mono text-slate-800">{lastResult.data?.callId || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Status</span>
                    <Badge variant="warning">{lastResult.data?.status || '—'}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Room</span>
                    <span className="text-xs font-mono text-slate-800">{lastResult.data?.roomId || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">From → To</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {lastResult.data?.sipCallFrom || '—'} → {lastResult.data?.sipCallTo || '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestCallPage;
