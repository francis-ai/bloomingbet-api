import db from '../../config/db.js';

export const createWithdrawal = async ({ affiliateId, amount, bankAccount }) => {
  const [result] = await db.query(
    'INSERT INTO tbl_affiliate_withdrawals (affiliate_id, amount, bank_account, status, created_at, updated_at) VALUES (?, ?, ?, "pending", NOW(), NOW())',
    [affiliateId, amount, bankAccount]
  );
  return result;
};

export const getWithdrawalsByAffiliate = async (affiliateId) => {
  const [rows] = await db.query(
    'SELECT * FROM tbl_affiliate_withdrawals WHERE affiliate_id = ? ORDER BY created_at DESC',
    [affiliateId]
  );
  return rows;
};

export const getAffiliateSummaryById = async (affiliateId) => {
  // Get total earned and current balance
  const [affiliateRows] = await db.query(
    'SELECT acc_balance, total_earned FROM tbl_affiliates WHERE id = ?',
    [affiliateId]
  );

  // Get total withdrawn (approved only)
  const [withdrawRows] = await db.query(
    'SELECT SUM(amount) AS totalWithdraw FROM tbl_affiliate_withdrawals WHERE affiliate_id = ? AND status = "approved"',
    [affiliateId]
  );

  const affiliate = affiliateRows[0] || {};
  const totalEarned = affiliate.total_earned || 0;
  const totalWithdraw = withdrawRows[0]?.totalWithdraw || 0;

  // Calculate available balance
  const availableBal = totalEarned - totalWithdraw;

  // Update affiliate balance in database
  await db.query(
    'UPDATE tbl_affiliates SET acc_balance = ? WHERE id = ?',
    [availableBal, affiliateId]
  );

  // Return summary data
  return {
    availableBal,
    totalEarned,
    totalWithdraw,
  };
};

export const getAllWithdrawals = async () => {
  const [rows] = await db.query(
    'SELECT w.*, a.email, a.firstname, a.lastname FROM tbl_affiliate_withdrawals w JOIN tbl_affiliates a ON w.affiliate_id = a.id ORDER BY w.created_at DESC'
  );
  return rows;
};

export const updateWithdrawalStatus = async (id, status) => {
  const [result] = await db.query(
    'UPDATE tbl_affiliate_withdrawals SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id]
  );
  return result;
};

export const deductAffiliateBalance = async (affiliateId, amount) => {
  const [result] = await db.query(
    'UPDATE tbl_affiliates SET acc_balance = balance - ? WHERE id = ?',
    [amount, affiliateId]
  );
  return result;
};
