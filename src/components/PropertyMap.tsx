'use client'

import { useState } from 'react'

type MapProvider = 'google' | 'apple'

export default function PropertyMap({ address }: { address: string }) {
  const [provider, setProvider] = useState<MapProvider>('google')

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white overflow-hidden">
      {/* Map toggle */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setProvider('google')}
          disabled
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            provider === 'google'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-600'
          } opacity-50 cursor-not-allowed`}
        >
          Google Maps
        </button>
        <button
          onClick={() => setProvider('apple')}
          disabled
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            provider === 'apple'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-600'
          } opacity-50 cursor-not-allowed`}
        >
          Apple Maps
        </button>
      </div>

      {/* Placeholder */}
      <div className="flex h-48 flex-col items-center justify-center bg-neutral-50 px-4">
        <p className="text-sm font-medium text-neutral-500">Map coming soon</p>
        <p className="mt-1 text-center text-xs text-neutral-400 font-mono">{address}</p>
      </div>
    </div>
  )
}
