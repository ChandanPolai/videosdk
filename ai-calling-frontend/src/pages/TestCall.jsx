import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, Plus, Trash2, RefreshCw, Upload, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  createSipCall,
  fetchSipPhoneNumbers,
  fetchSipRoutingRules
} from '../services/videosdkApi';
import { COUNTRY_CODES, buildE164, getDialCode } from '../utils/countryCodes';
import { guessPhoneColumn, parseSpreadsheetFile } from '../utils/parseSpreadsheet';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const MAX_BULK_NUMBERS = 200;
const CALL_GAP_MS = 500;

const emptyMetaRow = () => ({ id: `${Date.now()}-${Math.random()}`, key: '', value: '' });

const normalizePhone = (value = '') => {
  const trimmed = String(value).trim().replace(/[\s()-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d+$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TestCallPage = () => {
  const fileInputRef = useRef(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [routingRules, setRoutingRules] = useState([]);

  const [sipCallFrom, setSipCallFrom] = useState('');
  const [routingRuleId, setRoutingRuleId] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [localNumber, setLocalNumber] = useState('');
  const [participantName, setParticipantName] = useState('Test Caller');
  const [recordAudio, setRecordAudio] = useState(true);
  const [waitUntilAnswered, setWaitUntilAnswered] = useState(false);
  const [ringingTimeout, setRingingTimeout] = useState(30);
  const [metaRows, setMetaRows] = useState([emptyMetaRow()]);
  const [lastResult, setLastResult] = useState(null);

  const [entryMode, setEntryMode] = useState('single');
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [parsingFile, setParsingFile] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

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

  const mappedNumbers = useMemo(() => {
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
        e164
      });
    });

    return items;
  }, [spreadsheet, phoneColumn, countryCode]);

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

      const firstActive = numbers.find(
        (item) => item?.phoneNumber?.status === 'ACTIVE' && item?.outbound?.id
      );
      const firstOutboundRule = rules.find((rule) => String(rule.type).toLowerCase() === 'outbound');

      setSipCallFrom((prev) => prev || firstActive?.phoneNumber?.e164 || '');
      setRoutingRuleId((prev) => prev || firstOutboundRule?.id || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load call setup');
    } finally {
      setLoadingSetup(false);
    }
  };

  useEffect(() => {
    loadSetup();
  }, []);

  const updateMetaRow = (id, field, value) => {
    setMetaRows((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeMetaRow = (id) => {
    setMetaRows((rows) => (rows.length <= 1 ? [emptyMetaRow()] : rows.filter((row) => row.id !== id)));
  };

  const buildMetadata = () => {
    const metadata = {};
    metaRows.forEach((row) => {
      const key = row.key.trim();
      if (!key) return;
      metadata[key] = row.value;
    });
    return metadata;
  };

  const clearSpreadsheet = () => {
    setSpreadsheet(null);
    setPhoneColumn('');
    setBulkProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsingFile(true);
    setBulkProgress(null);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.headers.length) {
        throw new Error('No columns found in the Excel file');
      }
      setSpreadsheet(parsed);
      setPhoneColumn(guessPhoneColumn(parsed.headers));
      toast.success(`Loaded ${parsed.fileName}. Map the mobile number column to continue.`);
    } catch (err) {
      clearSpreadsheet();
      toast.error(err.message || 'Failed to read Excel file');
    } finally {
      setParsingFile(false);
    }
  };

  const buildCallPayload = (to) => {
    const from = normalizePhone(sipCallFrom);
    const selectedNumber = activeOutboundNumbers.find((item) => item.phoneNumber?.e164 === from);
    const metadata = buildMetadata();

    return {
      sipCallFrom: from,
      sipCallTo: to,
      routingRuleId,
      gatewayId: selectedNumber?.outbound?.id || undefined,
      participant: {
        name: participantName.trim() || 'Test Caller'
      },
      recordAudio,
      waitUntilAnswered,
      ringingTimeout: Number(ringingTimeout) || 30,
      ...(Object.keys(metadata).length ? { metadata } : {})
    };
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

  const placeSingleCall = async () => {
    const to = buildE164(countryCode, localNumber);
    if (!to || localNumber.trim().length < 6) {
      toast.error('Please enter a valid destination phone number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createSipCall(buildCallPayload(to));
      setLastResult(res);
      toast.success(res.message || 'Test call initiated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to place test call');
    } finally {
      setSubmitting(false);
    }
  };

  const placeBulkCalls = async () => {
    if (!spreadsheet) {
      toast.error('Please upload an Excel file');
      return;
    }
    if (!phoneColumn) {
      toast.error('Please map the mobile number column');
      return;
    }
    if (!mappedNumbers.length) {
      toast.error('No valid mobile numbers found in the mapped column');
      return;
    }

    const numbers = mappedNumbers.slice(0, MAX_BULK_NUMBERS);
    if (mappedNumbers.length > MAX_BULK_NUMBERS) {
      toast.warn(`Only the first ${MAX_BULK_NUMBERS} unique numbers will be called`);
    }

    setSubmitting(true);
    setLastResult(null);
    setBulkProgress({
      total: numbers.length,
      done: 0,
      results: numbers.map((item) => ({ ...item, status: 'queued', message: '' }))
    });

    let successCount = 0;
    let failCount = 0;
    let lastSuccess = null;

    for (let i = 0; i < numbers.length; i += 1) {
      const item = numbers[i];

      setBulkProgress((prev) => ({
        ...prev,
        results: prev.results.map((row, idx) =>
          idx === i ? { ...row, status: 'calling' } : row
        )
      }));

      try {
        const res = await createSipCall(buildCallPayload(item.e164));
        successCount += 1;
        lastSuccess = res;
        setBulkProgress((prev) => ({
          ...prev,
          done: i + 1,
          results: prev.results.map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  status: 'success',
                  message: res.message || 'Call initiated',
                  callId: res.data?.callId || '',
                  roomId: res.data?.roomId || ''
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
            idx === i
              ? { ...row, status: 'failed', message: err.message || 'Failed to place call' }
              : row
          )
        }));
      }

      if (i < numbers.length - 1) {
        await wait(CALL_GAP_MS);
      }
    }

    if (lastSuccess) setLastResult(lastSuccess);

    if (failCount === 0) {
      toast.success(`Test calls placed for all ${successCount} numbers`);
    } else if (successCount === 0) {
      toast.error(`All ${failCount} test calls failed`);
    } else {
      toast.warn(`${successCount} calls placed, ${failCount} failed`);
    }

    setSubmitting(false);
  };

  const placeTestCall = async (e) => {
    e.preventDefault();
    if (!validateSetup()) return;

    if (entryMode === 'excel') {
      await placeBulkCalls();
      return;
    }

    await placeSingleCall();
  };

  const resultBadge = (status) => {
    if (status === 'success') return <Badge variant="success">Success</Badge>;
    if (status === 'failed') return <Badge variant="danger">Failed</Badge>;
    if (status === 'calling') return <Badge variant="warning">Calling…</Badge>;
    return <Badge variant="info">Queued</Badge>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Test Call</h2>
          <p className="text-sm text-slate-500">
            Place a single test call, or upload Excel and map the mobile column to call each number
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadSetup} disabled={loadingSetup}>
          {loadingSetup ? 'Loading…' : 'Reload Setup'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2" title="Get a Test Call" subtitle="Choose caller ID, routing rule, and destination numbers">
          <form onSubmit={placeTestCall} className="space-y-5">
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

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Participant Name
                </label>
                <input
                  className="custom-input text-sm"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Test Caller"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Destination numbers *
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
                        placeholder="8347325704"
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
                      Used when Excel numbers do not already include a country code
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
                    {spreadsheet && (
                      <Button type="button" variant="ghost" icon={X} onClick={clearSpreadsheet}>
                        Clear file
                      </Button>
                    )}
                  </div>

                  {spreadsheet && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <FileSpreadsheet className="w-4 h-4 mt-0.5 text-brand-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{spreadsheet.fileName}</p>
                          <p className="text-xs text-slate-500">
                            Sheet: {spreadsheet.sheetName} · {spreadsheet.headers.length} columns ·{' '}
                            {spreadsheet.rows.length} rows
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Mobile number column *
                        </label>
                        <select
                          className="custom-input text-sm font-semibold bg-white"
                          value={phoneColumn}
                          onChange={(e) => setPhoneColumn(e.target.value)}
                          required={entryMode === 'excel'}
                        >
                          <option value="">Select the phone column</option>
                          {spreadsheet.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1.5">
                          Extra Excel fields are ignored. Only this mapped column is used.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                          {mappedNumbers.length} unique valid number
                          {mappedNumbers.length === 1 ? '' : 's'} ready
                          {mappedNumbers.length > MAX_BULK_NUMBERS
                            ? ` (first ${MAX_BULK_NUMBERS} will be called)`
                            : ''}
                        </p>
                        <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white">
                          {mappedNumbers.length === 0 ? (
                            <p className="text-xs text-slate-400 p-3">
                              No valid numbers in this column. Map a different field.
                            </p>
                          ) : (
                            mappedNumbers.slice(0, 50).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 last:border-b-0"
                              >
                                <span className="text-xs font-semibold text-slate-800">{item.e164}</span>
                                <span className="text-[11px] text-slate-400">Row {item.row}</span>
                              </div>
                            ))
                          )}
                        </div>
                        {mappedNumbers.length > 50 && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Showing first 50 of {mappedNumbers.length}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordAudio}
                  onChange={(e) => setRecordAudio(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-semibold text-slate-700">Record audio</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waitUntilAnswered}
                  onChange={(e) => setWaitUntilAnswered(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-semibold text-slate-700">Wait until answered</span>
              </label>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Ringing timeout (sec)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  className="custom-input text-sm"
                  value={ringingTimeout}
                  onChange={(e) => setRingingTimeout(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Metadata</p>
                  <p className="text-xs text-slate-400">Optional key–value pairs for routing or tracking</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={Plus}
                  onClick={() => setMetaRows((rows) => [...rows, emptyMetaRow()])}
                >
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {metaRows.map((row) => (
                  <div key={row.id} className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="custom-input text-sm"
                      placeholder="Key (e.g. campaignId)"
                      value={row.key}
                      onChange={(e) => updateMetaRow(row.id, 'key', e.target.value)}
                    />
                    <input
                      className="custom-input text-sm"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => updateMetaRow(row.id, 'value', e.target.value)}
                    />
                    <Button type="button" size="sm" variant="ghost" icon={Trash2} onClick={() => removeMetaRow(row.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" icon={PhoneCall} disabled={submitting || loadingSetup} className="sm:min-w-[220px]">
                {submitting
                  ? entryMode === 'excel'
                    ? `Placing calls… ${bulkProgress?.done || 0}/${bulkProgress?.total || 0}`
                    : 'Placing call…'
                  : entryMode === 'excel'
                    ? `Place Test Calls${mappedNumbers.length ? ` (${Math.min(mappedNumbers.length, MAX_BULK_NUMBERS)})` : ''}`
                    : 'Place Test Call'}
              </Button>
            </div>
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
                <div className="max-h-72 overflow-auto space-y-2">
                  {bulkProgress.results.map((row) => (
                    <div key={row.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">{row.e164}</span>
                        {resultBadge(row.status)}
                      </div>
                      {row.message && <p className="text-[11px] text-slate-500">{row.message}</p>}
                      {row.callId && (
                        <p className="text-[11px] font-mono text-slate-400">Call ID {row.callId}</p>
                      )}
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
