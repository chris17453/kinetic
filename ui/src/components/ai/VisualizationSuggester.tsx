import { useState } from 'react';
import { Sparkles, Loader2, BarChart3, LineChart, PieChart, Table, Activity, TrendingUp } from 'lucide-react';

type VisualizationType = 
  | 'table' 
  | 'bar' 
  | 'line' 
  | 'area' 
  | 'pie' 
  | 'doughnut' 
  | 'scatter' 
  | 'gauge' 
  | 'kpi';

interface VisualizationSuggestion {
  recommendedType: VisualizationType;
  reasoning: string;
  alternativeTypes: VisualizationType[];
  suggestedMappings: Record<string, string>;
}

interface VisualizationSuggesterProps {
  columns: { name: string; dataType: string }[];
  rowCount: number;
  onSelect: (type: VisualizationType, mappings: Record<string, string>) => void;
}

const visualizationIcons: Record<VisualizationType, React.ReactNode> = {
  table: <Table className="w-5 h-5" />,
  bar: <BarChart3 className="w-5 h-5" />,
  line: <LineChart className="w-5 h-5" />,
  area: <TrendingUp className="w-5 h-5" />,
  pie: <PieChart className="w-5 h-5" />,
  doughnut: <PieChart className="w-5 h-5" />,
  scatter: <Activity className="w-5 h-5" />,
  gauge: <Activity className="w-5 h-5" />,
  kpi: <BarChart3 className="w-5 h-5" />,
};

export function VisualizationSuggester({
  columns,
  rowCount,
  onSelect,
}: VisualizationSuggesterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<VisualizationSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestion = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/suggest-visualization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          columns,
          rowCount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuggestion(data);
      } else {
        setError(data.error || 'Failed to get suggestion');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!suggestion) {
    return (
      <button
        onClick={handleGetSuggestion}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        Suggest Visualization
      </button>
    );
  }

  return (
    <div className="border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-medium text-purple-900">AI Recommendation</h3>
        </div>
        <p className="text-sm text-gray-600">{suggestion.reasoning}</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-2">Recommended</p>
        <button
          onClick={() => onSelect(suggestion.recommendedType, suggestion.suggestedMappings)}
          className="w-full flex items-center gap-3 p-4 bg-purple-100 text-purple-900 rounded-lg hover:bg-purple-200 transition-colors mb-3"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-lg">
            {visualizationIcons[suggestion.recommendedType]}
          </div>
          <div className="text-left">
            <p className="font-medium capitalize">{suggestion.recommendedType} Chart</p>
            {suggestion.suggestedMappings.xAxis && (
              <p className="text-xs text-purple-600">
                X: {suggestion.suggestedMappings.xAxis} / Y: {suggestion.suggestedMappings.yAxis}
              </p>
            )}
          </div>
        </button>

        {suggestion.alternativeTypes.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-2">Alternatives</p>
            <div className="grid grid-cols-3 gap-2">
              {suggestion.alternativeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => onSelect(type, suggestion.suggestedMappings)}
                  className="flex flex-col items-center gap-1 p-3 bg-white rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                >
                  <div className="text-gray-600">
                    {visualizationIcons[type]}
                  </div>
                  <span className="text-xs capitalize">{type}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end p-3 border-t">
        <button
          onClick={() => setSuggestion(null)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Get new suggestion
        </button>
      </div>
    </div>
  );
}
