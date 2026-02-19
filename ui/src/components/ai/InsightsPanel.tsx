import { useState } from 'react';
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp, Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';

interface InsightsData {
  summary?: string;
  keyFindings?: string[];
  trends?: string[];
  recommendations?: string[];
}

interface InsightsPanelProps {
  reportId: string;
  reportName: string;
  data: Record<string, unknown>[];
  query: string;
}

export function InsightsPanel({
  reportId,
  reportName,
  data,
  query,
}: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          reportId,
          reportName,
          query,
          sampleData: data.slice(0, 100),
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setInsights(result);
        setIsExpanded(true);
      } else {
        setError(result.error || 'Failed to generate insights');
      }
    } catch (err) {
      setError('An error occurred while generating insights');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
      <button
        onClick={() => {
          if (!insights && !isLoading) {
            handleGenerateInsights();
          } else {
            setIsExpanded(!isExpanded);
          }
        }}
        disabled={isLoading}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-purple-900">AI Insights</span>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateInsights();
              }}
              className="p-1 hover:bg-purple-100 rounded"
              title="Refresh insights"
            >
              <RefreshCw className="w-4 h-4 text-purple-600" />
            </button>
          )}
          {insights ? (
            isExpanded ? (
              <ChevronUp className="w-5 h-5 text-purple-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-purple-600" />
            )
          ) : (
            <span className="text-sm text-purple-600">Click to generate</span>
          )}
        </div>
      </button>

      {error && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 p-3 bg-red-100 text-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {isExpanded && insights && (
        <div className="px-4 pb-4 space-y-4">
          {/* Summary */}
          {insights.summary && (
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-gray-700">{insights.summary}</p>
            </div>
          )}

          {/* Key Findings */}
          {insights.keyFindings && insights.keyFindings.length > 0 && (
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-600" />
                <h4 className="font-medium text-gray-900">Key Findings</h4>
              </div>
              <ul className="space-y-2">
                {insights.keyFindings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                      {i + 1}
                    </span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Trends */}
          {insights.trends && insights.trends.length > 0 && (
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <h4 className="font-medium text-gray-900">Trends</h4>
              </div>
              <ul className="space-y-2">
                {insights.trends.map((trend, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600">→</span>
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h4 className="font-medium text-gray-900">Recommendations</h4>
              </div>
              <ul className="space-y-2">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-purple-600">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
