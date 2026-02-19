using Kinetic.Core.Domain.Identity;

namespace Kinetic.Core.Tests.Domain.Identity;

public class UserTests
{
    [Fact]
    public void User_DefaultValues_AreCorrect()
    {
        var user = new User();
        
        Assert.Equal(string.Empty, user.Email);
        Assert.Equal(string.Empty, user.DisplayName);
        Assert.Null(user.AvatarUrl);
        Assert.Null(user.ExternalId);
        Assert.Null(user.PasswordHash);
        Assert.Null(user.DepartmentId);
        Assert.Empty(user.UserGroups);
        Assert.True(user.IsActive);
    }

    [Fact]
    public void User_CanSetLocalAuth()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "user@example.com",
            DisplayName = "John Doe",
            Provider = AuthProvider.Local,
            PasswordHash = "hashed_password"
        };
        
        Assert.Equal(AuthProvider.Local, user.Provider);
        Assert.NotNull(user.PasswordHash);
        Assert.Null(user.ExternalId);
    }

    [Fact]
    public void User_CanSetEntraAuth()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "user@company.com",
            DisplayName = "Jane Smith",
            Provider = AuthProvider.Entra,
            ExternalId = "azure-ad-object-id"
        };
        
        Assert.Equal(AuthProvider.Entra, user.Provider);
        Assert.NotNull(user.ExternalId);
        Assert.Null(user.PasswordHash);
    }

    [Fact]
    public void User_CanHaveDepartment()
    {
        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = "Engineering"
        };
        
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "dev@company.com",
            DepartmentId = department.Id,
            Department = department
        };
        
        Assert.Equal(department.Id, user.DepartmentId);
        Assert.Equal("Engineering", user.Department?.Name);
    }
}

public class GroupTests
{
    [Fact]
    public void Group_DefaultValues_AreCorrect()
    {
        var group = new Group();
        
        Assert.Equal(string.Empty, group.Name);
        Assert.Null(group.Description);
        Assert.Null(group.ExternalId);
        Assert.Empty(group.UserGroups);
        Assert.Empty(group.Permissions);
        Assert.False(group.IsSystem);
    }

    [Fact]
    public void Group_CanHaveMembers()
    {
        var group = new Group
        {
            Id = Guid.NewGuid(),
            Name = "Admins",
            Description = "System administrators"
        };
        
        var userGroup = new UserGroup
        {
            GroupId = group.Id,
            Group = group,
            UserId = Guid.NewGuid()
        };
        
        group.UserGroups.Add(userGroup);
        
        Assert.Single(group.UserGroups);
    }

    [Fact]
    public void Group_SystemGroup_IsMarked()
    {
        var group = new Group
        {
            Name = "System Administrators",
            IsSystem = true
        };
        
        Assert.True(group.IsSystem);
    }
}

public class DepartmentTests
{
    [Fact]
    public void Department_CanHaveHierarchy()
    {
        var parent = new Department
        {
            Id = Guid.NewGuid(),
            Name = "Technology",
            Code = "TECH"
        };
        
        var child = new Department
        {
            Id = Guid.NewGuid(),
            Name = "Software Development",
            Code = "DEV",
            ParentId = parent.Id,
            Parent = parent
        };
        
        parent.Children.Add(child);
        
        Assert.Equal(parent.Id, child.ParentId);
        Assert.Single(parent.Children);
    }
}

public class AuthProviderTests
{
    [Theory]
    [InlineData(AuthProvider.Local)]
    [InlineData(AuthProvider.Entra)]
    public void AuthProvider_AllValuesAreDefined(AuthProvider provider)
    {
        Assert.True(Enum.IsDefined(typeof(AuthProvider), provider));
    }
}
