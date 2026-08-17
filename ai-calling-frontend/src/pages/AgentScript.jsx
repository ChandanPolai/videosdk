import React, { useEffect, useRef, useState } from 'react';
import { CloudUpload, RefreshCw, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchAgentScript, fetchDeployStatus, saveAgentScript } from '../services/agentScriptApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const emptyScript = {
  agent_name: 'Priya',
  company: 'Raaj Investment',
  opening_line: '',
  instructions: ''
};

const AgentScriptPage = () => {
  const [script, setScript] = useState(emptyScript);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [deploy, setDeploy] = useState(null);
  const logRef = useRef(null);

  const loadScript = async () => {
    setLoading(true);
    try {
      const data = await fetchAgentScript();
      setScript({
        agent_name: data.agent_name || 'Priya',
        company: data.company || 'Raaj Investment',
        opening_line: data.opening_line || '',
        instructions: data.instructions || ''
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScript();
  }, []);

  useEffect(() => {
    if (!pushing && deploy?.status !== 'running') return undefined;
    const timer = setInterval(async () => {
      try {
        const status = await fetchDeployStatus();
        setDeploy(status);
        if (status.status === 'success') {
          setPushing(false);
          toast.success('Pushed to VideoSDK');
        } else if (status.status === 'error') {
          setPushing(false);
          toast.error(status.error || 'VideoSDK push failed');
        }
      } catch {
        /* keep polling while the agent API restarts */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [pushing, deploy?.status]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [deploy?.log]);

  const persist = async (push) => {
    if (!script.opening_line.trim() || !script.instructions.trim()) {
      toast.error('Opening line and script both required');
      return;
    }
    setSaving(true);
    if (push) setPushing(true);
    try {
      const saved = await saveAgentScript({ ...script, push });
      setScript({
        agent_name: saved.agent_name,
        company: saved.company,
        opening_line: saved.opening_line,
        instructions: saved.instructions
      });
      if (push) {
        setDeploy(saved.deploy || { status: 'running', log: [] });
        if (saved.push_started === false) {
          setPushing(false);
          toast.error('A VideoSDK push is already running');
        } else {
          toast.success('Saved. Pushing to VideoSDK…');
        }
      } else {
        toast.success('Script saved. Restart local agent to use it on this machine.');
      }
    } catch (err) {
      setPushing(false);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Agent Script</h2>
          <p className="text-sm text-slate-500">
            Call start pe yeh opening line turant boli jaati hai. Save & Push VideoSDK cloud pe deploy karta hai.
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadScript} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card
          className="xl:col-span-2"
          title="IPO calling script"
          subtitle="Client script ke hisaab se pehla sawaal aur poora prompt"
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              persist(true);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Agent name
                </label>
                <input
                  className="custom-input text-sm font-semibold"
                  value={script.agent_name}
                  disabled={loading}
                  onChange={(e) => setScript((prev) => ({ ...prev, agent_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Company
                </label>
                <input
                  className="custom-input text-sm font-semibold"
                  value={script.company}
                  disabled={loading}
                  onChange={(e) => setScript((prev) => ({ ...prev, company: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Opening line — call connect hote hi turant
              </label>
              <input
                className="custom-input text-sm font-semibold"
                value={script.opening_line}
                disabled={loading}
                onChange={(e) => setScript((prev) => ({ ...prev, opening_line: e.target.value }))}
                placeholder="Hello, kya main aapse baat kar rahi hoon?"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                System prompt
              </label>
              <textarea
                className="w-full min-h-[420px] rounded-[10px] border-[1.5px] border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-brand-500 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                value={script.instructions}
                disabled={loading}
                onChange={(e) => setScript((prev) => ({ ...prev, instructions: e.target.value }))}
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="secondary"
                icon={Save}
                disabled={loading || saving}
                onClick={() => persist(false)}
              >
                Save locally
              </Button>
              <Button type="submit" icon={CloudUpload} disabled={loading || saving || pushing}>
                {pushing ? 'Pushing to VideoSDK…' : 'Save & Push to VideoSDK'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="VideoSDK push" subtitle="uv run videosdk agent up">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Status:{' '}
              <span className="font-bold text-slate-900">{deploy?.status || 'idle'}</span>
            </p>
            {deploy?.image && (
              <p className="text-xs text-slate-500 break-all">Image: {deploy.image}</p>
            )}
            <pre
              ref={logRef}
              className="h-80 overflow-auto rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-5 p-4"
            >
              {(deploy?.log || []).join('\n') || 'Save & Push ke baad yahan logs dikhenge.'}
            </pre>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AgentScriptPage;
