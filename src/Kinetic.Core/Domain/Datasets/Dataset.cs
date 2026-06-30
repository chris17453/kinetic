namespace Kinetic.Core.Domain.Datasets;

public class Dataset : IOwnedEntity
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Slug { get; set; } = string.Empty;

    public Guid? WorkspaceId { get; set; }
    public Workspaces.Workspace? Workspace { get; set; }
    public Guid? ConnectionId { get; set; }
    public Connections.Connection? Connection { get; set; }

    public DatasetSourceType SourceType { get; set; } = DatasetSourceType.Query;
    public string? SourceSchema { get; set; }
    public string? SourceTable { get; set; }
    public string? SourceQuery { get; set; }

    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; }
    public List<EntityShare> Shares { get; set; } = new();

    public List<DatasetTable> Tables { get; set; } = new();
    public List<DatasetField> Fields { get; set; } = new();
    public SemanticModelDefinition SemanticModel { get; set; } = new();

    public bool IsCertified { get; set; }
    public DateTime? CertifiedAt { get; set; }
    public Guid? CertifiedById { get; set; }
    public string? CertificationNotes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
    public DateTime? LastRefreshedAt { get; set; }
}

public enum DatasetSourceType
{
    Query,
    Table,
    Upload,
    Dataflow
}

public class DatasetTable
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string? Schema { get; set; }
    public string? DisplayName { get; set; }
    public bool IsHidden { get; set; }
}

public class DatasetField
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TableId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? SourceName { get; set; }
    public string? DisplayName { get; set; }
    public string DataType { get; set; } = "string";
    public DatasetFieldKind Kind { get; set; } = DatasetFieldKind.Dimension;
    public string? DefaultAggregation { get; set; }
    public string? FormatString { get; set; }
    public bool IsHidden { get; set; }
}

public enum DatasetFieldKind
{
    Dimension,
    Measure,
    CalculatedColumn
}

public class SemanticModelDefinition
{
    public List<SemanticRelationship> Relationships { get; set; } = new();
    public List<SemanticMeasure> Measures { get; set; } = new();
    public List<SemanticHierarchy> Hierarchies { get; set; } = new();
}

public class SemanticRelationship
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string FromTableId { get; set; } = string.Empty;
    public string FromFieldId { get; set; } = string.Empty;
    public string ToTableId { get; set; } = string.Empty;
    public string ToFieldId { get; set; } = string.Empty;
    public string Cardinality { get; set; } = "ManyToOne";
    public bool IsActive { get; set; } = true;
}

public class SemanticMeasure
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Expression { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? FormatString { get; set; }
}

public class SemanticHierarchy
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public List<string> FieldIds { get; set; } = new();
}
