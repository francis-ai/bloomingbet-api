import express from "express";
import { protectRoute } from "../../middleware/authMiddleware.js";
import {
  initializeDeposit,
  verifyPayment,
  getUserDeposits,
} from "../../controllers/user/depositController.js";

const router = express.Router();

router.post("/initialize", protectRoute, initializeDeposit);
router.post("/verify", protectRoute, verifyPayment);
router.get("/:user_id", protectRoute, getUserDeposits);

export default router;
