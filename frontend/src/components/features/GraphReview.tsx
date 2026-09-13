'use client';

import { useState } from 'react';
import { api, type GraphReview } from '@/lib/api';

export function GraphReviewPanel() {
  const [ids, setIds] = useState('11155111:1073,11155111:1301');
  const [review, setReview] = useState<GraphReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="glass space-y-4 rounded-2xl p-6">
      <h3 className="text-xl">Vendor evidence (The Graph)</h3>
      <p className="text-sm text-gray-400">
        This lookup never adds payees or amounts. Approved invoice amounts stay typed by the payer.
        A stale index is evidence of access, not of current eligibility.
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
          <ul className="text-xs text-gray-400 space-y-2">
            {review.agents.map((agent) => (
              <li key={agent.id} className="break-all">
                {agent.id} · wallet {agent.wallet} · active {String(agent.active)} · feedback {agent.total_feedback}
                {agent.warning && <div>{agent.warning}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
