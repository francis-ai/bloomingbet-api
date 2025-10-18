import * as Withdrawal from '../../models/affiliate/withdrawal.js';

export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankAccount } = req.body;
    const affiliateId = req.user.id; // from authentication middleware

    // TODO: optionally check if affiliate has enough balance before allowing request

    const result = await Withdrawal.createWithdrawal({ affiliateId, amount, bankAccount });
    res.json({ success: true, message: 'Withdrawal request submitted', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listAffiliateWithdrawals = async (req, res) => {
  try {
    const affiliateId = req.user.id;
    const withdrawals = await Withdrawal.getWithdrawalsByAffiliate(affiliateId);
    res.json(withdrawals); // ✅ directly return array
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAffiliateSummary = async (req, res) => {
  try {
    const affiliateId = req.user.id;
    const summary = await Withdrawal.getAffiliateSummaryById(affiliateId);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.getAllWithdrawals();
    res.json({ success: true, data: withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    // Get withdrawal details
    const [withdrawal] = await Withdrawal.getAllWithdrawals().then(rows => rows.filter(w => w.id == id));
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });

    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    // Deduct affiliate balance
    await Withdrawal.deductAffiliateBalance(withdrawal.affiliate_id, withdrawal.amount);

    // Update status
    await Withdrawal.updateWithdrawalStatus(id, 'approved');

    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    await Withdrawal.updateWithdrawalStatus(id, 'rejected');
    res.json({ success: true, message: 'Withdrawal rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
