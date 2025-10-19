import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Affiliate } from "../../models/affiliateAuthModel.js";
import sendEmail from "../../utils/sendEmail.js";
import { generateToken } from "../../utils/jwt.js";

const pendingAffiliates = {}; // temporary storage (keyed by email)
// ===================== REGISTER =====================
export const register = async (req, res) => {
  try {
    const { firstname, lastname, email, phone, password, deviceId } = req.body;

    if (!firstname || !lastname || !email || !phone || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (!deviceId)
      return res.status(400).json({ message: "Missing device identifier." });

    // Prevent duplicate in DB
    const existingEmail = await Affiliate.findByEmail(email);
    if (existingEmail)
      return res.status(400).json({ message: "Email already exists." });

    const existingPhone = await Affiliate.findByPhone(phone);
    if (existingPhone)
      return res.status(400).json({ message: "Phone number already exists." });

    // Prevent resending OTP unnecessarily
    if (pendingAffiliates[email])
      return res.status(400).json({ message: "OTP already sent. Please verify your email." });

    const hashed = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Generate affiliate codes
    const baseCode = firstname?.substring(0, 4)?.toUpperCase() || "AFF";
    const randomPart = crypto.randomInt(1000, 9999);
    const affiliate_code = `${baseCode}${randomPart}`;
    const referral_link = `https://bloomingbet.com/ref/${affiliate_code}`;
    const coupon_code = `BB${randomPart}`;

    // Temporarily store affiliate data in memory
    pendingAffiliates[email] = {
      firstname,
      lastname,
      email,
      phone,
      password: hashed,
      otp,
      known_devices: [deviceId],
      affiliate_code,
      referral_link,
      coupon_code,
    };

    // Automatically clear entry after 5 minutes
    setTimeout(() => {
      delete pendingAffiliates[email];
    }, 5 * 60 * 1000);

    // Send OTP email
    await sendEmail(email, "Verify Your Affiliate Account", `<h3>Your OTP is ${otp}</h3>`);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email for verification.",
    });
  } catch (err) {
    console.error("Affiliate Register Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== VERIFY AFFILIATE OTP =====================
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required." });

    const pending = pendingAffiliates[email];
    if (!pending)
      return res.status(404).json({ message: "No pending registration found for this email or OTP expired." });

    if (String(pending.otp) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    // ✅ Save verified affiliate to DB with all details
    const affiliateId = await Affiliate.create({
      firstname: pending.firstname,
      lastname: pending.lastname,
      email: pending.email,
      phone: pending.phone,
      password: pending.password,
      otp: null, // no need to store OTP anymore
      is_verified: 1,
      known_devices: pending.known_devices || [],
      affiliate_code: pending.affiliate_code,
      referral_link: pending.referral_link,
      coupon_code: pending.coupon_code,
    });

    // Remove from temporary memory
    delete pendingAffiliates[email];

    res.status(200).json({
      success: true,
      message: "Account verified successfully.",
      affiliateId,
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};


// ===================== RESEND AFFILIATE OTP =====================
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "Email is required." });

    const pending = pendingAffiliates[email];
    if (!pending)
      return res.status(404).json({ message: "No pending registration found. Please register again." });

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otp = newOtp;

    // Send new OTP email
    await sendEmail(email, "Your New OTP", `<h3>Your new OTP is ${newOtp}</h3>`);

    res.status(200).json({ success: true, message: "A new OTP has been sent to your email." });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== LOGIN =====================
export const login = async (req, res) => {
  try {
    const { email, phone, password, deviceId } = req.body;

    // ✅ Validate input
    if ((!email && !phone) || !password) {
      return res
        .status(400)
        .json({ message: "Email or phone and password are required." });
    }

    // ✅ Find affiliate by email or phone
    let affiliate;
    if (email) {
      affiliate = await Affiliate.findByEmail(email);
    } else if (phone) {
      affiliate = await Affiliate.findByPhone(phone);
    }

    if (!affiliate) {
      return res.status(404).json({ message: "Affiliate not found." });
    }

    // ✅ Check verification
    if (!affiliate.is_verified) {
      return res
        .status(401)
        .json({ message: "Please verify your account first." });
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, affiliate.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // ✅ Ensure deviceId is present
    if (!deviceId) {
      return res.status(400).json({ message: "Missing device identifier." });
    }

    // ✅ Device recognition
    const knownDevices = JSON.parse(affiliate.known_devices || "[]");

    if (!knownDevices.includes(deviceId)) {
      // Generate OTP for new device
      const otp = crypto.randomInt(100000, 999999).toString();
      deviceOTPs[affiliate.email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

      // Send OTP to email
      await sendEmail(
        affiliate.email,
        "New Device Login Verification",
        `<h3>Your login OTP is ${otp}</h3><p>This OTP expires in 5 minutes.</p>`
      );

      return res.status(200).json({
        requireOTP: true,
        message: "New device detected. OTP sent to your email.",
      });
    }

    // ✅ Generate and send token
    const token = generateToken({ id: affiliate.id, email: affiliate.email });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      affiliate: {
        id: affiliate.id,
        firstname: affiliate.firstname,
        lastname: affiliate.lastname,
        email: affiliate.email,
        phone: affiliate.phone,
      },
    });
  } catch (err) {
    console.error("Affiliate Login Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

// ===================== LOGIN OTP VERIFY (new device) =====================
export const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp, deviceId } = req.body;

    const affiliate = await Affiliate.findByEmail(email);
    if (!affiliate) return res.status(404).json({ message: "Affiliate not found." });
    if (affiliate.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

    // Add device to known list
    const knownDevices = await Affiliate.getKnownDevices(email);
    if (!knownDevices.includes(deviceId)) {
      knownDevices.push(deviceId);
      await Affiliate.updateKnownDevices(affiliate.id, JSON.stringify(knownDevices));
    }

    // Clear OTP
    await Affiliate.updateOTPByEmail(email, null);

    const token = generateToken({ id: affiliate.id, email: affiliate.email });
    res.status(200).json({ success: true, token, message: "Device verified. Login successful." });
  } catch (err) {
    console.error("Verify Login OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== FORGOT PASSWORD =====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const affiliate = await Affiliate.findByEmail(email);
    if (!affiliate)
      return res.status(404).json({ message: "Affiliate not found." });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Affiliate.updateOTPByEmail(email, otp);

    // Send OTP to email
    await sendEmail(
      email,
      "Password Reset OTP",
      `<h3>Your password reset OTP is <strong>${otp}</strong></h3>`
    );

    res.json({ success: true, message: "Password reset OTP sent to email." });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== VERIFY FORGOT PASSWORD OTP =====================
export const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res
        .status(400)
        .json({ message: "Email and OTP are required." });

    const affiliate = await Affiliate.findByEmail(email);
    if (!affiliate)
      return res.status(404).json({ message: "Affiliate not found." });

    if (String(affiliate.otp) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    res.json({ success: true, message: "OTP verified successfully." });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== RESEND FORGOT PASSWORD OTP =====================
export const resendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const affiliate = await Affiliate.findByEmail(email);
    if (!affiliate)
      return res.status(404).json({ message: "Affiliate not found." });

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Affiliate.updateOTPByEmail(email, otp);

    // Send new OTP
    await sendEmail(
      email,
      "Resend Password Reset OTP",
      `<h3>Your new OTP is <strong>${otp}</strong></h3>`
    );

    res.json({ success: true, message: "New OTP sent to your email." });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== RESET PASSWORD =====================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res
        .status(400)
        .json({ message: "Email, OTP, and new password are required." });

    const affiliate = await Affiliate.findByEmail(email);
    if (!affiliate)
      return res.status(404).json({ message: "Affiliate not found." });

    if (String(affiliate.otp) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await Affiliate.updatePasswordByEmail(email, hashed);

    res.json({ success: true, message: "Password reset successful." });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== CHANGE PASSWORD =====================
export const changePassword = async (req, res) => {
  try {
    const affiliateId = req.user.id; // Authenticated affiliate ID
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required." });

    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate)
      return res.status(404).json({ message: "Affiliate not found." });

    const isMatch = await bcrypt.compare(oldPassword, affiliate.password);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await Affiliate.updatePasswordByEmail(affiliate.email, hashed);

    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== PROFILE =====================
export const profile = async (req, res) => {
  try {
    const affiliateId = req.user.id;
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) return res.status(404).json({ message: "Affiliate not found." });

    const { password, otp, ...safeData } = affiliate;
    res.status(200).json({ success: true, data: safeData });
  } catch (err) {
    console.error("Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
