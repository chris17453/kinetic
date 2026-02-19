-- Sample PostgreSQL data for testing adapters
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    order_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO customers (name, email) VALUES
    ('Acme Corp', 'contact@acme.com'),
    ('Globex Inc', 'info@globex.com'),
    ('Initech', 'sales@initech.com'),
    ('Umbrella Corp', 'hello@umbrella.com'),
    ('Stark Industries', 'tony@stark.com');

INSERT INTO orders (customer_id, amount, status, order_date) VALUES
    (1, 1500.00, 'completed', '2024-01-15'),
    (1, 2300.50, 'completed', '2024-02-01'),
    (2, 890.00, 'pending', '2024-02-10'),
    (3, 4500.00, 'completed', '2024-01-20'),
    (4, 750.25, 'cancelled', '2024-02-05'),
    (5, 12000.00, 'completed', '2024-02-12'),
    (2, 3200.00, 'pending', '2024-02-15'),
    (1, 550.00, 'completed', '2024-02-18');
