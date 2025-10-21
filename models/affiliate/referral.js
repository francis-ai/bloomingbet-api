import db from '../../config/db.js';
import Deposit from '../user/deposit.js'; 

export const Referral = {
  // ================= GET ALL REFERRED USERS =================
  async getReferredUsers(affiliateId) {
    const [rows] = await db.query(
      `SELECT 
          u.id,
          u.fullname,
          u.email,
          u.phone,
          u.created_at,
          COALESCE(SUM(c.commission_amount), 0) AS total_commission
      FROM tbl_users AS u
      INNER JOIN tbl_affiliates AS a
          ON u.coupon_code = a.affiliate_code
      LEFT JOIN tbl_affiliate_commissions AS c
          ON c.user_id = u.id AND c.affiliate_id = a.id
      WHERE a.id = ?
      GROUP BY u.id, u.fullname, u.email, u.phone, u.created_at
      ORDER BY u.created_at DESC`,
      [affiliateId]
    );

    return rows;
  },


  // ================= CREDIT COMMISSION IF FIRST DEPOSIT =================
  async creditCommission(userId) {
    // 1️⃣ Get user info + coupon_code
    const [userRows] = await db.query(`SELECT coupon_code FROM tbl_users WHERE id = ?`, [userId]);
    if (!userRows.length) return;

    const userCoupon = userRows[0].coupon_code;
    if (!userCoupon) return; // no affiliate

    // 2️⃣ Find affiliate by coupon_code
    const [affiliateRows] = await db.query(
      `SELECT id, total_earned FROM tbl_affiliates WHERE affiliate_code = ?`,
      [userCoupon]
    );
    if (!affiliateRows.length) return;

    const affiliate = affiliateRows[0];

    // 3️⃣ Get user's first successful deposit
    const firstDeposit = await Deposit.getFirstDeposit(userId);
    if (!firstDeposit) return;

    // 4️⃣ Check if commission was already credited
    const [existingRows] = await db.query(
      `SELECT * FROM tbl_affiliate_commissions WHERE affiliate_id = ? AND user_id = ? AND deposit_id = ?`,
      [affiliate.id, userId, firstDeposit.id]
    );
    if (existingRows.length) return; // already credited, stop here

    const commission = firstDeposit.amount * 0.15;

    // 5️⃣ Update affiliate total_earned
    await db.query(
      `UPDATE tbl_affiliates SET total_earned = total_earned + ? WHERE id = ?`,
      [commission, affiliate.id]
    );

    // 6️⃣ Record commission
    await db.query(
      `INSERT INTO tbl_affiliate_commissions (affiliate_id, user_id, deposit_id, commission_amount)
      VALUES (?, ?, ?, ?)`,
      [affiliate.id, userId, firstDeposit.id, commission]
    );

    return { affiliateId: affiliate.id, commission };
  }
};
