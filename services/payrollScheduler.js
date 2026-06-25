// Automatic monthly payroll job.
//
// Responsibility: once per calendar month, for every ACTIVE team member, generate
// a payslip for the current pay period, deduct the net salary from the owner's
// main wallet balance, and record the matching expense + an in-app notification.
//
// It is fully idempotent: a UNIQUE (team_member_id, pay_period) key on `payslips`
// plus an explicit existence check guarantee that re-running the tick (on restart,
// or on the periodic interval) never double-pays anyone for the same month.
//
// If the wallet cannot cover a salary, that member is skipped and a single
// "Salary pending" notification is raised for the month so the owner can top up.

import { computePayslip } from '../routes/hr.js';

function q(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// Pays a single member inside one DB transaction. Resolves with a status object;
// never rejects, so one bad row can't abort the whole run.
function payMember(db, member, period, payDate, workingDays) {
  return new Promise((resolve) => {
    db.getConnection((err, conn) => {
      if (err) return resolve({ status: 'error', error: err.message });

      const finish = (result) => { conn.release(); resolve(result); };
      const rollback = (result) => conn.rollback(() => finish(result));

      conn.beginTransaction((txErr) => {
        if (txErr) return finish({ status: 'error', error: txErr.message });

        conn.query(
          `SELECT * FROM team_members WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE`,
          [member.id, member.user_id],
          (mErr, mRows) => {
            if (mErr) return rollback({ status: 'error', error: mErr.message });
            if (!mRows.length) return rollback({ status: 'skipped' });
            const m = mRows[0];

            conn.query(
              'SELECT id FROM payslips WHERE team_member_id = ? AND pay_period = ?',
              [m.id, period],
              (dupErr, dupRows) => {
                if (dupErr) return rollback({ status: 'error', error: dupErr.message });
                if (dupRows.length) return rollback({ status: 'exists' });

                // Full-month run: present for every working day, no overtime/bonus.
                const slip = computePayslip(m, workingDays, workingDays, 0, 0);
                if (slip.net_salary <= 0) return rollback({ status: 'skipped' });

                conn.query('SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE', [m.user_id], (wErr, wRows) => {
                  if (wErr) return rollback({ status: 'error', error: wErr.message });
                  const balance = wRows.length ? Number(wRows[0].balance) : 0;
                  if (balance < slip.net_salary) {
                    return rollback({ status: 'insufficient', required: slip.net_salary, available: balance, member: m });
                  }

                  const desc = `Auto Payroll · ${m.name} (${m.role}) · ${period}`;
                  conn.query(
                    `INSERT INTO debit_entries (user_id, amount, category, entry_date, description)
                     VALUES (?, ?, 'Payroll', ?, ?)`,
                    [m.user_id, slip.net_salary, payDate, desc],
                    (deErr, deRes) => {
                      if (deErr) return rollback({ status: 'error', error: deErr.message });
                      const debitId = deRes.insertId;

                      conn.query(
                        'UPDATE wallet SET balance = balance - ? WHERE user_id = ?',
                        [slip.net_salary, m.user_id],
                        (uwErr) => {
                          if (uwErr) return rollback({ status: 'error', error: uwErr.message });

                          conn.query(
                            `INSERT INTO payslips
                               (team_member_id, user_id, pay_period, working_days, days_present,
                                basic, hra, allowances, overtime, bonus, gross_salary,
                                pf_deduction, tax_deduction, other_deductions, net_salary,
                                payment_status, payment_date, debit_entry_id, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
                            [m.id, m.user_id, period, workingDays, workingDays,
                             slip.basic, slip.hra, slip.allowances, slip.overtime, slip.bonus, slip.gross_salary,
                             slip.pf_deduction, slip.tax_deduction, slip.other_deductions, slip.net_salary,
                             payDate, debitId, 'Auto-generated monthly payroll'],
                            (psErr) => {
                              if (psErr) return rollback({ status: 'error', error: psErr.message });

                              conn.query(
                                `INSERT INTO payroll_history (team_member_id, user_id, amount, payment_date, description, debit_entry_id)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [m.id, m.user_id, slip.net_salary, payDate, desc, debitId],
                                (phErr) => {
                                  if (phErr) return rollback({ status: 'error', error: phErr.message });
                                  conn.commit((cErr) => {
                                    if (cErr) return rollback({ status: 'error', error: cErr.message });
                                    finish({ status: 'paid', net: slip.net_salary, member: m });
                                  });
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                });
              }
            );
          }
        );
      });
    });
  });
}

// In-app "salary paid" notification (raised after the money transaction commits).
async function notifyPaid(db, member, net, period) {
  try {
    await q(
      db,
      `INSERT INTO notifications (user_id, ref_type, ref_id, title, body, severity)
       VALUES (?, 'payroll', ?, ?, ?, 'success')`,
      [member.user_id, member.id, `Salary paid · ${member.name}`,
       `₹${Number(net).toFixed(2)} net salary for ${period} was paid automatically and deducted from your wallet.`]
    );
  } catch (e) {
    console.warn('[PAYROLL] could not raise salary-paid notice:', e.message);
  }
}

// Raise at most one "salary pending" notification per member per month.
async function notifyInsufficient(db, result, period) {
  const m = result.member;
  const title = `Salary pending · ${m.name}`;
  try {
    const existing = await q(
      db,
      `SELECT id FROM notifications
       WHERE user_id = ? AND ref_type = 'payroll' AND ref_id = ? AND title = ?
         AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      [m.user_id, m.id, title]
    );
    if (existing.length) return;
    await q(
      db,
      `INSERT INTO notifications (user_id, ref_type, ref_id, title, body, severity)
       VALUES (?, 'payroll', ?, ?, ?, 'danger')`,
      [m.user_id, m.id, title,
       `Could not auto-pay ${period} salary (₹${result.required.toFixed(2)}). Wallet balance ₹${result.available.toFixed(2)} is insufficient — top up to process payroll.`]
    );
  } catch (e) {
    console.warn('[PAYROLL] could not raise insufficient-funds notice:', e.message);
  }
}

async function tick(db) {
  const period = currentPeriod();
  const payDate = new Date().toISOString().slice(0, 10);
  const workingDays = daysInMonth();

  let members;
  try {
    members = await q(db, `SELECT id, user_id, name, role FROM team_members WHERE status = 'active'`);
  } catch (e) {
    console.error('[PAYROLL] could not list employees:', e.message);
    return;
  }

  let paid = 0, pending = 0;
  for (const member of members) {
    try {
      const exists = await q(db, 'SELECT id FROM payslips WHERE team_member_id = ? AND pay_period = ?', [member.id, period]);
      if (exists.length) continue;

      const result = await payMember(db, member, period, payDate, workingDays);
      if (result.status === 'paid') {
        paid++;
        await notifyPaid(db, result.member, result.net, period);
      } else if (result.status === 'insufficient') {
        pending++;
        await notifyInsufficient(db, result, period);
      } else if (result.status === 'error') {
        console.warn(`[PAYROLL] error paying ${member.name}:`, result.error);
      }
    } catch (e) {
      console.warn(`[PAYROLL] unexpected error for ${member.name}:`, e.message);
    }
  }

  if (paid || pending) {
    console.log(`[PAYROLL] ${period}: ${paid} salary payment(s) processed, ${pending} pending (insufficient funds).`);
  }
}

export function startPayrollScheduler(db) {
  // First run shortly after boot, then every 6 hours so month rollovers and
  // post-top-up retries are picked up automatically.
  setTimeout(() => tick(db), 45 * 1000);
  setInterval(() => tick(db), 6 * 60 * 60 * 1000);
  console.log('[PAYROLL] Auto monthly payroll scheduler started (checks every 6 hours).');
}
