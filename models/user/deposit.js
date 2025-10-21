// models/user/deposit.js
import db from "../../config/db.js";

class Deposit {
  // ✅ Add a new deposit (default: pending)
  static async addDeposit(user_id, amount, reference, status = "pending") {
    const [result] = await db.query(
      `INSERT INTO tbl_deposit (user_id, amount, reference, status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [user_id, amount, reference, status]
    );
    return result.insertId;
  }

  // ✅ Update deposit status
  static async updateStatus(reference, status) {
    await db.query(
      `UPDATE tbl_deposit SET status = ? WHERE reference = ?`,
      [status, reference]
    );
  }

  // ✅ Get deposit by reference
  static async getByReference(reference) {
    const [rows] = await db.query(
      `SELECT * FROM tbl_deposit WHERE reference = ?`,
      [reference]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // ✅ Get all deposits for a user
  static async getByUser(user_id) {
    const [rows] = await db.query(
      `SELECT * FROM tbl_deposit WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );
    return rows;
  }

  // ✅ Safely update user balance (only if not credited yet)
  static async creditUserOnce(user_id, reference, amount) {
    const [rows] = await db.query(
      `SELECT credited FROM tbl_deposit WHERE reference = ?`,
      [reference]
    );

    // If already credited, stop here
    if (rows.length && rows[0].credited === 1) return;

    // Mark as credited and add to balance atomically
    await db.query("START TRANSACTION");

    await db.query(
      `UPDATE tbl_users SET available_bal = available_bal + ? WHERE id = ?`,
      [amount, user_id]
    );

    await db.query(
      `UPDATE tbl_deposit SET credited = 1 WHERE reference = ?`,
      [reference]
    );

    await db.query("COMMIT");
  }

  // In models/user/deposit.js
  static async getFirstDeposit(user_id) {
    const [rows] = await db.query(
      `SELECT * FROM tbl_deposit WHERE user_id = ? AND status = 'success' ORDER BY created_at ASC LIMIT 1`,
      [user_id]
    );
    return rows.length ? rows[0] : null;
  }

}

export default Deposit;
