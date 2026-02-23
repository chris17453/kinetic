using Kinetic.Api.Services;
using FluentAssertions;
using Xunit;
using Moq;
using Kinetic.Data;
using Kinetic.Adapters.Core;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Core.Tests.Services;

public class ConnectionServiceEncryptionTests
{
    private static ConnectionService CreateService(string key = "test-encryption-key-32-chars-ok!")
    {
        var options = new DbContextOptionsBuilder<KineticDbContext>()
            .UseInMemoryDatabase($"EncryptionTests_{Guid.NewGuid()}")
            .Options;
        var db = new KineticDbContext(options);
        var factory = Mock.Of<IAdapterFactory>();
        return new ConnectionService(db, factory, key);
    }

    [Fact]
    public void EncryptDecrypt_RoundTrip_ReturnsOriginal()
    {
        var svc = CreateService();
        var original = "Server=myserver;Database=mydb;User Id=sa;Password=secret;";
        
        // Use reflection to call private methods for testing
        var encrypt = typeof(ConnectionService).GetMethod("EncryptConnectionString", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var decrypt = typeof(ConnectionService).GetMethod("Decrypt", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;

        var encrypted = (string)encrypt.Invoke(svc, new object[] { original })!;
        var decrypted = (string)decrypt.Invoke(svc, new object[] { encrypted })!;

        decrypted.Should().Be(original);
    }

    [Fact]
    public void Encrypt_ProducesDifferentCiphertextEachTime()
    {
        var svc = CreateService();
        var encrypt = typeof(ConnectionService).GetMethod("EncryptConnectionString",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        
        var c1 = (string)encrypt.Invoke(svc, new object[] { "same input" })!;
        var c2 = (string)encrypt.Invoke(svc, new object[] { "same input" })!;

        // AES-GCM with random nonce/salt must produce different ciphertext each time
        c1.Should().NotBe(c2);
    }

    [Fact]
    public void Decrypt_ThrowsOnTamperedCiphertext()
    {
        var svc = CreateService();
        var encrypt = typeof(ConnectionService).GetMethod("EncryptConnectionString",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var decrypt = typeof(ConnectionService).GetMethod("Decrypt",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        
        var encrypted = (string)encrypt.Invoke(svc, new object[] { "test" })!;
        var bytes = Convert.FromBase64String(encrypted);
        // Tamper with the ciphertext bytes
        bytes[^1] ^= 0xFF;
        var tampered = Convert.ToBase64String(bytes);
        
        // AES-GCM should throw on authentication failure
        var act = () => decrypt.Invoke(svc, new object[] { tampered });
        act.Should().Throw<System.Reflection.TargetInvocationException>()
           .WithInnerException<System.Security.Cryptography.CryptographicException>();
    }
}
