'use client';

import { useState } from 'react';
import { api, type GraphAgentEvidence, type GraphReview } from '@/lib/api';

interface GraphReviewPanelProps {
  onProposeRecipient?: (wallet: string, agentId: string) => void;
}

export function GraphReviewPanel({ onProposeRecipient }: GraphReviewPanelProps) {
  const [ids, setIds] = useState('11155111:1073,11155111:1301');
  const [review, setReview] = useState<GraphReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.graphReview(ids.split(',').map((id) => id.trim()).filter(Boolean));
      setReview(result);
    } catch (e) {
      setReview(null);
      setError(e instanceof Error ? e.message : 'Graph review unavailable');
    } finally {
      setBusy(false);
    }
  }

  function propose(agent: GraphAgentEvidence) {
    if (!review?.fresh || agent.decision !== 'eligible' || !agent.wallet) {
      setError('This agent cannot be included. Stale, warned, or inactive Graph evidence never becomes a payment.');
      return;
    }
    onProposeRecipient?.(agent.wallet, agent.id);
  }

  return (
    <section className="glass space-y-4 rounded-2xl p-6">
      <h3 className="text-xl">Vendor evidence (The Graph)</h3>
      <p className="text-sm text-gray-400">
        Graph can exclude or send a wallet to the draft. It never types an amount. A stale index
        forces exclude. Last live probe on 13 Sep 2026 still indexed 4 Mar 2026.
      </p>
      <label className="block text-sm">
        Agent ids
        <input
          className="w-full rounded-xl border border-white/20 bg-white/5 p-3"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
        />
      </label>
      <button
        className="rounded-xl bg-indigo-500 px-4 py-2 text-sm text-white disabled:opacity-40"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? 'Querying…' : 'Fetch live evidence'}
      </button>
      {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
      {review && (
        <div className="text-sm space-y-2">
          <p>Fresh enough for inclusion review: {review.fresh ? 'yes' : 'no'}</p>
          <p>Indexed at: {review.indexed_at ?? 'unknown'}</p>
          <p>{review.note}</p>
          <ul className="text-xs text-gray-400 space-y-3">
            {review.agents.map((agent) => (
              <li key={agent.id} className="break-all space-y-1">
                <div>
                  {agent.id} · wallet {agent.wallet} · active {String(agent.active)} · feedback {agent.total_feedback} · {agent.decision}
                </div>
                {agent.warning && <div>{agent.warning}</div>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 px-2 py-1 text-white"
                    onClick={() => setExcluded((current) => current.includes(agent.id) ? current : [...current, agent.id])}
                  >
                    Exclude
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 px-2 py-1 text-white disabled:opacity-40"
                    disabled={!review.fresh || agent.decision !== 'eligible' || excluded.includes(agent.id)}
                    onClick={() => propose(agent)}
                  >
                    Propose wallet only
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {excluded.length > 0 && <p>Excluded: {excluded.join(', ')}</p>}
        </div>
      )}
    </section>
  );
}
