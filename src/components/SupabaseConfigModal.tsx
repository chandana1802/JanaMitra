import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  Server,
  Layers,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConnectionChange,
}) => {
  const [projectUrl, setProjectUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesFound?: boolean;
  } | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'guide'>('config');

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig();
      setProjectUrl(config.url);
      setAnonKey(config.key);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(projectUrl, anonKey);
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      saveSupabaseConfig(projectUrl, anonKey);
      onConnectionChange();
    }
  };

  const handleClear = () => {
    clearSupabaseConfig();
    setProjectUrl('');
    setAnonKey('');
    setTestResult(null);
    onConnectionChange();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Supabase Backend Configuration</h3>
              <p className="text-xs text-slate-400">
                Janamitra Municipal Complaint Management System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 space-x-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg border-t border-x border-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Connection & Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
              activeTab === 'schema'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg border-t border-x border-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Database SQL Migrations</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg border-t border-x border-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Setup Checklist</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start space-x-3 text-blue-900 text-sm">
                <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Security Note:</span> Only provide your Supabase{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded text-xs font-mono font-bold">
                    anon
                  </code>{' '}
                  public key and Project URL. Never paste database passwords or the privileged{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded text-xs font-mono font-bold">
                    service_role
                  </code>{' '}
                  key in the browser.
                </div>
              </div>

              <form onSubmit={handleTestAndSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Supabase Publishable Key (anon public key)
                  </label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API Keys &rarr; anon public
                  </p>
                </div>

                {testResult && (
                  <div
                    className={`p-4 rounded-xl border flex items-start space-x-3 text-sm ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {testResult.success ? 'Connection Validated' : 'Connection Failed'}
                      </div>
                      <div className="text-xs mt-0.5">{testResult.message}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-medium text-slate-500 hover:text-rose-600 hover:underline"
                  >
                    Clear Credentials
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={testing || !projectUrl || !anonKey}
                      className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center space-x-2 shadow-sm"
                    >
                      {testing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Testing Ping...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save & Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Execute these SQL files in your{' '}
                <a
                  href="https://supabase.com/dashboard/project/ldtkpmarnsoztowjrhxo/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 font-bold inline-flex items-center hover:underline"
                >
                  Supabase SQL Editor (ldtkpmarnsoztowjrhxo) <ExternalLink className="w-3 h-3 ml-1" />
                </a>{' '}
                to create all required tables, triggers, and Row Level Security policies.
              </p>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">1. Database Schema & Tables</div>
                    <div className="text-xs text-slate-500">
                      Creates departments, profiles, complaints, status history, and indexes
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        `-- View file /supabase/schema.sql in the repo or download it`,
                        'schema'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 rounded-lg flex items-center space-x-1.5 transition"
                  >
                    {copiedTab === 'schema' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy Path</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">2. Row Level Security (RLS)</div>
                    <div className="text-xs text-slate-500">
                      Hardened policies for citizens, public tracking, and officer actions
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        `-- View file /supabase/rls_policies.sql in repo`,
                        'rls'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 rounded-lg flex items-center space-x-1.5 transition"
                  >
                    {copiedTab === 'rls' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy Path</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">3. Seed Departments & Data</div>
                    <div className="text-xs text-slate-500">
                      Populates 7 municipal departments (SWM, PWD, BWSSB, SWD, ELEC, PHS, HORT)
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(`-- View file /supabase/seed.sql in repo`, 'seed')
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 rounded-lg flex items-center space-x-1.5 transition"
                  >
                    {copiedTab === 'seed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy Path</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-sm text-slate-700">
              <ol className="list-decimal list-inside space-y-2.5">
                <li className="font-medium">
                  Create project at{' '}
                  <span className="font-bold text-slate-900">supabase.com</span> named{' '}
                  <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">
                    Janamitra
                  </code>
                </li>
                <li className="font-medium">
                  Open <span className="font-bold text-slate-900">SQL Editor</span> and execute{' '}
                  <code className="text-slate-800 font-mono bg-slate-100 px-1 py-0.5 rounded">
                    schema.sql
                  </code>
                  ,{' '}
                  <code className="text-slate-800 font-mono bg-slate-100 px-1 py-0.5 rounded">
                    rls_policies.sql
                  </code>
                  , and{' '}
                  <code className="text-slate-800 font-mono bg-slate-100 px-1 py-0.5 rounded">
                    seed.sql
                  </code>
                </li>
                <li className="font-medium">
                  Create a public Storage bucket named{' '}
                  <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">
                    complaint-evidence
                  </code>{' '}
                  (under Storage &rarr; New Bucket)
                </li>
                <li className="font-medium">
                  Copy <span className="font-bold">Project URL</span> &{' '}
                  <span className="font-bold">anon key</span> from Project Settings &rarr; API into the{' '}
                  <span className="text-emerald-600 font-bold">Connection & Keys</span> tab above!
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
