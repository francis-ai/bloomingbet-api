import bcrypt from "bcryptjs";
import { User } from "../../models/userAuthModel.js";
import sendEmail from "../../utils/sendEmail.js";
import { generateToken } from "../../utils/jwt.js";
import crypto from "crypto";

const deviceOTPs = {}; // temporary storage

// ===================== REGISTER =====================
export const register = async (req, res) => {
  try {
    const { fullname, email, phone, password, deviceId, coupon_code } = req.body;

    if (!fullname || !email || !phone || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (!deviceId)
      return res.status(400).json({ message: "Missing device identifier." });

    const existingEmail = await User.findByEmail(email);
    if (existingEmail)
      return res.status(400).json({ message: "Email already exists." });

    const hashed = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Use user-provided coupon_code if exists, else null
    const userCoupon = coupon_code && coupon_code.trim() !== "" ? coupon_code.trim() : null;

    // Create user with optional coupon_code
    const userId = await User.create({
      fullname,
      email,
      phone,
      coupon_code: userCoupon,
      password: hashed,
      otp,
      is_verified: 0,
    });

    // Store the registering device as trusted immediately
    const knownDevices = [deviceId];
    await User.updateKnownDevices(userId, JSON.stringify(knownDevices));

    // Send verification email
    await sendEmail(email, "Verify Your Account", `<h3>Your OTP is ${otp}</h3>`);

    res.status(201).json({
      success: true,
      message: "User registered successfully. OTP sent to your email.",
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== VERIFY OTP =====================
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required." });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (String(user.otp) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    await User.verifyByEmail(email);
    res.json({ success: true, message: "Account verified successfully." });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== RESEND OTP =====================
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await User.updateOTPByEmail(email, otp);

    await sendEmail(email, "Resend OTP", `<h3>Your new OTP is ${otp}</h3>`);
    res.json({ success: true, message: "A new OTP has been sent to your email." });
    console.log("Email received:", req.body);
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

    // ✅ Find user by email or phone
    let user;
    if (email) {
      user = await User.findByEmail(email);
    } else if (phone) {
      user = await User.findByPhone(phone);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // ✅ Check verification status
    if (!user.is_verified) {
      return res
        .status(401)
        .json({ message: "Please verify your account first." });
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // ✅ Ensure deviceId is present
    if (!deviceId) {
      return res.status(400).json({ message: "Missing device identifier." });
    }

    // ✅ Device recognition
    const knownDevices = JSON.parse(user.known_devices || "[]");

    if (!knownDevices.includes(deviceId)) {
      // Generate OTP for new device
      const otp = crypto.randomInt(100000, 999999).toString();
      deviceOTPs[user.email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

      // Send OTP to user’s email
      await sendEmail(
        user.email,
        "New Device Login Verification",
        `<h3>Your login OTP is ${otp}</h3><p>This OTP expires in 5 minutes.</p>`
      );

      return res.status(200).json({
        requireOTP: true,
        message: "New device detected. OTP sent to your email.",
      });
    }

    // ✅ Generate and send token
    const token = generateToken({ id: user.id, email: user.email });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("User Login Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

// ===================== VERIFY LOGIN OTP (new device) =====================
export const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp, deviceId } = req.body;
    if (!email || !otp || !deviceId)
      return res.status(400).json({ message: "Email, OTP, and deviceId are required." });

    const stored = deviceOTPs[email];
    if (!stored || stored.otp !== otp || Date.now() > stored.expires)
      return res.status(400).json({ message: "Invalid or expired OTP." });

    const user = await User.findByEmail(email);
    const knownDevices = JSON.parse(user.known_devices || "[]");
    if (!knownDevices.includes(deviceId)) knownDevices.push(deviceId);

    await User.updateKnownDevices(user.id, JSON.stringify(knownDevices));
    delete deviceOTPs[email];

    const token = generateToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "OTP verified. Login successful.",
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== FORGOT PASSWORD =====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = Math.floor(100000 + Math.random() * 900000);
    await User.updateOTPByEmail(email, otp);

    await sendEmail(email, "Password Reset OTP", `<h3>Your password reset OTP is ${otp}</h3>`);
    res.json({ message: "Password reset OTP sent to email." });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== RESET PASSWORD =====================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required." });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (String(user.otp) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePasswordByEmail(email, hashed);

    res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== CHANGE PASSWORD =====================
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res.status(400).json({ message: "Both old and new passwords are required." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePasswordByEmail(user.email, hashed);

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ===================== USER PROFILE =====================
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user)
      return res.status(404).json({ message: "User not found." });

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully.",
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
