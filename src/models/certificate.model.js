import mongoose from "mongoose";

const CertificateSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  certificate_id: {
    type: String,
    unique: true
  },
  qr_code: String,
  plantation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plantation",
    unique: true
  },
  type: {
    type: String,
    default: "Plantation"
  },
  date: Date
}, { timestamps: true });

export default mongoose.models['Certificate'] || mongoose.model('Certificate', CertificateSchema);


