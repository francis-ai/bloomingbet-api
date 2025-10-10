import express from "express";
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  verifyLoginOTP,
  forgotPassword,
  resetPassword,
  changePassword,
  getUserProfile,
} from "../../controllers/auth/userAuthController.js";
import { protectRoute } from "../../middleware/authMiddleware.js";

const router = express.Router();

// ====================== AUTH ROUTES ======================

// Register & Verify
router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

// Login (with new device OTP)
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOTP);

// Password Management
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", protectRoute, changePassword);

// Profile
router.get("/profile", protectRoute, getUserProfile);

export default router;
