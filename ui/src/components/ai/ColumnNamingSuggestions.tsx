import { useState } from 'react';
import { Sparkles, Loader2, Check } from 'lucide-react';

interface ColumnSuggestion {
  original: string;
  suggested: string;
  applied: boolean;
}

interface ColumnNamingSuggestionsProps {
  columns: { name: string; displayName: string }[];
  onApply: (mappings: Record<string, string>) => void;
  context?: string;
}

export function ColumnNamingSuggestions({
  columns,
  onApply,
  context,
}: ColumnNamingSuggestionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ColumnSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/suggest-column-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          columnNames: columns.map((c) => c.name),
          context,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const newSuggestions = columns.map((col) => ({
          original: col.name,
          suggested: data[col.name] || col.displayName,
          applied: false,
        }));
        setSuggestions(newSuggestions);
      } else {
        setError(data.error || 'Failed to get suggestions');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSuggestion = (index: number) => {
    setSuggestions(
      suggestions.map((s, i) =>
        i === index ? { ...s, applied: !s.applied } : s
      )
    );
  };

  const handleApplyAll = () => {
    setSuggestions(suggestions.map((s) => ({ ...s, applied: true })));
  };

  const handleApplySelected = () => {
    const mappings: Record<string, string> = {};
    suggestions.forEach((s) => {
      if (s.applied) {
        mappings[s.original] = s.suggested;
      }
    });
    onApply(mappings);
  };

  if (suggestions.length === 0) {
    return (
      <button
        onClick={handleGetSuggestions}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        Suggest Column Names
      </button>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      <div className="flex items-center justify-between p-3 border-b bg-purple-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-medium text-purple-900">AI Column Name Suggestions</span>
        </div>
        <button
          onClick={handleApplyAll}
          className="text-sm text-purple-600 hover:underline"
        >
          Select All
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="divide-y max-h-64 overflow-y-auto">
        {suggestions.map((suggestion, index) => (
          <label
            key={suggestion.original}
            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={suggestion.applied}
              onChange={() => handleToggleSuggestion(index)}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">Current</span>
                <p className="text-sm font-mono text-gray-700">{suggestion.original}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Suggested</span>
                <p className="text-sm text-gray-900">{suggestion.suggested}</p>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 p-3 border-t bg-gray-50">
        <button
          onClick={() => setSuggestions([])}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleApplySelected}
          disabled={!suggestions.some((s) => s.applied)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Apply Selected
        </button>
      </div>
    </div>
  );
}
