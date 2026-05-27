import Order from '../models/order.model.js';
import { Parser } from 'json2csv';

export const exportOrders = async (req, res) => {
    try {
        const { status, type } = req.body;
        const query = {};
        if (status) query.order_status = status;
        if (type) query.type = type;

        const orders = await Order.find(query)
            .populate('user_id', 'name email')
            .populate('plantation_site_id', 'name')
            .lean();

        if (orders.length === 0) {
            return res.status(404).json({ message: "No data to export" });
        }

        const fields = [
            { label: 'Order ID', value: '_id' },
            { label: 'User Name', value: 'user_id.name' },
            { label: 'User Email', value: 'user_id.email' },
            { label: 'Type', value: 'type' },
            { label: 'Site', value: 'plantation_site_id.site_name' },
            { label: 'Trees', value: 'trees_count' },
            { label: 'Amount', value: 'amount' },
            { label: 'Payment Status', value: 'payment_status' },
            { label: 'Order Status', value: 'order_status' },
            { label: 'Date', value: 'created_at' }
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(orders);

        res.header('Content-Type', 'text/csv');
        res.attachment('orders.csv');
        return res.send(csv);

    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ message: "Server error" });
    }
};
