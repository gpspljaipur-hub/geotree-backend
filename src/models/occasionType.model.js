import mongoose from "mongoose";

const OccasionTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  occasion_image: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    default: true,
    index: true
  },
  form_fields: [{
    label: {
      type: String,
      required: true
    },
    key: {
      type: String, // The JSON key for the app to send back
      required: true
    },
    field_type: {
      type: String,
      enum: ['text', 'number', 'textarea', 'date', 'email', 'dropdown'],
      default: 'text'
    },
    is_required: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ""
    },
    options: [String] // Only for dropdowns
  }],

  /**
   * Permanent field overrides — admin controls is_required per key.
   * Keys: name | date | state_id | project_id
   * e.g. { "state_id": true, "project_id": false }
   */
  permanent_field_overrides: {
    type: Map,
    of: Boolean,
    default: {}
  },

  // Auto-generated HTML form URL for the app frontend to load in a WebView/iframe
  form_html_url: {
    type: String,
    default: null
  }
}, { timestamps: true });

export default mongoose.models['OccasionType'] || mongoose.model('OccasionType', OccasionTypeSchema);

