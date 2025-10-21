import express from 'express';
import {
   handleReferralVisit
} from '../../controllers/affiliate/profileController.js';

const router = express.Router();

router.get("/ref/:referralCode", handleReferralVisit);


export default router;