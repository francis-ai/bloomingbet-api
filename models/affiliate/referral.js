import db from '../../config/db.js';
import Deposit from '../user/deposit.js'; 

export const Referral = {
  // ========= Get Dashboard Stats ==================
  async getDashboardStats(affiliateId) {
    try {
      // ===== 1️⃣ Get total earned, balance, withdrawals =====
      const [affiliateRows] = await db.query(
        'SELECT acc_balance, total_earned FROM tbl_affiliates WHERE id = ?',
        [affiliateId]
      );

      const [withdrawRows] = await db.query(
        'SELECT SUM(amount) AS totalWithdraw FROM tbl_affiliate_withdrawals WHERE affiliate_id = ? AND status = "approved"',
        [affiliateId]
      );

      const totalEarned = affiliateRows[0]?.total_earned || 0;
      const totalWithdraw = withdrawRows[0]?.totalWithdraw || 0;
      const availableBal = totalEarned - totalWithdraw;

      // ===== 2️⃣ Get referred users and their total commissions =====
      const [userRows] = await db.query(
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

      // ===== 3️⃣ Get total referral clicks =====
      const [clickRows] = await db.query(
        `SELECT COUNT(*) AS totalClicks 
        FROM tbl_referral_clicks 
        WHERE affiliate_id = ?`,
        [affiliateId]
      );

      const totalClicks = clickRows[0]?.totalClicks || 0;

      // ===== 4️⃣ Return full dashboard summary =====
      return {
        availableBal,
        totalEarned,
        totalWithdraw,
        totalClicks,
        totalReferredUsers: userRows.length,
        referredUsers: userRows,
      };
    } catch (error) {
      console.error("getDashboardStats Error:", error);
      throw error;
    }
  },

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
  },

  async trackReferralClick(referralCode, ip, userAgent) {
    const [rows] = await db.query(
      `SELECT id, referral_link FROM tbl_affiliates WHERE affiliate_code = ?`,
      [referralCode]
    );

    if (rows.length === 0) return null;

    const affiliateId = rows[0].id;
    const referralLink = rows[0].referral_link;

    await db.query(
      `INSERT INTO tbl_referral_clicks (affiliate_id, referral_link, ip_address, user_agent)
      VALUES (?, ?, ?, ?)`,
      [affiliateId, referralLink, ip, userAgent]
    );

    return affiliateId;
  },

  // ✅ Get total clicks for a specific affiliate
  async getReferralClickCount(affiliateId) {
    try {
      const [rows] = await db.query(
        'SELECT COUNT(*) AS totalClicks FROM tbl_referral_clicks WHERE affiliate_id = ?',
        [affiliateId]
      );

      return rows[0]?.totalClicks || 0;
    } catch (error) {
      console.error("getReferralClickCount Error:", error);
      throw error;
    }
  },
};
