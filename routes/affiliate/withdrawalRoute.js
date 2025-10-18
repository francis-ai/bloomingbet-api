import express from 'express';
import { protectRoute } from '../../middleware/authMiddleware.js';
import {
    requestWithdrawal,
    listAffiliateWithdrawals,
    getAffiliateSummary,
    listAllWithdrawals,
    approveWithdrawal,
    rejectWithdrawal
} from '../../controllers/affiliate/withdrawalController.js';

const router = express.Router();

// Affiliate routes
router.post('/request', protectRoute, requestWithdrawal);
router.get('/my-withdrawals', protectRoute, listAffiliateWithdrawals);
router.get('/balance-summary', protectRoute, getAffiliateSummary,
);

// Admin routes
router.get('/', protectRoute, listAllWithdrawals);
router.patch('/approve/:id', protectRoute, approveWithdrawal);
router.patch('/reject/:id', protectRoute, rejectWithdrawal);

export default router;
