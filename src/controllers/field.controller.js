import Order from '../models/order.model.js';

// --- Get My Field Assignments (Page 14) ---
export const getMyAssignments = async (req, res) => {
    try {
        const fieldAdminId = req.user.adminId; // From Token

        const { status, page = 1, limit = 20 } = req.body;
        const query = { assigned_field_team: fieldAdminId };

        // Filter by order status if provided, else show active assignments
        if (status) {
            query.order_status = status;
        } else {
            // Default: Show pending/assigned tasks first
            // query.order_status = { $in: ['Assigned', 'Executed'] }; 
        }

        const orders = await Order.find(query)
            .populate('plantation_project_id', 'name location_id')
            .populate('location_id', 'name')
            .sort({ updated_at: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        res.json({
            data: orders,
            meta: { total, page, pages: Math.ceil(total / limit) }
        });

    } catch (err) {
        console.error('Field Assignments Error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Update Execution (Page 15) ---
export const updateExecution = async (req, res) => {
    try {
        const fieldAdminId = req.user.adminId;
        const { orderId } = req.body;
        const { remarks, completion_date } = req.body;

        const order = await Order.findOne({ _id: orderId, assigned_field_team: fieldAdminId });
        if (!order) {
            return res.status(404).json({ message: "Order not found or not assigned to you" });
        }

        if (req.file) {
            order.execution_image_url = `/uploads/field/${req.file.filename}`;
        }

        if (remarks) order.remarks = remarks;
        if (completion_date) order.execution_date = completion_date;
        else order.execution_date = new Date();

        order.order_status = 'Executed'; // Move to Verification stage

        await order.save();

        res.json({ message: "Execution details updated", order });

    } catch (err) {
        console.error('Execution Update Error:', err);
        res.status(500).json({ message: "Server error" });
    }
};
