import Order from '../models/order.model.js';

// --- Get Pending Verifications (Page 16) ---
export const getPendingVerifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.body;

        // Fetch orders that are 'Executed' and waiting for verification
        const query = { order_status: 'Executed' };

        const orders = await Order.find(query)
            .populate('assigned_field_team', 'name email')
            .populate('plantation_site_id', 'name')
            .sort({ updated_at: 1 }) // Oldest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        res.json({
            data: orders,
            meta: { total, page, pages: Math.ceil(total / limit) }
        });

    } catch (err) {
        console.error('Verification List Error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Verify Order (Approve/Reject) ---
export const verifyOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const { status, remarks } = req.body; // status: 'Approved' (-> Completed) or 'Rejected'

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Use 'Approved' or 'Rejected'" });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (status === 'Approved') {
            order.order_status = 'Completed';
            // Logic to Trigger Certificate Generation can go here
        } else {
            order.order_status = 'Assigned'; // Send back to field team?
            // Or 'Pending' if re-assignment needed. 
            // "Page 16: Rejected" -> usually means redo. Sticking to 'Assigned' implies field team checks again.
        }

        if (remarks) {
            order.remarks = (order.remarks ? order.remarks + " | Verification: " : "Verification: ") + remarks;
        }

        await order.save();

        res.json({ message: `Order ${status}`, order });

    } catch (err) {
        console.error('Verification Action Error:', err);
        res.status(500).json({ message: "Server error" });
    }
};
