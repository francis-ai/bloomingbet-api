import db from '../../config/db.js';


export const Referral = {
// ===================== GET ALL REFERRED USERS =====================
async getReferredUsers(affiliateId) {
  const [rows] = await db.query(
    `SELECT 
        u.id, 
        u.fullname, 
        u.email, 
        u.phone, 
        u.created_at
     FROM tbl_users AS u
     INNER JOIN tbl_affiliates AS a
        ON u.coupon_code = a.affiliate_code
     WHERE a.id = ?
     ORDER BY u.created_at DESC`,
    [affiliateId]
  );

  return rows;
}

};
