-- Sample MySQL data for testing adapters
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10,2),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    quantity INT,
    sale_date DATE,
    region VARCHAR(50),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Sample data
INSERT INTO products (name, category, price, stock) VALUES
    ('Widget A', 'Electronics', 29.99, 150),
    ('Widget B', 'Electronics', 49.99, 75),
    ('Gadget X', 'Accessories', 15.00, 300),
    ('Gadget Y', 'Accessories', 22.50, 200),
    ('Device Z', 'Hardware', 199.99, 50);

INSERT INTO sales (product_id, quantity, sale_date, region) VALUES
    (1, 10, '2024-01-10', 'North'),
    (1, 25, '2024-01-15', 'South'),
    (2, 5, '2024-01-20', 'East'),
    (3, 100, '2024-02-01', 'West'),
    (4, 45, '2024-02-05', 'North'),
    (5, 3, '2024-02-10', 'South'),
    (1, 30, '2024-02-12', 'East'),
    (2, 15, '2024-02-15', 'West');
