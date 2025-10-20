import express from 'express';
import { protectRoute } from '../../middleware/authMiddleware.js';
import {
   updateAffiliateProfile,
   getReferralLink,
   getReferredUsers
} from '../../controllers/affiliate/profileController.js';

const router = express.Router();

router.put("/update-profile", protectRoute, updateAffiliateProfile);
router.get("/referral-link", protectRoute, getReferralLink);

router.get('/referred-users', protectRoute, getReferredUsers);


export default router;