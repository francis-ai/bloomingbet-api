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
  static async processDepositWithCommission(user_id, reference, amount) {
    const conn = await db.getConnection();
    try {
      await conn.query("START TRANSACTION");

      // 1️⃣ Lock the deposit row for update (or create it if doesn't exist)
      let depositId;
      const [depositRows] = await conn.query(
        `SELECT id, credited FROM tbl_deposit WHERE reference = ? FOR UPDATE`,
        [reference]
      );

      if (depositRows.length) {
        depositId = depositRows[0].id;
        if (depositRows[0].credited === 1) {
          await conn.query("ROLLBACK");
          return { alreadyProcessed: true }; // ✅ stop double credit
        }
      } else {
        const [insertResult] = await conn.query(
          `INSERT INTO tbl_deposit (user_id, amount, reference, status, credited)
          VALUES (?, ?, ?, "success", 0)`,
          [user_id, amount, reference]
        );
        depositId = insertResult.insertId;
      }

      // 2️⃣ Credit user balance safely
      await conn.query(
        `UPDATE tbl_users SET available_bal = available_bal + ? WHERE id = ?`,
        [amount, user_id]
      );

      // 3️⃣ Mark deposit as credited
      await conn.query(
        `UPDATE tbl_deposit SET credited = 1 WHERE id = ?`,
        [depositId]
      );

      // 4️⃣ Handle affiliate commission only if first_deposit = 0
      const [userRows] = await conn.query(
        `SELECT coupon_code, first_deposit FROM tbl_users WHERE id = ? FOR UPDATE`,
        [user_id]
      );

      const userCoupon = userRows[0]?.coupon_code;
      const firstDepositFlag = userRows[0]?.first_deposit;

      if (userCoupon && firstDepositFlag === 0) {
        const [affiliateRows] = await conn.query(
          `SELECT id, total_earned FROM tbl_affiliates WHERE affiliate_code = ?`,
          [userCoupon]
        );

        if (affiliateRows.length) {
          const affiliate = affiliateRows[0];
          const commission = amount * 0.15;

          await conn.query(
            `UPDATE tbl_affiliates SET total_earned = total_earned + ? WHERE id = ?`,
            [commission, affiliate.id]
          );

          await conn.query(
            `INSERT INTO tbl_affiliate_commissions (affiliate_id, user_id, deposit_id, commission_amount)
            VALUES (?, ?, ?, ?)`,
            [affiliate.id, user_id, depositId, commission]
          );

          await conn.query(
            `UPDATE tbl_users SET first_deposit = 1 WHERE id = ?`,
            [user_id]
          );
        }
      }

      await conn.query("COMMIT");
      return { success: true, depositId };
    } catch (err) {
      await conn.query("ROLLBACK");
      throw err;
    } finally {
      conn.release();
    }
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
