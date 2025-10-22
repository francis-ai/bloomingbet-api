import axios from "axios";
import Deposit from "../../models/user/deposit.js";
import db from "../../config/db.js";

// ================== 1️⃣ Initialize Deposit ==================
export const initializeDeposit = async (req, res) => {
  try {
    const { amount, user_id } = req.body;

    if (!amount || !user_id)
      return res.status(400).json({ message: "Amount and user_id are required" });

    // ✅ Get user email
    const [userRows] = await db.query("SELECT email FROM tbl_users WHERE id = ?", [user_id]);
    if (!userRows.length)
      return res.status(404).json({ message: "User not found" });

    const email = userRows[0].email;
    const reference = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // ✅ Save as pending
    await Deposit.addDeposit(user_id, amount, reference, "pending");

    // ✅ Initialize Paystack transaction
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        reference,
        callback_url: `${process.env.FRONTEND_URL}/dashboard/verify-payment?user_id=${user_id}&reference=${reference}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({
      status: "success",
      data: response.data.data,
    });
  } catch (error) {
    console.error("❌ Error initializing deposit:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Failed to initialize deposit",
      error: error.response?.data || error.message,
    });
  }
};

// ================== 2️⃣ Verify Payment ==================
export const verifyPayment = async (req, res) => {
  try {
    const { reference, user_id } = req.body;

    if (!reference || !user_id) {
      return res.status(400).json({ message: "Reference and user_id are required" });
    }

    // ✅ Verify with Paystack
    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verification = verifyResponse.data.data;

    if (verification.status !== "success") {
      // mark existing deposit as failed if exists
      await Deposit.updateStatus(reference, "failed");
      return res.status(400).json({ status: "failed" });
    }

    const amount = verification.amount / 100;

    // 💾 Credit deposit, user balance, and affiliate commission in a single transaction
    const processResult = await Deposit.processDepositWithCommission(user_id, reference, amount);

    if (processResult.alreadyProcessed) {
      return res.status(200).json({
        status: "success",
        message: "Payment already processed",
        data: { amount },
      });
    }

    return res.status(200).json({
      status: "success",
      data: { amount },
    });

  } catch (error) {
    console.error("Error verifying payment:", error.response?.data || error.message);
    return res.status(500).json({
      status: "error",
      message: "Error verifying payment",
    });
  }
};

// ================== 3️⃣ Get All Deposits for a User ==================
export const getUserDeposits = async (req, res) => {
  try {
    const { user_id } = req.params;
    const deposits = await Deposit.getByUser(user_id);

    return res.status(200).json({
      status: "success",
      count: deposits.length,
      data: deposits,
    });
  } catch (error) {
    console.error("❌ Error fetching deposits:", error.message);
    return res.status(500).json({
      message: "Failed to fetch deposits",
      error: error.message,
    });
  }
};
