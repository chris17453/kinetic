using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Identity.Services;

public interface IUserService
{
    Task<IEnumerable<User>> GetUsersAsync(int page = 1, int pageSize = 25);
    Task<User?> GetUserByIdAsync(Guid id);
    Task<User> CreateUserAsync(CreateUserRequest request);
    Task<User?> UpdateUserAsync(Guid id, UpdateUserRequest request);
    Task<bool> DeleteUserAsync(Guid id);
    Task<bool> SetUserActiveAsync(Guid id, bool isActive);
    Task<IEnumerable<Group>> GetUserGroupsAsync(Guid userId);
    Task<bool> AddUserToGroupAsync(Guid userId, Guid groupId, GroupRole role = GroupRole.Member);
    Task<bool> RemoveUserFromGroupAsync(Guid userId, Guid groupId);
    Task<int> GetUserCountAsync();
}

public class UserService : IUserService
{
    private readonly KineticDbContext _db;
    private readonly IPasswordService _passwordService;

    public UserService(KineticDbContext db, IPasswordService passwordService)
    {
        _db = db;
        _passwordService = passwordService;
    }

    public async Task<IEnumerable<User>> GetUsersAsync(int page = 1, int pageSize = 25)
    {
        return await _db.Users
            .Include(u => u.Department)
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .OrderBy(u => u.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<User?> GetUserByIdAsync(Guid id)
    {
        return await _db.Users
            .Include(u => u.Department)
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<User> CreateUserAsync(CreateUserRequest request)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.ToLowerInvariant(),
            DisplayName = request.DisplayName,
            DepartmentId = request.DepartmentId,
            Provider = AuthProvider.Local,
            PasswordHash = request.Password != null 
                ? _passwordService.HashPassword(request.Password) 
                : null,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user;
    }

    public async Task<User?> UpdateUserAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return null;

        if (request.DisplayName != null)
            user.DisplayName = request.DisplayName;

        if (request.Email != null)
            user.Email = request.Email.ToLowerInvariant();

        if (request.DepartmentId.HasValue)
            user.DepartmentId = request.DepartmentId.Value == Guid.Empty ? null : request.DepartmentId;

        if (request.AvatarUrl != null)
            user.AvatarUrl = request.AvatarUrl;

        await _db.SaveChangesAsync();
        return user;
    }

    public async Task<bool> DeleteUserAsync(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetUserActiveAsync(Guid id, bool isActive)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;

        user.IsActive = isActive;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<Group>> GetUserGroupsAsync(Guid userId)
    {
        return await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Include(ug => ug.Group)
            .Select(ug => ug.Group!)
            .ToListAsync();
    }

    public async Task<bool> AddUserToGroupAsync(Guid userId, Guid groupId, GroupRole role = GroupRole.Member)
    {
        var exists = await _db.UserGroups
            .AnyAsync(ug => ug.UserId == userId && ug.GroupId == groupId);

        if (exists) return true;

        _db.UserGroups.Add(new UserGroup
        {
            UserId = userId,
            GroupId = groupId,
            Role = role,
            JoinedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveUserFromGroupAsync(Guid userId, Guid groupId)
    {
        var userGroup = await _db.UserGroups
            .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GroupId == groupId);

        if (userGroup == null) return false;

        _db.UserGroups.Remove(userGroup);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> GetUserCountAsync()
    {
        return await _db.Users.CountAsync();
    }
}

// DTOs
public record CreateUserRequest(
    string Email, 
    string DisplayName, 
    string? Password = null, 
    Guid? DepartmentId = null);

public record UpdateUserRequest(
    string? Email = null, 
    string? DisplayName = null, 
    Guid? DepartmentId = null,
    string? AvatarUrl = null);
