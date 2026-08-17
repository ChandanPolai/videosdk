const AGENT_API = import.meta.env.VITE_AGENT_API_BASE || '/agent-api';

const readJson = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
};

const apiUnavailable = () =>
  new Error('Script API is not running. Start the Python agent first: uv run python src/main.py');

export const fetchAgentScript = async () => {
  try {
    const response = await fetch(`${AGENT_API}/script`);
    return await readJson(response);
  } catch (err) {
    if (err instanceof TypeError) throw apiUnavailable();
    throw err;
  }
};

export const saveAgentScript = async (payload) => {
  try {
    const response = await fetch(`${AGENT_API}/script`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await readJson(response);
  } catch (err) {
    if (err instanceof TypeError) throw apiUnavailable();
    throw err;
  }
};

export const fetchDeployStatus = async () => {
  const response = await fetch(`${AGENT_API}/deploy/status`);
  return readJson(response);
};
