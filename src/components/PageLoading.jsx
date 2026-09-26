import React from 'react';

// Shown for the moment a screen's code is loading; matches the app background so there is no flash.
export function PageLoading() {
  return (
    <div className="h-[100dvh] w-full bg-zinc-950 flex items-center justify-center" role="status" aria-live="polite">
      <span className="text-xs text-zinc-500">Loading…</span>
    </div>
  );
}
