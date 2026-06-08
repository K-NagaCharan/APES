import mongoose from "mongoose";

const emailRegex = /^\S+@\S+\.\S+$/;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [emailRegex, "Please provide a valid email address"]
  },
  passwordHash: {
    type: String,
    required: [true, "Password hash is required"]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", UserSchema);
export default User;
