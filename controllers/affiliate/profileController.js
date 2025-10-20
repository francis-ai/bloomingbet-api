import { Affiliate } from "../../models/affiliateAuthModel.js";
import { Referral }  from "../../models/affiliate/referral.js";

// ===================== UPDATE PROFILE =====================
export const updateAffiliateProfile = async (req, res) => {
  try {
    const affiliateId = req.user.id;
    const { firstname, lastname, phone } = req.body;
    const profile_img = req.file ? req.file.filename : null;

    if (!firstname || !lastname || !phone)
      return res.status(400).json({ message: "All fields are required." });

    const updated = await Affiliate.updateProfile(affiliateId, firstname, lastname, phone, profile_img);

    if (!updated)
      return res.status(404).json({ message: "Affiliate not found or not updated." });

    res.status(200).json({ success: true, message: "Profile updated successfully." });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== GET REFERRAL LINK =====================
export const getReferralLink = async (req, res) => {
  try {
    const affiliateId = req.user.id;

    // Get data from model
    const referralData = await Affiliate.getReferralLink(affiliateId);

    if (!referralData) {
      return res.status(404).json({ message: "Referral link not found." });
    }

    // ✅ Use referralData directly instead of rows[0]
    res.status(200).json({
      success: true,
      data: {
        referral_link: referralData.referral_link,
        affiliate_code: referralData.affiliate_code,
        coupon_code: referralData.coupon_code,
      },
    });
  } catch (err) {
    console.error("Get Referral Link Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};


// ===================== GET REFERRED USERS =====================
export const getReferredUsers = async (req, res) => {
  try {
    const affiliateId = req.user.id; // assuming authentication middleware sets this

    const referredUsers = await Referral.getReferredUsers(affiliateId);

    res.status(200).json({
      success: true,
      count: referredUsers.length,
      data: referredUsers,
    });
  } catch (err) {
    console.error("Get Referred Users Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

