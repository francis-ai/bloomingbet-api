import db from "../config/db.js";

export const Affiliate = {
  // ===================== FIND =====================
  async findByEmail(email) {
    const [rows] = await db.query("SELECT * FROM tbl_affiliates WHERE email = ?", [email]);
    return rows[0];
  },

  async findByPhone(phone) {
    const [rows] = await db.query("SELECT * FROM tbl_affiliates WHERE phone = ?", [phone]);
    return rows[0];
  },

  async findById(id) {
    const [rows] = await db.query(
      "SELECT id, firstname, lastname, email, phone, password, is_verified, known_devices, otp FROM tbl_affiliates WHERE id = ?",
      [id]
    );
    return rows[0];
  },

  // ===================== CREATE =====================
  async create(data) {
    const [result] = await db.query(
      `INSERT INTO tbl_affiliates 
        (firstname, lastname, email, phone, password, otp, is_verified, known_devices, 
        affiliate_code, referral_link, coupon_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(data.firstname || ""),
        String(data.lastname || ""),
        String(data.email || ""),
        String(data.phone || ""),
        String(data.password || ""),
        String(data.otp || ""),
        Number(data.is_verified || 0),
        JSON.stringify(data.known_devices || []),
        String(data.affiliate_code || ""),
        String(data.referral_link || ""),
        String(data.coupon_code || ""),
      ]
    );

    return result.insertId;
  },

  // ===================== VERIFY =====================
  async verifyByEmail(email) {
    await db.query(
      "UPDATE tbl_affiliates SET is_verified = 1, otp = NULL, updated_at = NOW() WHERE email = ?",
      [email]
    );
  },

  // ===================== UPDATE OTP =====================
  async updateOTPByEmail(email, otp) {
    await db.query(
      "UPDATE tbl_affiliates SET otp = ?, updated_at = NOW() WHERE email = ?",
      [otp.toString(), email]
    );
  },

  // ===================== UPDATE PASSWORD =====================
  async updatePasswordByEmail(email, hashedPassword) {
    await db.query(
      "UPDATE tbl_affiliates SET password = ?, otp = NULL, updated_at = NOW() WHERE email = ?",
      [hashedPassword, email]
    );
  },

  // ===================== DEVICES =====================
  async getKnownDevices(email) {
    const [rows] = await db.query("SELECT known_devices FROM tbl_affiliates WHERE email = ?", [email]);
    return rows[0]?.known_devices ? JSON.parse(rows[0].known_devices) : [];
  },

  async updateKnownDevices(affiliateId, devicesJson) {
    await db.query("UPDATE tbl_affiliates SET known_devices = ?, updated_at = NOW() WHERE id = ?", [
      devicesJson,
      affiliateId,
    ]);
  },

  //==================== Update Profile ========================
  async updateProfile(id, firstname, lastname, phone) {
    const [result] = await db.query(
      `UPDATE tbl_affiliates 
      SET firstname = ?, lastname = ?, phone = ?, updated_at = NOW() 
      WHERE id = ?`,
      [firstname, lastname, phone, id]
    );
    return result.affectedRows > 0;
  },

  // ===================== GET REFERRAL LINK =====================
  async getReferralLink(id) {
    const [rows] = await db.query(
      `SELECT referral_link, affiliate_code, coupon_code 
      FROM tbl_affiliates 
      WHERE id = ?`,
      [id]
    );
    return rows[0] || null; 
  },

};
