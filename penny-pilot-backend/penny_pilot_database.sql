CREATE DATABASE penny_pilot;

USE penny_pilot;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULLa
);

select * from users;  
truncate table users;

