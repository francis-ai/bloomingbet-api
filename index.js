import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import session from "express-session";

import userAuthRoutes from "./routes/auth/userAuthRoute.js";
import affiliateAuthRoutes from "./routes/auth/affiliateAuthRoute.js";

import affiliateWithdrawal from "./routes/affiliate/withdrawalRoute.js";
import affiliateProfile from "./routes/affiliate/profileRoute.js";

dotenv.config();
const app = express();

// =================== MIDDLEWARE ===================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// =================== CORS ===================
app.use(
  cors({
    origin: [
      "http://localhost:3000", // development frontend
      "https://yourfrontenddomain.com", // production
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // allow sending cookies across origins
  })
);

// =================== SESSION CONFIG ===================
app.set("trust proxy", 1); // if you're behind HTTPS/reverse proxy
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // block JS access to cookies
      secure: process.env.NODE_ENV === "production", // true only over HTTPS
      sameSite: "None", // required for cross-domain cookies
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// =================== ROUTES ===================
app.use("/api/auth/user", userAuthRoutes);
app.use("/api/auth/affiliates", affiliateAuthRoutes);
app.use("/api/affiliate/withdrawal", affiliateWithdrawal);
app.use("/api/affiliate/profile", affiliateProfile);

// =================== HEALTH CHECK ===================
app.get("/", (req, res) => {
  res.send("🚀 Auth Backend is running with CORS & Cookies configured!");
});

// =================== LOGOUT ===================
app.post("/api/logout", (req, res) => {
  res.clearCookie("connect.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  });
  req.session?.destroy(() => {});
  res.status(200).json({ message: "Logged out successfully" });
});

// =================== SERVER ===================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🌐 NODE_ENV:", process.env.NODE_ENV);
  console.log("✅ CORS and cookies configured correctly.");
});
