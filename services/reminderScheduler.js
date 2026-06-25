// Scheduled reminder job
// Runs hourly. Two responsibilities:
//   1. Seed the `reminders` table with rows for any payable item (debt, invoice, payslip, PO)
//      that has a due_date in the next 7 days but no reminder yet.
//   2. Convert any `pending` reminder whose remind_at <= NOW() into a `notification`
//      row for the corresponding user, then mark it `sent`.
//
// We deliberately avoid emails to keep the project self-contained; in-app notifications
// are surfaced via /api/notifications and the bell icon in the navbar.

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

const REMINDER_OFFSETS_DAYS = [7, 3, 1, 0]; // before due date

async function seedDebtReminders(db) {
  const debts = await runQuery(db, `
    SELECT id, user_id, due_date, counterparty, debt_type, remaining_amount, status
    FROM debts
    WHERE status IN ('active','partially_paid')
      AND due_date IS NOT NULL
      AND due_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      AND due_date <= DATE_ADD(CURDATE(), INTERVAL 8 DAY)
  `);

  for (const d of debts) {
    const dueDate = new Date(d.due_date);
    if (isNaN(dueDate.getTime())) continue;
    for (const offset of REMINDER_OFFSETS_DAYS) {
      const remindAt = new Date(dueDate.getTime() - offset * 24 * 60 * 60 * 1000);
      remindAt.setHours(9, 0, 0, 0);
      const remindAtSql = remindAt.toISOString().slice(0, 19).replace('T', ' ');
      const dir = d.debt_type === 'given' ? 'collect from' : 'pay to';
      const title = offset === 0
        ? `Debt due today: ${dir} ${d.counterparty || 'counterparty'}`
        : `Debt due in ${offset} day${offset === 1 ? '' : 's'}: ${dir} ${d.counterparty || 'counterparty'}`;
      const body = `Remaining amount: ₹${Number(d.remaining_amount).toFixed(2)}. Due ${d.due_date.toISOString().slice(0, 10)}.`;
      try {
        await runQuery(db, `
          INSERT IGNORE INTO reminders (user_id, ref_type, ref_id, remind_at, title, body)
          VALUES (?, 'debt', ?, ?, ?, ?)
        `, [d.user_id, d.id, remindAtSql, title, body]);
      } catch (e) {
        // ignore duplicate / fk errors silently
      }
    }
  }
}

async function seedInvoiceReminders(db) {
  // Only schema field we have is invoices.due_date and status
  let invoices = [];
  try {
    invoices = await runQuery(db, `
      SELECT i.id, i.due_date, i.amount, i.created_by AS user_id, c.first_name, c.last_name, c.company_name
      FROM invoices i
      JOIN customers c ON i.client_id = c.id
      WHERE i.status IN ('draft','sent','overdue')
        AND i.due_date IS NOT NULL
        AND i.due_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND i.due_date <= DATE_ADD(CURDATE(), INTERVAL 8 DAY)
    `);
  } catch (e) {
    // invoices table may not exist if user hasn't created clients
    return;
  }

  for (const inv of invoices) {
    const dueDate = new Date(inv.due_date);
    if (isNaN(dueDate.getTime())) continue;
    const clientName = inv.company_name || `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Client';
    for (const offset of REMINDER_OFFSETS_DAYS) {
      const remindAt = new Date(dueDate.getTime() - offset * 24 * 60 * 60 * 1000);
      remindAt.setHours(9, 0, 0, 0);
      const remindAtSql = remindAt.toISOString().slice(0, 19).replace('T', ' ');
      const title = offset === 0
        ? `Invoice due today from ${clientName}`
        : `Invoice due in ${offset} day${offset === 1 ? '' : 's'} from ${clientName}`;
      const body = `Amount: ₹${Number(inv.amount).toFixed(2)}.`;
      try {
        await runQuery(db, `
          INSERT IGNORE INTO reminders (user_id, ref_type, ref_id, remind_at, title, body)
          VALUES (?, 'invoice', ?, ?, ?, ?)
        `, [inv.user_id, inv.id, remindAtSql, title, body]);
      } catch (e) { /* ignore */ }
    }
  }
}

async function seedPurchaseOrderReminders(db) {
  let pos = [];
  try {
    pos = await runQuery(db, `
      SELECT po.id, po.user_id, po.expected_date, po.po_number, po.total_amount
      FROM purchase_orders po
      WHERE po.status IN ('approved','pending_approval')
        AND po.expected_date IS NOT NULL
        AND po.expected_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND po.expected_date <= DATE_ADD(CURDATE(), INTERVAL 8 DAY)
    `);
  } catch (e) {
    return;
  }

  for (const po of pos) {
    const dueDate = new Date(po.expected_date);
    if (isNaN(dueDate.getTime())) continue;
    for (const offset of REMINDER_OFFSETS_DAYS) {
      const remindAt = new Date(dueDate.getTime() - offset * 24 * 60 * 60 * 1000);
      remindAt.setHours(9, 0, 0, 0);
      const remindAtSql = remindAt.toISOString().slice(0, 19).replace('T', ' ');
      const title = offset === 0
        ? `PO ${po.po_number} delivery expected today`
        : `PO ${po.po_number} expected in ${offset} day${offset === 1 ? '' : 's'}`;
      const body = `Total: ₹${Number(po.total_amount).toFixed(2)}.`;
      try {
        await runQuery(db, `
          INSERT IGNORE INTO reminders (user_id, ref_type, ref_id, remind_at, title, body)
          VALUES (?, 'purchase_order', ?, ?, ?, ?)
        `, [po.user_id, po.id, remindAtSql, title, body]);
      } catch (e) { /* ignore */ }
    }
  }
}

async function dispatchDueReminders(db) {
  const due = await runQuery(db, `
    SELECT * FROM reminders
    WHERE status = 'pending' AND remind_at <= NOW()
    LIMIT 200
  `);
  if (!due.length) return;

  for (const r of due) {
    try {
      await runQuery(db, `
        INSERT INTO notifications (user_id, ref_type, ref_id, title, body, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [r.user_id, r.ref_type, r.ref_id, r.title, r.body, 'warning']);
      await runQuery(db, `UPDATE reminders SET status = 'sent', sent_at = NOW() WHERE id = ?`, [r.id]);
    } catch (e) {
      console.warn('[REMINDER] dispatch failed for id', r.id, e.message);
    }
  }
  console.log(`[REMINDER] Dispatched ${due.length} reminder${due.length === 1 ? '' : 's'}.`);
}

async function tick(db) {
  try {
    await seedDebtReminders(db);
    await seedInvoiceReminders(db);
    await seedPurchaseOrderReminders(db);
    await dispatchDueReminders(db);
  } catch (err) {
    console.error('[REMINDER] tick failed:', err.message);
  }
}

export function startReminderScheduler(db) {
  // Run shortly after startup, then every hour.
  setTimeout(() => tick(db), 30 * 1000);
  setInterval(() => tick(db), 60 * 60 * 1000);
  console.log('[REMINDER] Scheduler started (runs every 60 minutes).');
}
