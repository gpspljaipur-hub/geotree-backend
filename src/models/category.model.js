import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Carbon', 'Plantation', 'Occasion', 'Sponsor', 'Gift'],
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  category_image: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

export default mongoose.models['Category'] || mongoose.model('Category', CategorySchema);


