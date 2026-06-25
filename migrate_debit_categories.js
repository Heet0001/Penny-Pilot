// Migration: extend debit_entries.category ENUM so payroll and inventory expenses
// can be recorded. The original enum only allowed personal-spend categories, which
// silently broke HR payroll (`Payroll`) and inventory receiving (`Inventory Purchase`).
//
// Safe to run multiple times — it only widens the enum; all existing values remain valid.

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});

try {
  const [[before]] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'debit_entries' AND column_name = 'category'`,
    [process.env.MYSQLDATABASE]
  );
  console.log('Before:', before ? before.COLUMN_TYPE : '(column not found)');

  await conn.query(
    `ALTER TABLE debit_entries
     MODIFY COLUMN category
     ENUM('Food','Transport','Entertainment','Bills','Emergency','Other',
          'Debt Given','Debt Taken','Payroll','Inventory Purchase')
     NOT NULL`
  );

  const [[after]] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'debit_entries' AND column_name = 'category'`,
    [process.env.MYSQLDATABASE]
  );
  console.log('After: ', after.COLUMN_TYPE);
  console.log('Migration complete.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
