using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Identity.Services;

public interface IDepartmentService
{
    Task<IEnumerable<Department>> GetDepartmentsAsync();
    Task<IEnumerable<Department>> GetDepartmentTreeAsync();
    Task<Department?> GetDepartmentByIdAsync(Guid id);
    Task<Department> CreateDepartmentAsync(CreateDepartmentRequest request);
    Task<Department?> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request);
    Task<bool> DeleteDepartmentAsync(Guid id);
    Task<IEnumerable<User>> GetDepartmentUsersAsync(Guid departmentId);
    Task<IEnumerable<Group>> GetDepartmentGroupsAsync(Guid departmentId);
}

public class DepartmentService : IDepartmentService
{
    private readonly KineticDbContext _db;

    public DepartmentService(KineticDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<Department>> GetDepartmentsAsync()
    {
        return await _db.Departments
            .OrderBy(d => d.Name)
            .ToListAsync();
    }

    public async Task<IEnumerable<Department>> GetDepartmentTreeAsync()
    {
        var allDepartments = await _db.Departments.ToListAsync();
        
        // Build tree structure
        var lookup = allDepartments.ToLookup(d => d.ParentId);
        
        foreach (var dept in allDepartments)
        {
            dept.Children = lookup[dept.Id].ToList();
        }

        // Return root departments (no parent)
        return allDepartments.Where(d => d.ParentId == null).ToList();
    }

    public async Task<Department?> GetDepartmentByIdAsync(Guid id)
    {
        return await _db.Departments
            .Include(d => d.Parent)
            .Include(d => d.Children)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    public async Task<Department> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Code = request.Code.ToUpperInvariant(),
            ParentId = request.ParentId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        return department;
    }

    public async Task<Department?> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request)
    {
        var department = await _db.Departments.FindAsync(id);
        if (department == null) return null;

        if (request.Name != null)
            department.Name = request.Name;

        if (request.Code != null)
            department.Code = request.Code.ToUpperInvariant();

        if (request.ParentId.HasValue)
        {
            // Prevent circular reference
            if (request.ParentId.Value != id)
            {
                department.ParentId = request.ParentId.Value == Guid.Empty ? null : request.ParentId;
            }
        }

        await _db.SaveChangesAsync();
        return department;
    }

    public async Task<bool> DeleteDepartmentAsync(Guid id)
    {
        var department = await _db.Departments
            .Include(d => d.Children)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null) return false;

        // Don't delete if has children
        if (department.Children.Any()) return false;

        // Update users and groups to remove department reference
        var users = await _db.Users.Where(u => u.DepartmentId == id).ToListAsync();
        foreach (var user in users)
        {
            user.DepartmentId = null;
        }

        var groups = await _db.Groups.Where(g => g.DepartmentId == id).ToListAsync();
        foreach (var group in groups)
        {
            group.DepartmentId = null;
        }

        _db.Departments.Remove(department);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<User>> GetDepartmentUsersAsync(Guid departmentId)
    {
        return await _db.Users
            .Where(u => u.DepartmentId == departmentId)
            .OrderBy(u => u.DisplayName)
            .ToListAsync();
    }

    public async Task<IEnumerable<Group>> GetDepartmentGroupsAsync(Guid departmentId)
    {
        return await _db.Groups
            .Where(g => g.DepartmentId == departmentId)
            .OrderBy(g => g.Name)
            .ToListAsync();
    }
}

// DTOs
public record CreateDepartmentRequest(
    string Name,
    string Code,
    Guid? ParentId = null);

public record UpdateDepartmentRequest(
    string? Name = null,
    string? Code = null,
    Guid? ParentId = null);
