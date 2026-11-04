/** Progress of an Ollama model download, from the pull state in the store. */
export default function PullProgressBar({ status, fraction }: { status: string; fraction: number | null }) {
  const percent = fraction === null ? null : Math.round(fraction * 100);
  return (
    <div role="status" aria-live="polite" className="mb-4">
      <div
        className="h-2 bg-gray-700 rounded overflow-hidden"
        role="progressbar"
        aria-label="Model download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${percent ?? 0}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {status}
        {percent !== null && ` - ${percent}%`}
      </p>
    </div>
  );
}
