import { useState } from 'react';
import { Sparkles, Send, Loader2, X, Copy, Check } from 'lucide-react';

interface QueryAssistantProps {
  connectionId: string;
  onQueryGenerated: (sql: string) => void;
  schema?: string;
  databaseType?: string;
}

export function QueryAssistant({
  connectionId,
  onQueryGenerated,
  schema,
  databaseType = 'SqlServer',
}: QueryAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    sql?: string;
    explanation?: string;
    warnings?: string[];
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai/generate-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          naturalLanguageQuery: prompt,
          connectionId,
          databaseSchema: schema,
          databaseType,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({
          sql: data.sql,
          explanation: data.explanation,
          warnings: data.warnings,
        });
      } else {
        setResult({ error: data.error || 'Failed to generate SQL' });
      }
    } catch (error) {
      setResult({ error: 'An error occurred while generating SQL' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseQuery = () => {
    if (result?.sql) {
      onQueryGenerated(result.sql);
      setIsOpen(false);
      setPrompt('');
      setResult(null);
    }
  };

  const handleCopy = async () => {
    if (result?.sql) {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200"
      >
        <Sparkles className="w-4 h-4" />
        AI Assistant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold">AI Query Assistant</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe what data you want to retrieve:
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Show me the top 10 customers by total order value in the last 30 days"
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) {
                          handleGenerate();
                        }
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Press ⌘+Enter to generate
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Generate SQL
                  </button>
                </div>

                {result && (
                  <div className="space-y-4">
                    {result.error ? (
                      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                        {result.error}
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">
                              Generated SQL:
                            </label>
                            <button
                              onClick={handleCopy}
                              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                            >
                              {copied ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              {copied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-sm font-mono">
                            {result.sql}
                          </pre>
                        </div>

                        {result.explanation && (
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 mb-1">Explanation:</p>
                            <p className="text-sm text-blue-700">{result.explanation}</p>
                          </div>
                        )}

                        {result.warnings && result.warnings.length > 0 && (
                          <div className="p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm font-medium text-yellow-800 mb-1">Warnings:</p>
                            <ul className="list-disc list-inside text-sm text-yellow-700">
                              {result.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {result?.sql && (
                <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUseQuery}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Sparkles className="w-4 h-4" />
                    Use This Query
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
