import mongoose from "mongoose";

const CertificateTemplateSchema = new mongoose.Schema({
    name: {
        type: String, // Administrative name
        required: true,
        unique: true
    },
    type: {
        type: String, // Category: "Occasion", "Carbon Offset", etc.
        required: true
    },
    primaryColor: {
        type: String, // Hex Code
        required: true
    },
    previewImage: {
        type: String, // Background pattern identifier/URL
        required: false
    },
    title: {
        type: String,
        required: true
    },
    subTitle: {
        type: String,
        required: true
    },
    description: {
        type: String, // HTML/Text with curly braces
        required: true
    },
    tagline: {
        type: String,
        required: true
    },
    html_template: {
        type: String, // URL/Path to HTML template file
        required: true
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

export default mongoose.models['CertificateTemplate'] || mongoose.model('CertificateTemplate', CertificateTemplateSchema);
