import { useState } from 'react';
import { Info, Loader2, X } from 'lucide-react';

interface QueryExplainerProps {
  query: string;
  databaseType?: string;
}

export function QueryExplainer({ query, databaseType = 'SqlServer' }: QueryExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExplain = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const response = await fetch('/api/ai/explain-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          sql: query,
          databaseType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setExplanation(data.explanation);
      } else {
        setError(data.error || 'Failed to explain query');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleExplain}
        disabled={isLoading || !query.trim()}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50"
        title="Explain this query"
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Info className="w-3 h-3" />
        )}
        Explain
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Query Explanation</h2>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Query:</p>
                  <pre className="p-3 bg-gray-100 rounded-lg text-xs font-mono overflow-x-auto">
                    {query}
                  </pre>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : error ? (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                    {error}
                  </div>
                ) : explanation ? (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">
                      {explanation}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
