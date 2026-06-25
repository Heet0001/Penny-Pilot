// Inventory & Procurement routes
// Mounted at /api/inventory in server.js

import express from 'express';

export function createInventoryRouter({ db, checkAuth, updateWalletBalance }) {
  const router = express.Router();
  router.use(checkAuth);

  // ---------------- Suppliers ----------------

  router.get('/suppliers', (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT s.*, COUNT(p.id) AS product_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error('[INV] suppliers list error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, suppliers: rows });
    });
  });

  router.post('/suppliers', (req, res) => {
    const userId = req.user.id;
    const { name, contact_person, email, phone, address, gst_number, payment_terms, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const sql = `
      INSERT INTO suppliers
        (user_id, name, contact_person, email, phone, address, gst_number, payment_terms, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      userId, name, contact_person || null, email || null, phone || null,
      address || null, gst_number || null, payment_terms || null,
      status || 'active', notes || null,
    ];
    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('[INV] supplier insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ success: true, supplier_id: result.insertId });
    });
  });

  router.put('/suppliers/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, contact_person, email, phone, address, gst_number, payment_terms, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const sql = `
      UPDATE suppliers SET
        name = ?, contact_person = ?, email = ?, phone = ?, address = ?,
        gst_number = ?, payment_terms = ?, status = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `;
    const params = [
      name, contact_person || null, email || null, phone || null, address || null,
      gst_number || null, payment_terms || null, status || 'active', notes || null,
      id, userId,
    ];
    db.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Supplier not found' });
      res.json({ success: true });
    });
  });

  router.delete('/suppliers/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query('DELETE FROM suppliers WHERE id = ? AND user_id = ?', [id, userId], (err, result) => {
      if (err) {
        // Likely FK constraint -> products reference this supplier
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
          return res.status(400).json({ error: 'Cannot delete supplier with linked products' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Supplier not found' });
      res.json({ success: true });
    });
  });

  // ---------------- Products ----------------

  router.get('/products', (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT p.*, s.name AS supplier_name,
             (p.quantity_in_stock <= p.reorder_level) AS is_low_stock
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error('[INV] products list error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, products: rows });
    });
  });

  router.post('/products', (req, res) => {
    const userId = req.user.id;
    const {
      sku, name, description, category, unit, cost_price, selling_price,
      quantity_in_stock, reorder_level, supplier_id, status,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    const sql = `
      INSERT INTO products
        (user_id, sku, name, description, category, unit, cost_price, selling_price,
         quantity_in_stock, reorder_level, supplier_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      userId, sku || null, name, description || null, category || null, unit || 'pcs',
      Number(cost_price) || 0, Number(selling_price) || 0,
      Number(quantity_in_stock) || 0, Number(reorder_level) || 10,
      supplier_id ? Number(supplier_id) : null, status || 'active',
    ];
    db.query(sql, params, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'A product with this SKU already exists' });
        }
        console.error('[INV] product insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Initial stock should be recorded as a movement so the audit trail is complete
      const initialQty = Number(quantity_in_stock) || 0;
      if (initialQty > 0) {
        db.query(
          `INSERT INTO stock_movements
             (product_id, user_id, movement_type, quantity, reference_type, notes)
           VALUES (?, ?, 'in', ?, 'manual', 'Initial stock on product creation')`,
          [result.insertId, userId, initialQty],
          () => {}
        );
      }
      res.status(201).json({ success: true, product_id: result.insertId });
    });
  });

  router.put('/products/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      sku, name, description, category, unit, cost_price, selling_price,
      reorder_level, supplier_id, status,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    // Note: quantity_in_stock is intentionally NOT updated here. Use /products/:id/adjust-stock
    // so every quantity change is recorded as a stock_movement.
    const sql = `
      UPDATE products SET
        sku = ?, name = ?, description = ?, category = ?, unit = ?,
        cost_price = ?, selling_price = ?, reorder_level = ?,
        supplier_id = ?, status = ?
      WHERE id = ? AND user_id = ?
    `;
    const params = [
      sku || null, name, description || null, category || null, unit || 'pcs',
      Number(cost_price) || 0, Number(selling_price) || 0, Number(reorder_level) || 10,
      supplier_id ? Number(supplier_id) : null, status || 'active',
      id, userId,
    ];
    db.query(sql, params, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'A product with this SKU already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true });
    });
  });

  router.delete('/products/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query('DELETE FROM products WHERE id = ? AND user_id = ?', [id, userId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true });
    });
  });

  router.post('/products/:id/adjust-stock', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { delta, reason, notes } = req.body;
    const qty = Number(delta);
    if (!qty || isNaN(qty)) {
      return res.status(400).json({ error: 'delta must be a non-zero number (positive = add, negative = remove)' });
    }

    db.query('SELECT * FROM products WHERE id = ? AND user_id = ?', [id, userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

      const product = rows[0];
      const newQty = Number(product.quantity_in_stock) + qty;
      if (newQty < 0) {
        return res.status(400).json({ error: 'Stock cannot go negative' });
      }

      db.query(
        'UPDATE products SET quantity_in_stock = ? WHERE id = ?',
        [newQty, id],
        (updErr) => {
          if (updErr) return res.status(500).json({ error: 'Database error' });
          const movementType = qty > 0 ? 'in' : 'out';
          db.query(
            `INSERT INTO stock_movements
               (product_id, user_id, movement_type, quantity, reference_type, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, userId, movementType, Math.abs(qty), reason || 'adjustment', notes || null],
            () => {
              res.json({ success: true, new_quantity: newQty });
            }
          );
        }
      );
    });
  });

  router.get('/products/:id/movements', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `SELECT sm.* FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.product_id = ? AND p.user_id = ?
        ORDER BY sm.created_at DESC LIMIT 200`,
      [id, userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, movements: rows });
      }
    );
  });

  // ---------------- Purchase Orders ----------------

  router.get('/purchase-orders', (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT po.*, s.name AS supplier_name,
             COUNT(poi.id) AS line_items
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.user_id = ?
      GROUP BY po.id
      ORDER BY po.created_at DESC
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, purchase_orders: rows });
    });
  });

  router.get('/purchase-orders/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ? AND po.user_id = ?`,
      [id, userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows.length === 0) return res.status(404).json({ error: 'PO not found' });
        const po = rows[0];
        db.query(
          `SELECT poi.*, p.name AS product_name, p.sku
           FROM purchase_order_items poi
           JOIN products p ON poi.product_id = p.id
           WHERE poi.po_id = ?`,
          [id],
          (e2, items) => {
            if (e2) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, purchase_order: { ...po, items: items || [] } });
          }
        );
      }
    );
  });

  router.post('/purchase-orders', (req, res) => {
    const userId = req.user.id;
    const { supplier_id, expected_date, notes, items, status } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    let total = 0;
    for (const it of items) {
      const q = Number(it.quantity), p = Number(it.unit_price);
      if (!q || !p || q <= 0 || p <= 0) {
        return res.status(400).json({ error: 'Each item needs a positive quantity and unit_price' });
      }
      total += q * p;
    }

    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    db.getConnection((err, conn) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return res.status(500).json({ error: 'Could not start transaction' });
        }
        conn.query(
          `INSERT INTO purchase_orders
             (user_id, po_number, supplier_id, status, total_amount, expected_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, poNumber, supplier_id, status || 'pending_approval', total, expected_date || null, notes || null],
          (poErr, poResult) => {
            if (poErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Insert failed' }); });
            const poId = poResult.insertId;

            const itemValues = items.map((it) => [
              poId, Number(it.product_id), Number(it.quantity), Number(it.unit_price), 0,
            ]);
            conn.query(
              `INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_price, received_qty) VALUES ?`,
              [itemValues],
              (itErr) => {
                if (itErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Insert items failed' }); });
                conn.commit((cErr) => {
                  conn.release();
                  if (cErr) return res.status(500).json({ error: 'Commit failed' });
                  res.status(201).json({ success: true, purchase_order_id: poId, po_number: poNumber, total_amount: total });
                });
              }
            );
          }
        );
      });
    });
  });

  router.put('/purchase-orders/:id/approve', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `UPDATE purchase_orders SET status = 'approved', approved_by = ?
       WHERE id = ? AND user_id = ? AND status IN ('draft','pending_approval')`,
      [userId, id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(400).json({ error: 'PO not found or not approvable' });
        res.json({ success: true });
      }
    );
  });

  // Receiving a PO does three things atomically:
  //  1. Marks PO as received and updates received_qty per item
  //  2. Inserts stock_movements rows and bumps products.quantity_in_stock
  //  3. Records a debit_entries row (Inventory Purchase) and deducts wallet
  router.put('/purchase-orders/:id/receive', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const receivedDate = req.body.received_date || new Date().toISOString().slice(0, 10);

    db.getConnection((err, conn) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return res.status(500).json({ error: 'Could not start transaction' });
        }

        conn.query(
          'SELECT * FROM purchase_orders WHERE id = ? AND user_id = ? FOR UPDATE',
          [id, userId],
          (poErr, poRows) => {
            if (poErr || poRows.length === 0) {
              return conn.rollback(() => { conn.release(); res.status(404).json({ error: 'PO not found' }); });
            }
            const po = poRows[0];
            if (po.status !== 'approved') {
              return conn.rollback(() => {
                conn.release();
                res.status(400).json({ error: `PO must be approved before receiving (current: ${po.status})` });
              });
            }

            // Wallet balance check
            conn.query('SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE', [userId], (wErr, wRows) => {
              if (wErr) {
                return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet check failed' }); });
              }
              const balance = wRows.length ? Number(wRows[0].balance) : 0;
              const total = Number(po.total_amount);
              if (balance < total) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(400).json({ error: 'Insufficient wallet balance to receive this PO', available: balance, required: total });
                });
              }

              conn.query(
                'SELECT * FROM purchase_order_items WHERE po_id = ?',
                [id],
                (iErr, items) => {
                  if (iErr || !items || items.length === 0) {
                    return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'PO has no items' }); });
                  }

                  // Sequentially update stock + record movements
                  const tasks = items.map((it) => (cb) => {
                    conn.query(
                      'UPDATE products SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?',
                      [it.quantity, it.product_id],
                      (uErr) => {
                        if (uErr) return cb(uErr);
                        conn.query(
                          'UPDATE purchase_order_items SET received_qty = quantity WHERE id = ?',
                          [it.id],
                          (rErr) => {
                            if (rErr) return cb(rErr);
                            conn.query(
                              `INSERT INTO stock_movements
                                 (product_id, user_id, movement_type, quantity, reference_type, reference_id, notes)
                               VALUES (?, ?, 'in', ?, 'purchase_order', ?, ?)`,
                              [it.product_id, userId, it.quantity, id, `Received via ${po.po_number}`],
                              (mErr) => cb(mErr || null)
                            );
                          }
                        );
                      }
                    );
                  });

                  // Run sequentially
                  const runNext = (idx) => {
                    if (idx >= tasks.length) return finalizePurchase();
                    tasks[idx]((tErr) => {
                      if (tErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Stock update failed' }); });
                      runNext(idx + 1);
                    });
                  };

                  function finalizePurchase() {
                    // Update PO + wallet + create debit entry
                    conn.query(
                      `UPDATE purchase_orders SET status = 'received', received_date = ? WHERE id = ?`,
                      [receivedDate, id],
                      (poUpdErr) => {
                        if (poUpdErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'PO update failed' }); });
                        conn.query(
                          'UPDATE wallet SET balance = balance - ? WHERE user_id = ?',
                          [total, userId],
                          (walErr) => {
                            if (walErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet update failed' }); });
                            const debitDescription = `Inventory Purchase via ${po.po_number}`;
                            conn.query(
                              `INSERT INTO debit_entries (user_id, amount, category, entry_date, description)
                               VALUES (?, ?, 'Inventory Purchase', ?, ?)`,
                              [userId, total, receivedDate, debitDescription],
                              (deErr) => {
                                if (deErr) return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Debit entry failed' }); });
                                conn.commit((cErr) => {
                                  conn.release();
                                  if (cErr) return res.status(500).json({ error: 'Commit failed' });
                                  res.json({ success: true, message: 'PO received, stock updated, expense recorded', total_amount: total });
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }

                  runNext(0);
                }
              );
            });
          }
        );
      });
    });
  });

  router.put('/purchase-orders/:id/cancel', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `UPDATE purchase_orders SET status = 'cancelled'
       WHERE id = ? AND user_id = ? AND status IN ('draft','pending_approval','approved')`,
      [id, userId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot cancel PO' });
        res.json({ success: true });
      }
    );
  });

  // ---------------- Stats ----------------

  router.get('/stats', (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM products WHERE user_id = ?)                                               AS total_products,
        (SELECT COUNT(*) FROM products WHERE user_id = ? AND quantity_in_stock <= reorder_level)        AS low_stock_count,
        (SELECT COALESCE(SUM(quantity_in_stock * cost_price), 0) FROM products WHERE user_id = ?)       AS inventory_value,
        (SELECT COUNT(*) FROM suppliers WHERE user_id = ?)                                              AS supplier_count,
        (SELECT COUNT(*) FROM purchase_orders WHERE user_id = ? AND status = 'pending_approval')        AS pending_pos,
        (SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE user_id = ? AND status = 'received'
           AND received_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))                                   AS spend_30d
    `;
    db.query(sql, [userId, userId, userId, userId, userId, userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, stats: rows[0] || {} });
    });
  });

  return router;
}
