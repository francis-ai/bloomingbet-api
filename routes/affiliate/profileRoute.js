import express from 'express';
import { protectRoute } from '../../middleware/authMiddleware.js';
import {
   updateAffiliateProfile,
   getReferralLink
} from '../../controllers/affiliate/profileController.js';

const router = express.Router();

router.put("/update-profile", protectRoute, updateAffiliateProfile);
router.get("/referral-link", protectRoute, getReferralLink);


export default router;