namespace Kinetic.Core.Domain;

public class QueryExecutionLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ReportId { get; set; }
    public Guid? ConnectionId { get; set; }
    public string? QueryHash { get; set; }
    public bool Success { get; set; }
    public int RowsReturned { get; set; }
    public int DurationMs { get; set; }
    public string? ErrorMessage { get; set; }
    public bool WasCached { get; set; }
    public DateTime ExecutedAt { get; set; }
}
