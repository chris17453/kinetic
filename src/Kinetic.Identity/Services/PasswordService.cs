using BCrypt.Net;

namespace Kinetic.Identity.Services;

public interface IPasswordService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    bool IsPasswordStrong(string password, out string? error);
}

public class PasswordService : IPasswordService
{
    private const int MinLength = 8;
    private const int WorkFactor = 12;

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }

    public bool VerifyPassword(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }

    public bool IsPasswordStrong(string password, out string? error)
    {
        error = null;

        if (string.IsNullOrWhiteSpace(password))
        {
            error = "Password is required";
            return false;
        }

        if (password.Length < MinLength)
        {
            error = $"Password must be at least {MinLength} characters";
            return false;
        }

        if (!password.Any(char.IsUpper))
        {
            error = "Password must contain at least one uppercase letter";
            return false;
        }

        if (!password.Any(char.IsLower))
        {
            error = "Password must contain at least one lowercase letter";
            return false;
        }

        if (!password.Any(char.IsDigit))
        {
            error = "Password must contain at least one digit";
            return false;
        }

        if (!password.Any(c => !char.IsLetterOrDigit(c)))
        {
            error = "Password must contain at least one special character";
            return false;
        }

        return true;
    }
}
