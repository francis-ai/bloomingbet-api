import express from 'express';
import { protectRoute } from '../../middleware/authMiddleware.js';
import uploadAffiliateImage from "../../middleware/uploadAffiliateImage.js";
import {
   updateAffiliateProfile,
   getReferralLink,
   getReferredUsers,
   getDashboardStats,
} from '../../controllers/affiliate/profileController.js';

const router = express.Router();

router.put("/update-profile", protectRoute, uploadAffiliateImage.single("profile_img"), updateAffiliateProfile);
router.get("/referral-link", protectRoute, getReferralLink);

router.get('/referred-users', protectRoute, getReferredUsers);
router.get('/dashboard-stats', protectRoute, getDashboardStats);


export default router;