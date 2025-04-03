CREATE DATABASE penny_pilot;

USE penny_pilot;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL
);

select * from users;  
truncate table users;

CREATE TABLE credit_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(1
    0, 2) NOT NULL,
    category ENUM('Salary', 'Debt Taken', 'Investments Relieved', 'From Emergency', 'Other') NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

select * from credit_entries;



CREATE TABLE wallet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

select * from wallet;
CREATE TABLE emergency_fund (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
select * from emergency_fund;
CREATE TABLE debit_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category ENUM('Food', 'Transport', 'Entertainment', 'Bills', 'Emergency', 'Other') NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

select * from debit_entries;


-- New table for stock investments
CREATE TABLE stock_investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    buy_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    sell_price DECIMAL(10, 2) NULL,
	quantity DECIMAL(15, 8) NOT NULL,
    buy_date DATE NOT NULL,
    sell_date DATE NULL,
    description TEXT,
    status ENUM('active', 'sold') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE stock_investments MODIFY COLUMN quantity INT NOT NULL;
select * from stock_investments;

ALTER TABLE stock_investments 
MODIFY COLUMN current_price DECIMAL(10,2) DEFAULT 0.00;
INSERT INTO stock_investments 
(user_id, stock_name, buy_price, sell_price, current_price, quantity, buy_date, sell_date, description, status) 
VALUES (1, 'ADANIENT', '250.00', 2354, 2354, 800, '2025-03-27 00:00:00.000', '2025-03-26', 'hi', 'sold');



drop table stock_investments;
TRUNCATE TABLE stock_investments;








ALTER TABLE debit_entries 
ADD COLUMN recipient_id INT NULL AFTER user_id,
ADD FOREIGN KEY (recipient_id) REFERENCES users(id);







