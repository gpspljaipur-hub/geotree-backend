import mongoose from 'mongoose';

const RolePermissionSchema = new mongoose.Schema({
    role_name: {
        type: String,
        required: true,
        unique: true
    },
    display_name: {
        type: String,
        required: true
    },
    permissions: [{
        type: String
    }],
    theme_color: {
        type: String,
        default: '#808080'
    },
    icon: {
        type: String,
        default: 'Shield'
    },
    description: {
        type: String
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models['RolePermission'] || mongoose.model('RolePermission', RolePermissionSchema);
