-- Create sample database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SampleDB')
BEGIN
    CREATE DATABASE SampleDB;
END
GO

USE SampleDB;
GO

-- Departments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Departments')
BEGIN
    CREATE TABLE Departments (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Code NVARCHAR(10) NOT NULL,
        Budget DECIMAL(18,2),
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );

    INSERT INTO Departments (Name, Code, Budget) VALUES
        ('Engineering', 'ENG', 2500000.00),
        ('Marketing', 'MKT', 1200000.00),
        ('Sales', 'SLS', 1800000.00),
        ('Human Resources', 'HR', 800000.00),
        ('Finance', 'FIN', 950000.00);
END
GO

-- Employees
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employees')
BEGIN
    CREATE TABLE Employees (
        Id INT PRIMARY KEY IDENTITY(1,1),
        FirstName NVARCHAR(50) NOT NULL,
        LastName NVARCHAR(50) NOT NULL,
        Email NVARCHAR(150) NOT NULL,
        DepartmentId INT REFERENCES Departments(Id),
        Title NVARCHAR(100),
        Salary DECIMAL(18,2),
        HireDate DATE,
        IsActive BIT DEFAULT 1
    );

    INSERT INTO Employees (FirstName, LastName, Email, DepartmentId, Title, Salary, HireDate) VALUES
        ('Alice', 'Johnson', 'alice.johnson@example.com', 1, 'Senior Engineer', 145000.00, '2020-03-15'),
        ('Bob', 'Smith', 'bob.smith@example.com', 1, 'Staff Engineer', 175000.00, '2018-07-01'),
        ('Carol', 'Williams', 'carol.williams@example.com', 2, 'Marketing Manager', 120000.00, '2021-01-10'),
        ('David', 'Brown', 'david.brown@example.com', 3, 'Sales Lead', 130000.00, '2019-11-20'),
        ('Eve', 'Davis', 'eve.davis@example.com', 1, 'Junior Engineer', 95000.00, '2023-06-01'),
        ('Frank', 'Miller', 'frank.miller@example.com', 4, 'HR Director', 140000.00, '2017-02-14'),
        ('Grace', 'Wilson', 'grace.wilson@example.com', 5, 'Financial Analyst', 105000.00, '2022-09-05'),
        ('Hank', 'Moore', 'hank.moore@example.com', 3, 'Account Executive', 110000.00, '2021-04-18'),
        ('Iris', 'Taylor', 'iris.taylor@example.com', 2, 'Content Strategist', 98000.00, '2023-01-30'),
        ('Jack', 'Anderson', 'jack.anderson@example.com', 1, 'Engineering Manager', 165000.00, '2019-08-12');
END
GO

-- Products
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(150) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Price DECIMAL(10,2) NOT NULL,
        StockQuantity INT DEFAULT 0,
        IsDiscontinued BIT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );

    INSERT INTO Products (Name, Category, Price, StockQuantity) VALUES
        ('Widget Pro', 'Hardware', 29.99, 500),
        ('Widget Lite', 'Hardware', 14.99, 1200),
        ('DataSync Standard', 'Software', 199.00, NULL),
        ('DataSync Enterprise', 'Software', 499.00, NULL),
        ('CloudBridge Connector', 'Integration', 89.00, NULL),
        ('ReportGen Basic', 'Software', 49.00, NULL),
        ('SecureVault', 'Security', 299.00, NULL),
        ('NetMonitor', 'Monitoring', 149.00, NULL);
END
GO

-- Orders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Orders')
BEGIN
    CREATE TABLE Orders (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CustomerName NVARCHAR(100) NOT NULL,
        ProductId INT REFERENCES Products(Id),
        Quantity INT NOT NULL,
        TotalAmount DECIMAL(10,2) NOT NULL,
        Status NVARCHAR(20) DEFAULT 'Pending',
        OrderDate DATETIME2 DEFAULT GETUTCDATE()
    );

    INSERT INTO Orders (CustomerName, ProductId, Quantity, TotalAmount, Status, OrderDate) VALUES
        ('Acme Corp', 1, 50, 1499.50, 'Shipped', '2025-12-01'),
        ('Globex Inc', 3, 10, 1990.00, 'Completed', '2025-11-15'),
        ('Initech', 4, 5, 2495.00, 'Completed', '2025-10-20'),
        ('Umbrella LLC', 2, 200, 2998.00, 'Shipped', '2026-01-05'),
        ('Stark Industries', 7, 3, 897.00, 'Pending', '2026-02-10'),
        ('Wayne Enterprises', 5, 20, 1780.00, 'Shipped', '2026-01-22'),
        ('Acme Corp', 6, 15, 735.00, 'Completed', '2025-12-18'),
        ('Globex Inc', 8, 8, 1192.00, 'Pending', '2026-02-20');
END
GO

PRINT 'Sample database seeded successfully.';
GO
