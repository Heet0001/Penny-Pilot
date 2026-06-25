// HR & Payroll routes
// Mounted at /api/hr in server.js

import express from 'express';

// Simple Indian-style tax slabs for new regime (FY 2024-25 simplified).
// Used only for monthly proration; users can override via tax_regime field.
export function computeMonthlyTax(grossMonthly, regime = 'new') {
  // Cheap approximation - the user can refine later. We treat the gross as a yearly portion and prorate.
  const annualGross = grossMonthly * 12;
  let annualTax = 0;
  if (regime === 'old') {
    if (annualGross <= 250000) annualTax = 0;
    else if (annualGross <= 500000) annualTax = (annualGross - 250000) * 0.05;
    else if (annualGross <= 1000000) annualTax = 12500 + (annualGross - 500000) * 0.20;
    else annualTax = 112500 + (annualGross - 1000000) * 0.30;
  } else {
    if (annualGross <= 300000) annualTax = 0;
    else if (annualGross <= 600000) annualTax = (annualGross - 300000) * 0.05;
    else if (annualGross <= 900000) annualTax = 15000 + (annualGross - 600000) * 0.10;
    else if (annualGross <= 1200000) annualTax = 45000 + (annualGross - 900000) * 0.15;
    else if (annualGross <= 1500000) annualTax = 90000 + (annualGross - 1200000) * 0.20;
    else annualTax = 150000 + (annualGross - 1500000) * 0.30;
  }
  return Math.max(0, annualTax / 12);
}

export function computePayslip(member, daysPresent, workingDays, overtime = 0, bonus = 0) {
  const ratio = workingDays > 0 ? Math.min(1, daysPresent / workingDays) : 1;

  // Legacy members (created via the old Team page) only have monthly_payroll set,
  // with no basic/hra/allowances breakdown. Derive a standard 60/24/16 split so
  // payroll still works for them instead of computing a zero salary.
  let baseBasic = Number(member.basic_salary || 0);
  let baseHra = Number(member.hra || 0);
  let baseAllow = Number(member.allowances || 0);
  if (baseBasic + baseHra + baseAllow === 0 && Number(member.monthly_payroll || 0) > 0) {
    const mp = Number(member.monthly_payroll);
    baseBasic = mp * 0.60;
    baseHra = mp * 0.24;
    baseAllow = mp * 0.16;
  }

  const basic = baseBasic * ratio;
  const hra = baseHra * ratio;
  const allowances = baseAllow * ratio;
  const ot = Number(overtime) || 0;
  const bn = Number(bonus) || 0;
  const gross = basic + hra + allowances + ot + bn;

  const pf = basic * (Number(member.pf_percent || 12) / 100);
  const tax = computeMonthlyTax(gross, member.tax_regime || 'new');
  const otherDeductions = 0;
  const net = Math.max(0, gross - pf - tax - otherDeductions);

  const round = (n) => Math.round(n * 100) / 100;
  return {
    basic: round(basic),
    hra: round(hra),
    allowances: round(allowances),
    overtime: round(ot),
    bonus: round(bn),
    gross_salary: round(gross),
    pf_deduction: round(pf),
    tax_deduction: round(tax),
    other_deductions: round(otherDeductions),
    net_salary: round(net),
  };
}

export function createHRRouter({ db, checkAuth }) {
  const router = express.Router();
  router.use(checkAuth);

  // ---------------- Employees (extended team_members) ----------------

  router.get('/employees', (req, res) => {
    const userId = req.user.id;
    db.query(
      `SELECT * FROM team_members WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, employees: rows });
      }
    );
  });

  router.post('/employees', (req, res) => {
    const userId = req.user.id;
    const e = req.body || {};
    if (!e.name || !e.role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }
    const sql = `
      INSERT INTO team_members
        (user_id, name, role, monthly_payroll, department, notes,
         employee_code, email, phone, joining_date, bank_account, ifsc, pan,
         tax_regime, basic_salary, hra, allowances, pf_percent, work_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const monthlyPayroll = Number(e.monthly_payroll
      || (Number(e.basic_salary || 0) + Number(e.hra || 0) + Number(e.allowances || 0)));
    const params = [
      userId, e.name, e.role, monthlyPayroll, e.department || null, e.notes || null,
      e.employee_code || null, e.email || null, e.phone || null, e.joining_date || null,
      e.bank_account || null, e.ifsc || null, e.pan || null,
      e.tax_regime || 'new',
      Number(e.basic_salary || 0), Number(e.hra || 0), Number(e.allowances || 0),
      Number(e.pf_percent || 12), e.work_mode || 'onsite',
    ];
    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('[HR] employee insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ success: true, employee_id: result.insertId });
    });
  });

  router.put('/employees/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const e = req.body || {};
    const monthlyPayroll = Number(e.monthly_payroll
      || (Number(e.basic_salary || 0) + Number(e.hra || 0) + Number(e.allowances || 0)));

    const sql = `
      UPDATE team_members SET
        name = ?, role = ?, monthly_payroll = ?, department = ?, notes = ?,
        employee_code = ?, email = ?, phone = ?, joining_date = ?,
        bank_account = ?, ifsc = ?, pan = ?,
        tax_regime = ?, basic_salary = ?, hra = ?, allowances = ?, pf_percent = ?, work_mode = ?
      WHERE id = ? AND user_id = ?
    `;
    const params = [
      e.name, e.role, monthlyPayroll, e.department || null, e.notes || null,
      e.employee_code || null, e.email || null, e.phone || null, e.joining_date || null,
      e.bank_account || null, e.ifsc || null, e.pan || null,
      e.tax_regime || 'new',
      Number(e.basic_salary || 0), Number(e.hra || 0), Number(e.allowances || 0),
      Number(e.pf_percent || 12), e.work_mode || 'onsite',
      id, userId,
    ];
    db.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
      res.json({ success: true });
    });
  });

  router.delete('/employees/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `UPDATE team_members SET status = 'inactive' WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
        res.json({ success: true });
      }
    );
  });

  // ---------------- Attendance ----------------

  router.get('/attendance', (req, res) => {
    const userId = req.user.id;
    const { from, to, team_member_id } = req.query;
    const where = ['a.user_id = ?'];
    const params = [userId];
    if (from) { where.push('a.attendance_date >= ?'); params.push(from); }
    if (to)   { where.push('a.attendance_date <= ?'); params.push(to); }
    if (team_member_id) { where.push('a.team_member_id = ?'); params.push(team_member_id); }
    const sql = `
      SELECT a.*, tm.name AS member_name, tm.role AS member_role
      FROM attendance a
      JOIN team_members tm ON a.team_member_id = tm.id
      WHERE ${where.join(' AND ')}
      ORDER BY a.attendance_date DESC, tm.name ASC
    `;
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, attendance: rows });
    });
  });

  // Upsert a single day's attendance for a member
  router.post('/attendance', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, attendance_date, status, hours_worked, notes } = req.body;
    if (!team_member_id || !attendance_date || !status) {
      return res.status(400).json({ error: 'team_member_id, attendance_date, status are required' });
    }
    const sql = `
      INSERT INTO attendance (team_member_id, user_id, attendance_date, status, hours_worked, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status), hours_worked = VALUES(hours_worked), notes = VALUES(notes)
    `;
    db.query(sql, [team_member_id, userId, attendance_date, status, Number(hours_worked) || 0, notes || null], (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    });
  });

  // ---------------- Leaves ----------------

  router.get('/leaves', (req, res) => {
    const userId = req.user.id;
    db.query(
      `SELECT l.*, tm.name AS member_name, tm.role AS member_role
       FROM leaves l JOIN team_members tm ON l.team_member_id = tm.id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, leaves: rows });
      }
    );
  });

  router.post('/leaves', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, leave_type, start_date, end_date, reason, status } = req.body;
    if (!team_member_id || !leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'team_member_id, leave_type, start_date and end_date are required' });
    }
    db.query(
      `INSERT INTO leaves (team_member_id, user_id, leave_type, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [team_member_id, userId, leave_type, start_date, end_date, reason || null, status || 'pending'],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ success: true, leave_id: result.insertId });
      }
    );
  });

  router.put('/leaves/:id/status', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.query(
      `UPDATE leaves SET status = ?, approved_by = ? WHERE id = ? AND user_id = ?`,
      [status, userId, id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Leave not found' });
        res.json({ success: true });
      }
    );
  });

  // ---------------- Appraisals ----------------

  router.get('/appraisals', (req, res) => {
    const userId = req.user.id;
    db.query(
      `SELECT a.*, tm.name AS member_name, tm.role AS member_role
       FROM appraisals a JOIN team_members tm ON a.team_member_id = tm.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, appraisals: rows });
      }
    );
  });

  router.post('/appraisals', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, review_period, goals, rating, comments, promotion_to_role, salary_increment } = req.body;
    if (!team_member_id) return res.status(400).json({ error: 'team_member_id required' });
    db.query(
      `INSERT INTO appraisals (team_member_id, user_id, review_period, goals, rating, comments, promotion_to_role, salary_increment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [team_member_id, userId, review_period || null, goals || null, rating || null, comments || null,
       promotion_to_role || null, Number(salary_increment) || 0],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        // Optional: apply increment immediately
        if (Number(salary_increment) > 0) {
          db.query(
            'UPDATE team_members SET monthly_payroll = monthly_payroll + ?, basic_salary = basic_salary + ? WHERE id = ? AND user_id = ?',
            [Number(salary_increment), Number(salary_increment), team_member_id, userId],
            () => {}
          );
        }
        res.status(201).json({ success: true, appraisal_id: result.insertId });
      }
    );
  });

  // ---------------- Recruitment ----------------

  router.get('/job-postings', (req, res) => {
    const userId = req.user.id;
    db.query(
      `SELECT jp.*, COUNT(a.id) AS applicant_count
       FROM job_postings jp
       LEFT JOIN applicants a ON a.job_posting_id = jp.id
       WHERE jp.user_id = ?
       GROUP BY jp.id
       ORDER BY jp.created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, job_postings: rows });
      }
    );
  });

  router.post('/job-postings', (req, res) => {
    const userId = req.user.id;
    const { title, department, description, status } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    db.query(
      `INSERT INTO job_postings (user_id, title, department, description, status) VALUES (?, ?, ?, ?, ?)`,
      [userId, title, department || null, description || null, status || 'open'],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ success: true, job_posting_id: result.insertId });
      }
    );
  });

  router.put('/job-postings/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, department, description, status } = req.body;
    db.query(
      `UPDATE job_postings SET title = ?, department = ?, description = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [title, department || null, description || null, status || 'open', id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Posting not found' });
        res.json({ success: true });
      }
    );
  });

  router.get('/applicants', (req, res) => {
    const userId = req.user.id;
    const { job_posting_id } = req.query;
    const where = ['a.user_id = ?'];
    const params = [userId];
    if (job_posting_id) { where.push('a.job_posting_id = ?'); params.push(job_posting_id); }
    db.query(
      `SELECT a.*, jp.title AS job_title FROM applicants a
       JOIN job_postings jp ON a.job_posting_id = jp.id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC`,
      params,
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, applicants: rows });
      }
    );
  });

  router.post('/applicants', (req, res) => {
    const userId = req.user.id;
    const { job_posting_id, name, email, phone, resume_url, stage, notes } = req.body;
    if (!job_posting_id || !name) {
      return res.status(400).json({ error: 'job_posting_id and name are required' });
    }
    db.query(
      `INSERT INTO applicants (job_posting_id, user_id, name, email, phone, resume_url, stage, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [job_posting_id, userId, name, email || null, phone || null, resume_url || null, stage || 'applied', notes || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ success: true, applicant_id: result.insertId });
      }
    );
  });

  router.put('/applicants/:id/stage', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { stage } = req.body;
    const allowed = ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];
    if (!allowed.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
    db.query(
      `UPDATE applicants SET stage = ? WHERE id = ? AND user_id = ?`,
      [stage, id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Applicant not found' });
        res.json({ success: true });
      }
    );
  });

  // ---------------- Payroll - generate payslip preview ----------------

  router.post('/payroll/preview', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, working_days, days_present, overtime, bonus } = req.body;
    if (!team_member_id || !working_days) {
      return res.status(400).json({ error: 'team_member_id and working_days are required' });
    }
    db.query(
      `SELECT * FROM team_members WHERE id = ? AND user_id = ? AND status = 'active'`,
      [team_member_id, userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
        const slip = computePayslip(rows[0], Number(days_present) || Number(working_days),
                                    Number(working_days), Number(overtime) || 0, Number(bonus) || 0);
        res.json({ success: true, member: rows[0], payslip: slip });
      }
    );
  });

  // Run payroll - inserts payslip + debit_entry + decrements wallet ATOMICALLY
  router.post('/payroll/run', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, pay_period, working_days, days_present, overtime, bonus, payment_date, notes } = req.body;
    if (!team_member_id || !pay_period || !working_days) {
      return res.status(400).json({ error: 'team_member_id, pay_period, working_days are required' });
    }
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(pay_period)) {
      return res.status(400).json({ error: 'pay_period must be in YYYY-MM format' });
    }

    db.getConnection((err, conn) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return res.status(500).json({ error: 'Could not start transaction' });
        }
        conn.query(
          `SELECT * FROM team_members WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE`,
          [team_member_id, userId],
          (mErr, mRows) => {
            if (mErr || mRows.length === 0) {
              return conn.rollback(() => { conn.release(); res.status(404).json({ error: 'Employee not found' }); });
            }
            const member = mRows[0];

            // Block if a payslip for this member+period already exists
            conn.query(
              'SELECT id FROM payslips WHERE team_member_id = ? AND pay_period = ?',
              [team_member_id, pay_period],
              (dupErr, dupRows) => {
                if (dupErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Database error' }); });
                if (dupRows.length > 0) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(400).json({ error: `Payslip already exists for ${member.name} for ${pay_period}` });
                  });
                }

                const slip = computePayslip(member,
                  Number(days_present) || Number(working_days),
                  Number(working_days),
                  Number(overtime) || 0, Number(bonus) || 0);

                if (slip.net_salary <= 0) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(400).json({ error: 'Net salary computed as zero - check basic/hra/allowances' });
                  });
                }

                // Wallet check
                conn.query('SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE', [userId], (wErr, wRows) => {
                  if (wErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet check failed' }); });
                  const balance = wRows.length ? Number(wRows[0].balance) : 0;
                  if (balance < slip.net_salary) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(400).json({
                        error: 'Insufficient wallet balance for payroll',
                        available: balance, required: slip.net_salary,
                      });
                    });
                  }

                  const payDate = payment_date || new Date().toISOString().slice(0, 10);
                  const debitDescription = `Payroll · ${member.name} (${member.role}) · ${pay_period}`;

                  conn.query(
                    `INSERT INTO debit_entries (user_id, amount, category, entry_date, description)
                     VALUES (?, ?, 'Payroll', ?, ?)`,
                    [userId, slip.net_salary, payDate, debitDescription],
                    (deErr, deResult) => {
                      if (deErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Debit entry failed' }); });
                      const debitId = deResult.insertId;

                      conn.query(
                        'UPDATE wallet SET balance = balance - ? WHERE user_id = ?',
                        [slip.net_salary, userId],
                        (walErr) => {
                          if (walErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet update failed' }); });

                          conn.query(
                            `INSERT INTO payslips
                              (team_member_id, user_id, pay_period, working_days, days_present,
                               basic, hra, allowances, overtime, bonus, gross_salary,
                               pf_deduction, tax_deduction, other_deductions, net_salary,
                               payment_status, payment_date, debit_entry_id, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
                            [team_member_id, userId, pay_period, Number(working_days), Number(days_present) || Number(working_days),
                             slip.basic, slip.hra, slip.allowances, slip.overtime, slip.bonus, slip.gross_salary,
                             slip.pf_deduction, slip.tax_deduction, slip.other_deductions, slip.net_salary,
                             payDate, debitId, notes || null],
                            (psErr, psResult) => {
                              if (psErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Payslip insert failed' }); });
                              // Also keep legacy payroll_history table in sync if it exists
                              conn.query(
                                `INSERT INTO payroll_history (team_member_id, user_id, amount, payment_date, description, debit_entry_id)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [team_member_id, userId, slip.net_salary, payDate, debitDescription, debitId],
                                () => {
                                  // ignore errors here - this table is legacy
                                  conn.commit((cErr) => {
                                    conn.release();
                                    if (cErr) return res.status(500).json({ error: 'Commit failed' });
                                    res.status(201).json({
                                      success: true,
                                      payslip_id: psResult.insertId,
                                      debit_entry_id: debitId,
                                      payslip: slip,
                                      member_name: member.name,
                                    });
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

  router.get('/payslips', (req, res) => {
    const userId = req.user.id;
    const { team_member_id, pay_period } = req.query;
    const where = ['p.user_id = ?'];
    const params = [userId];
    if (team_member_id) { where.push('p.team_member_id = ?'); params.push(team_member_id); }
    if (pay_period)     { where.push('p.pay_period = ?');     params.push(pay_period); }
    db.query(
      `SELECT p.*, tm.name AS member_name, tm.role AS member_role
       FROM payslips p JOIN team_members tm ON p.team_member_id = tm.id
       WHERE ${where.join(' AND ')}
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      params,
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, payslips: rows });
      }
    );
  });

  // HR Dashboard stats
  router.get('/stats', (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM team_members WHERE user_id = ? AND status='active') AS active_employees,
        (SELECT COALESCE(SUM(monthly_payroll),0) FROM team_members WHERE user_id = ? AND status='active') AS monthly_outflow,
        (SELECT COUNT(*) FROM leaves WHERE user_id = ? AND status='pending') AS pending_leaves,
        (SELECT COUNT(*) FROM job_postings WHERE user_id = ? AND status='open') AS open_postings,
        (SELECT COUNT(*) FROM payslips WHERE user_id = ?
           AND payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS payslips_this_month,
        (SELECT COALESCE(SUM(net_salary),0) FROM payslips WHERE user_id = ?
           AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS paid_30d
    `;
    db.query(sql, [userId, userId, userId, userId, userId, userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, stats: rows[0] || {} });
    });
  });

  return router;
}
