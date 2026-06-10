import { generateToken } from "../src/utils/jwt.js";
import axios from "axios";

const userId = "6a268c108425277e3ddee488";
const username = "charan";

const token = generateToken(userId, username);
const photoId = "6a268c108425277e3ddee489";

console.log("Waiting 15 seconds before triggering socket events...");
setTimeout(() => {
  console.log("Triggering...");
  axios.post("http://localhost:5000/api/v1/photos/test-progress-trigger", {
    photoId
  }, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }).then(res => {
    console.log("Trigger response:", res.data);
    process.exit(0);
  }).catch(err => {
    console.error("Trigger failed:", err.response?.data || err.message);
    process.exit(1);
  });
}, 6000);

