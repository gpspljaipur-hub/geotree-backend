import mongoose from "mongoose";

const TranslationSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
    },
    to: {
        type: String,
        required: true,
    },
    translatedText: {
        type: String,
        required: true,
    }
}, { timestamps: true });

// Index for fast lookups
TranslationSchema.index({ text: 1, to: 1 }, { unique: true });

export default mongoose.models['Translation'] || mongoose.model('Translation', TranslationSchema);
