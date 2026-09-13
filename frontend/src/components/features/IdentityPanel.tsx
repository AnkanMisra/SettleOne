'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { useEnsPermissions } from '@/hooks/useEnsPermissions';
import { SERVICE_METADATA_KEY } from '@/lib/ensv2';

export function IdentityPanel() {
  const { chainId } = useAccount();
  const ens = useEnsPermissions();
  const [name, setName] = useState('');
  const [secondary, setSecondary] = useState('');
  const [metadata, setMetadata] = useState('{"service":"settleone-draft"}');
  const input = 'w-full rounded-xl border border-white/20 bg-white/5 p-3';
  const button = 'rounded-xl bg-indigo-500 px-4 py-2 text-sm text-white disabled:opacity-40';

  return (
    <section className="glass space-y-4 rounded-2xl p-6">
      <h3 className="text-xl">Sepolia identity (ENSv2)</h3>
      <p className="text-sm text-gray-400">
        Payments settle on Arc. Names and text permissions live on Sepolia. Switching networks is a separate
        human step. No live grant or revoke has been recorded in this repository.
      </p>
      <p className="text-xs text-amber-300">
        Connected chain id: {chainId ?? 'none'}. Identity writes require Sepolia ({sepolia.id}).
      </p>
      <label className="block text-sm">
        ENS name
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="vendor.eth" />
      </label>
      <label className="block text-sm">
        Secondary wallet (no broad grants)
        <input className={input} value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="0x…" />
      </label>
      <label className="block text-sm">
        {SERVICE_METADATA_KEY}
        <input className={input} value={metadata} onChange={(e) => setMetadata(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={ens.busy} onClick={() => void ens.grantTextRole(name, secondary)}>
          Grant service.metadata only
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.updateServiceText(name, metadata)}>
          Secondary: update text
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.simulateForbiddenWrites(name, secondary)}>
          Simulate forbidden payout write
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.revokeTextRole(name, secondary)}>
          Revoke grant
        </button>
      </div>
      {ens.error && <p role="alert" className="text-red-300 text-sm">{ens.error}</p>}
      {ens.log.length > 0 && (
        <ol className="text-xs text-gray-400 space-y-1 list-decimal pl-4">
          {ens.log.map((line, index) => (
            <li key={`${index}-${line.slice(0, 24)}`} className="break-all">{line}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
