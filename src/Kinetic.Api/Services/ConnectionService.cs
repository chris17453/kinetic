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
        var plainBytes = Encoding.UTF8.GetBytes(plainText);

        // Random salt for key derivation
        var salt = new byte[16];
        RandomNumberGenerator.Fill(salt);

        // Derive 32-byte key via PBKDF2-SHA256
        using var kdf = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes(_encryptionKey), salt, 100_000, HashAlgorithmName.SHA256);
        var key = kdf.GetBytes(32);

        // AES-GCM encryption
        var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
        RandomNumberGenerator.Fill(nonce);
        var ciphertext = new byte[plainBytes.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes

        using var aesGcm = new AesGcm(key, AesGcm.TagByteSizes.MaxSize);
        aesGcm.Encrypt(nonce, plainBytes, ciphertext, tag);

        // Layout: salt[16] | nonce[12] | tag[16] | ciphertext
        var result = new byte[salt.Length + nonce.Length + tag.Length + ciphertext.Length];
        Buffer.BlockCopy(salt, 0, result, 0, salt.Length);
        Buffer.BlockCopy(nonce, 0, result, salt.Length, nonce.Length);
        Buffer.BlockCopy(tag, 0, result, salt.Length + nonce.Length, tag.Length);
        Buffer.BlockCopy(ciphertext, 0, result, salt.Length + nonce.Length + tag.Length, ciphertext.Length);

        return Convert.ToBase64String(result);
    }

    private string Decrypt(string encrypted)
    {
        var fullBytes = Convert.FromBase64String(encrypted);

        // Layout: salt[16] | nonce[12] | tag[16] | ciphertext
        const int saltLen = 16;
        const int nonceLen = 12;
        const int tagLen = 16;
        var ciphertextLen = fullBytes.Length - saltLen - nonceLen - tagLen;

        if (ciphertextLen < 0)
            throw new CryptographicException("Invalid encrypted data format.");

        var salt = fullBytes[..saltLen];
        var nonce = fullBytes[saltLen..(saltLen + nonceLen)];
        var tag = fullBytes[(saltLen + nonceLen)..(saltLen + nonceLen + tagLen)];
        var ciphertext = fullBytes[(saltLen + nonceLen + tagLen)..];

        // Re-derive key
        using var kdf = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes(_encryptionKey), salt, 100_000, HashAlgorithmName.SHA256);
        var key = kdf.GetBytes(32);

        // AES-GCM decryption (authenticates tag automatically)
        var plaintext = new byte[ciphertextLen];
        using var aesGcm = new AesGcm(key, tagLen);
        aesGcm.Decrypt(nonce, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
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
