using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Connections;
using Kinetic.Data;
using Kinetic.Adapters.Core;
using System.Security.Cryptography;
using System.Text;

namespace Kinetic.Api.Services;

public interface IConnectionService
{
    Task<IEnumerable<Connection>> GetConnectionsAsync(Guid userId, int page = 1, int pageSize = 25);
    Task<Connection?> GetConnectionByIdAsync(Guid id);
    Task<Connection> CreateConnectionAsync(CreateConnectionRequest request, Guid userId);
    Task<Connection?> UpdateConnectionAsync(Guid id, UpdateConnectionRequest request);
    Task<bool> DeleteConnectionAsync(Guid id);
    Task<ConnectionTestResult> TestConnectionAsync(Guid id);
    Task<ConnectionTestResult> TestConnectionStringAsync(ConnectionType type, string connectionString);
    Task<DatabaseSchema> GetSchemaAsync(Guid connectionId);
    Task<List<ColumnInfo>> GetTableColumnsAsync(Guid connectionId, string tableName, string? schemaName = null);
    Task<int> GetConnectionCountAsync(Guid userId);
    string DecryptConnectionString(Connection connection);
}

public class ConnectionService : IConnectionService
{
    private readonly KineticDbContext _db;
    private readonly IAdapterFactory _adapterFactory;
    private readonly string _encryptionKey;

    public ConnectionService(KineticDbContext db, IAdapterFactory adapterFactory, string encryptionKey)
    {
        _db = db;
        _adapterFactory = adapterFactory;
        _encryptionKey = encryptionKey;
    }

    public async Task<IEnumerable<Connection>> GetConnectionsAsync(Guid userId, int page = 1, int pageSize = 25)
    {
        var userGroupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        return await _db.Connections
            .Where(c => c.IsActive)
            .Where(c => 
                (c.OwnerType == OwnerType.User && c.OwnerId == userId) ||
                (c.OwnerType == OwnerType.Group && userGroupIds.Contains(c.OwnerId)) ||
                c.Visibility == Visibility.Public)
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<Connection?> GetConnectionByIdAsync(Guid id)
    {
        return await _db.Connections.FindAsync(id);
    }

    public async Task<Connection> CreateConnectionAsync(CreateConnectionRequest request, Guid userId)
    {
        var connection = new Connection
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Type = request.Type,
            ConnectionString = EncryptConnectionString(request.ConnectionString),
            OwnerType = OwnerType.User,
            OwnerId = userId,
            Visibility = request.Visibility,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId,
            IsActive = true
        };

        _db.Connections.Add(connection);
        await _db.SaveChangesAsync();

        return connection;
    }

    public async Task<Connection?> UpdateConnectionAsync(Guid id, UpdateConnectionRequest request)
    {
        var connection = await _db.Connections.FindAsync(id);
        if (connection == null) return null;

        if (request.Name != null)
            connection.Name = request.Name;
        
        if (request.Description != null)
            connection.Description = request.Description;

        if (request.ConnectionString != null)
            connection.ConnectionString = EncryptConnectionString(request.ConnectionString);

        if (request.Visibility.HasValue)
            connection.Visibility = request.Visibility.Value;

        connection.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return connection;
    }

    public async Task<bool> DeleteConnectionAsync(Guid id)
    {
        var connection = await _db.Connections.FindAsync(id);
        if (connection == null) return false;

        connection.IsActive = false;
        connection.UpdatedAt = DateTime.UtcNow;
        
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<ConnectionTestResult> TestConnectionAsync(Guid id)
    {
        var connection = await _db.Connections.FindAsync(id);
        if (connection == null)
        {
            return ConnectionTestResult.Failed("Connection not found");
        }

        var adapter = _adapterFactory.GetAdapter(connection.Type);
        var decryptedConnStr = Decrypt(connection.ConnectionString);
        
        return await adapter.TestConnectionAsync(decryptedConnStr);
    }

    public async Task<ConnectionTestResult> TestConnectionStringAsync(ConnectionType type, string connectionString)
    {
        var adapter = _adapterFactory.GetAdapter(type);
        return await adapter.TestConnectionAsync(connectionString);
    }

    public async Task<DatabaseSchema> GetSchemaAsync(Guid connectionId)
    {
        var connection = await _db.Connections.FindAsync(connectionId);
        if (connection == null)
        {
            throw new InvalidOperationException("Connection not found");
        }

        var adapter = _adapterFactory.GetAdapter(connection.Type);
        var decryptedConnStr = Decrypt(connection.ConnectionString);
        
        return await adapter.GetSchemaAsync(decryptedConnStr);
    }

    public async Task<List<ColumnInfo>> GetTableColumnsAsync(Guid connectionId, string tableName, string? schemaName = null)
    {
        var connection = await _db.Connections.FindAsync(connectionId);
        if (connection == null)
        {
            throw new InvalidOperationException("Connection not found");
        }

        var adapter = _adapterFactory.GetAdapter(connection.Type);
        var decryptedConnStr = Decrypt(connection.ConnectionString);
        
        return await adapter.GetTableColumnsAsync(decryptedConnStr, tableName, schemaName);
    }

    public async Task<int> GetConnectionCountAsync(Guid userId)
    {
        var userGroupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        return await _db.Connections
            .Where(c => c.IsActive)
            .Where(c =>
                (c.OwnerType == OwnerType.User && c.OwnerId == userId) ||
                (c.OwnerType == OwnerType.Group && userGroupIds.Contains(c.OwnerId)) ||
                c.Visibility == Visibility.Public)
            .CountAsync();
    }

    public string DecryptConnectionString(Connection connection)
    {
        return Decrypt(connection.ConnectionString);
    }

    private string EncryptConnectionString(string plainText)
    {
        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(_encryptionKey.PadRight(32).Substring(0, 32));
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var encryptedBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

        var result = new byte[aes.IV.Length + encryptedBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(encryptedBytes, 0, result, aes.IV.Length, encryptedBytes.Length);

        return Convert.ToBase64String(result);
    }

    private string Decrypt(string encrypted)
    {
        var fullBytes = Convert.FromBase64String(encrypted);
        
        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(_encryptionKey.PadRight(32).Substring(0, 32));

        var iv = new byte[16];
        var encryptedBytes = new byte[fullBytes.Length - 16];
        Buffer.BlockCopy(fullBytes, 0, iv, 0, 16);
        Buffer.BlockCopy(fullBytes, 16, encryptedBytes, 0, encryptedBytes.Length);

        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        var decryptedBytes = decryptor.TransformFinalBlock(encryptedBytes, 0, encryptedBytes.Length);

        return Encoding.UTF8.GetString(decryptedBytes);
    }
}

// DTOs
public record CreateConnectionRequest(
    string Name,
    string? Description,
    ConnectionType Type,
    string ConnectionString,
    Visibility Visibility = Visibility.Private);

public record UpdateConnectionRequest(
    string? Name = null,
    string? Description = null,
    string? ConnectionString = null,
    Visibility? Visibility = null);
