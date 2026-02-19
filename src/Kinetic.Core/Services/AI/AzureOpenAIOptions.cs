namespace Kinetic.Core.Services.AI;

public class AzureOpenAIOptions
{
    public const string SectionName = "AzureOpenAI";
    
    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string DeploymentName { get; set; } = "gpt-4o";
    public string EmbeddingDeployment { get; set; } = "text-embedding-3-small";
    public int MaxTokens { get; set; } = 4096;
    public float Temperature { get; set; } = 0.3f;
}
