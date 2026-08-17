const API_BASE = import.meta.env.VITE_VIDEOSDK_API_BASE || '/videosdk-api';
const TOKEN = import.meta.env.VITE_VIDEOSDK_TOKEN || '';

const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

export const apiGet = async (path, params = {}) => {
  if (!TOKEN) {
    throw new Error('API token missing. Set VITE_VIDEOSDK_TOKEN in .env');
  }

  const url = `${API_BASE}${path}${buildQuery(params)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data;
};

export const apiPost = async (path, body = {}) => {
  if (!TOKEN) {
    throw new Error('API token missing. Set VITE_VIDEOSDK_TOKEN in .env');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data;
};

export const fetchSipCalls = (params = {}) =>
  apiGet('/v2/sip/call', {
    page: 1,
    perPage: 10,
    ...params
  });

export const createSipCall = (body) => apiPost('/v2/sip/call', body);

export const fetchSipPhoneNumbers = (params = {}) =>
  apiGet('/v2/sip/phone-numbers', {
    page: 1,
    perPage: 10,
    ...params
  });

export const fetchSipRoutingRules = (params = {}) =>
  apiGet('/v2/sip/routing-rules', {
    page: 1,
    perPage: 20,
    ...params
  });

export const fetchRooms = (params = {}) =>
  apiGet('/v2/rooms', {
    page: 1,
    perPage: 10,
    ...params
  });

export const fetchRoomById = (roomId) => apiGet(`/v2/rooms/${roomId}`);

export const fetchSessions = (params = {}) =>
  apiGet('/v2/sessions/', {
    page: 1,
    perPage: 10,
    ...params
  });

export const fetchSessionById = (sessionId) => apiGet(`/v2/sessions/${sessionId}`);

export const fetchRecordings = (params = {}) =>
  apiGet('/v2/recordings', {
    page: 1,
    perPage: 10,
    ...params
  });

export const fetchParticipantRecordings = (params = {}) =>
  apiGet('/v2/recordings/participant', {
    page: 1,
    perPage: 10,
    ...params
  });

export const fetchTrackRecordings = (params = {}) =>
  apiGet('/v2/recordings/participant/track', {
    page: 1,
    perPage: 10,
    ...params
  });
