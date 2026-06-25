// One-off demo data seeder for Penny Pilot.
//
// Seeds a realistic HR team (with salary structure) and an inventory catalogue
// for a single target user, then makes sure that user's wallet can cover one
// month of payroll so the automatic monthly payroll job can be observed.
//
// Idempotent: employees are keyed by employee_code, suppliers by name, products
// by sku — re-running will not create duplicates.
//
// Usage:  node seed_demo_data.js            (defaults to user id 1)
//         node seed_demo_data.js 2          (seed user id 2)

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { computePayslip } from './routes/hr.js';

dotenv.config();

const TARGET_USER_ID = Number(process.argv[2] || 1);

const conn = await mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});

const today = new Date();
const todaySql = today.toISOString().slice(0, 10);
const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const workingDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

function inr(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

async function ensureUser() {
  const [rows] = await conn.query('SELECT id, name, email FROM users WHERE id = ?', [TARGET_USER_ID]);
  if (!rows.length) throw new Error(`User #${TARGET_USER_ID} does not exist.`);
  return rows[0];
}

const EMPLOYEES = [
  {
    employee_code: 'EMP-101', name: 'Aarav Sharma', role: 'Senior Software Engineer', department: 'Engineering',
    email: 'aarav.sharma@pennypilot.io', phone: '+91 98200 11201', joining_date: '2023-04-10',
    bank_account: '50100123456701', ifsc: 'HDFC0000123', pan: 'ABCPS1201A', work_mode: 'hybrid',
    tax_regime: 'new', basic_salary: 60000, hra: 24000, allowances: 16000, pf_percent: 12,
  },
  {
    employee_code: 'EMP-102', name: 'Diya Patel', role: 'Product Designer', department: 'Design',
    email: 'diya.patel@pennypilot.io', phone: '+91 98200 11202', joining_date: '2023-08-01',
    bank_account: '50100123456702', ifsc: 'ICIC0000456', pan: 'ABCPP1202B', work_mode: 'remote',
    tax_regime: 'new', basic_salary: 42000, hra: 16800, allowances: 11200, pf_percent: 12,
  },
  {
    employee_code: 'EMP-103', name: 'Rohan Mehta', role: 'Sales Manager', department: 'Sales',
    email: 'rohan.mehta@pennypilot.io', phone: '+91 98200 11203', joining_date: '2022-11-15',
    bank_account: '50100123456703', ifsc: 'SBIN0000789', pan: 'ABCPM1203C', work_mode: 'onsite',
    tax_regime: 'old', basic_salary: 36000, hra: 14400, allowances: 9600, pf_percent: 12,
  },
  {
    employee_code: 'EMP-104', name: 'Ananya Iyer', role: 'HR Executive', department: 'Human Resources',
    email: 'ananya.iyer@pennypilot.io', phone: '+91 98200 11204', joining_date: '2024-01-20',
    bank_account: '50100123456704', ifsc: 'AXIS0000321', pan: 'ABCPI1204D', work_mode: 'onsite',
    tax_regime: 'new', basic_salary: 30000, hra: 12000, allowances: 8000, pf_percent: 12,
  },
];

async function seedEmployees(userId) {
  let added = 0;
  for (const e of EMPLOYEES) {
    const [exists] = await conn.query(
      'SELECT id FROM team_members WHERE user_id = ? AND employee_code = ?',
      [userId, e.employee_code]
    );
    if (exists.length) continue;
    const monthlyPayroll = e.basic_salary + e.hra + e.allowances;
    await conn.query(
      `INSERT INTO team_members
        (user_id, name, role, monthly_payroll, department, notes, status,
         employee_code, email, phone, joining_date, bank_account, ifsc, pan,
         tax_regime, basic_salary, hra, allowances, pf_percent, work_mode)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, e.name, e.role, monthlyPayroll, e.department, 'Seeded demo employee',
       e.employee_code, e.email, e.phone, e.joining_date, e.bank_account, e.ifsc, e.pan,
       e.tax_regime, e.basic_salary, e.hra, e.allowances, e.pf_percent, e.work_mode]
    );
    added++;
    console.log(`  + employee ${e.employee_code} ${e.name} (${e.role}) — payroll ${inr(monthlyPayroll)}`);
  }
  return added;
}

const SUPPLIERS = [
  {
    name: 'Globex Supplies Pvt Ltd', contact_person: 'Anil Kapoor', email: 'sales@globexsupplies.in',
    phone: '+91 22 4002 1100', address: 'Plot 14, MIDC Industrial Area, Pune 411019',
    gst_number: '27ABCDE1234F1Z5', payment_terms: 'Net 30',
  },
  {
    name: 'Acme Traders', contact_person: 'Meera Nair', email: 'orders@acmetraders.in',
    phone: '+91 80 2345 6789', address: '22 Brigade Road, Bengaluru 560001',
    gst_number: '29PQRSX6789K1Z2', payment_terms: 'Net 15',
  },
];

async function seedSuppliers(userId) {
  const map = {};
  for (const s of SUPPLIERS) {
    const [exists] = await conn.query('SELECT id FROM suppliers WHERE user_id = ? AND name = ?', [userId, s.name]);
    if (exists.length) { map[s.name] = exists[0].id; continue; }
    const [res] = await conn.query(
      `INSERT INTO suppliers (user_id, name, contact_person, email, phone, address, gst_number, payment_terms, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [userId, s.name, s.contact_person, s.email, s.phone, s.address, s.gst_number, s.payment_terms, 'Seeded demo supplier']
    );
    map[s.name] = res.insertId;
    console.log(`  + supplier ${s.name}`);
  }
  return map;
}

const PRODUCTS = [
  { sku: 'WL-001', name: 'Wireless Mouse', category: 'Electronics', unit: 'pcs', cost_price: 450, selling_price: 799, quantity_in_stock: 120, reorder_level: 20, supplier: 'Globex Supplies Pvt Ltd' },
  { sku: 'KB-002', name: 'Mechanical Keyboard', category: 'Electronics', unit: 'pcs', cost_price: 1800, selling_price: 2999, quantity_in_stock: 60, reorder_level: 15, supplier: 'Globex Supplies Pvt Ltd' },
  { sku: 'NB-003', name: 'A5 Notebook (Pack of 5)', category: 'Stationery', unit: 'pack', cost_price: 120, selling_price: 249, quantity_in_stock: 300, reorder_level: 50, supplier: 'Acme Traders' },
  { sku: 'CH-004', name: 'Ergonomic Office Chair', category: 'Furniture', unit: 'pcs', cost_price: 3200, selling_price: 5499, quantity_in_stock: 8, reorder_level: 10, supplier: 'Acme Traders' },
  { sku: 'BT-005', name: 'Bluetooth Speaker', category: 'Electronics', unit: 'pcs', cost_price: 1200, selling_price: 1999, quantity_in_stock: 45, reorder_level: 15, supplier: 'Globex Supplies Pvt Ltd' },
];

async function seedProducts(userId, supplierMap) {
  let added = 0;
  for (const p of PRODUCTS) {
    const [exists] = await conn.query('SELECT id FROM products WHERE user_id = ? AND sku = ?', [userId, p.sku]);
    if (exists.length) continue;
    const supplierId = supplierMap[p.supplier] || null;
    const [res] = await conn.query(
      `INSERT INTO products
         (user_id, sku, name, description, category, unit, cost_price, selling_price,
          quantity_in_stock, reorder_level, supplier_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, p.sku, p.name, 'Seeded demo product', p.category, p.unit,
       p.cost_price, p.selling_price, p.quantity_in_stock, p.reorder_level, supplierId]
    );
    if (p.quantity_in_stock > 0) {
      await conn.query(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_type, notes)
         VALUES (?, ?, 'in', ?, 'manual', 'Initial stock (seed)')`,
        [res.insertId, userId, p.quantity_in_stock]
      );
    }
    added++;
    const low = p.quantity_in_stock <= p.reorder_level ? '  [LOW STOCK]' : '';
    console.log(`  + product ${p.sku} ${p.name} — qty ${p.quantity_in_stock}${low}`);
  }
  return added;
}

async function ensureWalletForPayroll(userId) {
  // Sum net salary for active members that have no payslip yet for the current period.
  const [members] = await conn.query(
    `SELECT * FROM team_members WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  let needed = 0;
  for (const m of members) {
    const [ps] = await conn.query(
      'SELECT id FROM payslips WHERE team_member_id = ? AND pay_period = ?',
      [m.id, currentPeriod]
    );
    if (ps.length) continue;
    needed += computePayslip(m, workingDays, workingDays, 0, 0).net_salary;
  }

  const [[w]] = await conn.query('SELECT balance FROM wallet WHERE user_id = ?', [userId]);
  const balance = w ? Number(w.balance) : 0;
  const target = Math.ceil(needed * 1.1); // payroll + 10% buffer

  if (needed > 0 && balance < target) {
    const topUp = Math.ceil(target - balance);
    await conn.query(
      `INSERT INTO credit_entries (user_id, amount, category, entry_date, description)
       VALUES (?, ?, 'Other', ?, ?)`,
      [userId, topUp, todaySql, 'Demo seed top-up to enable payroll testing']
    );
    if (w) {
      await conn.query('UPDATE wallet SET balance = balance + ? WHERE user_id = ?', [topUp, userId]);
    } else {
      await conn.query('INSERT INTO wallet (user_id, balance) VALUES (?, ?)', [userId, topUp]);
    }
    console.log(`  + wallet topped up by ${inr(topUp)} (now ~${inr(balance + topUp)}) to cover monthly payroll of ${inr(needed)}`);
  } else {
    console.log(`  = wallet balance ${inr(balance)} already covers monthly payroll of ${inr(needed)}`);
  }
}

try {
  const user = await ensureUser();
  console.log(`\nSeeding demo data for user #${user.id} (${user.name} <${user.email}>)\n`);

  const emp = await seedEmployees(user.id);
  const supplierMap = await seedSuppliers(user.id);
  const prod = await seedProducts(user.id, supplierMap);
  await ensureWalletForPayroll(user.id);

  const [[tm]] = await conn.query("SELECT COUNT(*) c FROM team_members WHERE user_id = ? AND status = 'active'", [user.id]);
  const [[pc]] = await conn.query('SELECT COUNT(*) c FROM products WHERE user_id = ?', [user.id]);

  console.log(`\nDone. Added ${emp} employee(s) and ${prod} product(s).`);
  console.log(`Active team size: ${tm.c}. Total products: ${pc.c}.`);
  console.log(`Automatic payroll will process pay period ${currentPeriod} (${workingDays} working days) on the next scheduler tick.`);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
