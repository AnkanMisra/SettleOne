'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useEnsPermissions } from '@/hooks/useEnsPermissions';
import { SERVICE_METADATA_KEY } from '@/lib/ensv2';

export function IdentityPanel() {
  const { chainId, address } = useAccount();
  const ens = useEnsPermissions();
  const [name, setName] = useState('ankanmisra.eth');
  const [secondary, setSecondary] = useState('');
  const [secondaryKey, setSecondaryKey] = useState<Hex | null>(null);
  const [metadata, setMetadata] = useState('{"service":"settleone-draft"}');
  const input = 'w-full rounded-xl border border-white/20 bg-white/5 p-3';
  const button = 'rounded-xl bg-indigo-500 px-4 py-2 text-sm text-white disabled:opacity-40';

  function generateSecondary() {
    const key = generatePrivateKey();
    setSecondaryKey(key);
    setSecondary(privateKeyToAccount(key).address);
  }

  return (
    <section className="glass space-y-4 rounded-2xl p-6">
      <h3 className="text-xl">Sepolia identity (ENSv2)</h3>
      <p className="text-sm text-gray-400">
        Ignore app.ens.dev if Jio shows a bad certificate. Use this panel. Mainnet
        ankanmisra.eth is not a Sepolia registration. Switch MetaMask to Sepolia, faucet ETH,
        then run these steps. The generated secondary never leaves this browser tab.
      </p>
      <p className="text-xs text-amber-300">
        Connected {address ?? 'none'} on chain {chainId ?? 'none'}. Writes need Sepolia ({sepolia.id}).
      </p>
      <label className="block text-sm">
        Sepolia ENS name
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm">
        Secondary
        <input className={input} value={secondary} onChange={(e) => { setSecondary(e.target.value); setSecondaryKey(null); }} />
      </label>
      <button type="button" className={button} onClick={generateSecondary}>
        Generate unused secondary
      </button>
      <label className="block text-sm">
        {SERVICE_METADATA_KEY}
        <input className={input} value={metadata} onChange={(e) => setMetadata(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={ens.busy} onClick={() => void ens.inspectName(name)}>
          1. Resolve resolver
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.grantTextRole(name, secondary)}>
          2. Owner grants service.metadata
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.fundSecondary(secondary)}>
          2b. Owner funds secondary
        </button>
        <button
          className={button}
          disabled={ens.busy || !secondaryKey}
          onClick={() => secondaryKey && void ens.updateServiceTextAsSecondary(name, metadata, secondaryKey)}
        >
          3. Secondary updates text
        </button>
        <button
          className={button}
          disabled={ens.busy || !secondaryKey}
          onClick={() => secondaryKey && void ens.simulateForbiddenAsSecondary(name, secondary, secondaryKey)}
        >
          4. Secondary forbidden setAddr
        </button>
        <button className={button} disabled={ens.busy} onClick={() => void ens.revokeTextRole(name, secondary)}>
          5. Owner revokes
        </button>
        <button
          className={button}
          disabled={ens.busy || !secondaryKey}
          onClick={() => secondaryKey && void ens.updateServiceTextAsSecondary(name, metadata, secondaryKey)}
        >
          6. Secondary text after revoke
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
