import mongoose from "mongoose";

const DeliveryHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User association is required"]
  },
  recipient: {
    type: String,
    required: [true, "Recipient details are required"],
    trim: true
  },
  medium: {
    type: String,
    enum: ["email", "whatsapp"],
    required: [true, "Delivery medium is required"]
  },
  photoIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Photo"
  }],
  count: {
    type: Number
  },
  format: {
    type: String,
    enum: ["links", "zip"]
  },
  zipUrl: {
    type: String
  },
  cloudinaryPublicId: {
    type: String
  },
  status: {
    type: String,
    enum: ["queued", "delivered", "failed"],
    default: "queued"
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index to retrieve user's delivery audit log chronologically
DeliveryHistorySchema.index({ userId: 1, createdAt: -1 });

const DeliveryHistory = mongoose.model("DeliveryHistory", DeliveryHistorySchema);
export default DeliveryHistory;
