import axios from 'axios';
const urls = [
  "https://res.cloudinary.com/demo/image/upload/v1234/apes/photo.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780994444/apes/photos/csferaoodlqmujzx6ti4.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996806/apes/photos/s6ozsissvhpx0xuky1qp.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996807/apes/photos/it9r9ttnr9or2omdm4fk.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996808/apes/photos/xpgmeahctkylue2pkrlq.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781005581/apes/photos/dnmofxe11qsccmrktw6n.png"
];
for (const url of urls) {
  try {
    const res = await axios.get(url);
    console.log(`URL: ${url} -> Status: ${res.status}`);
  } catch (err) {
    console.log(`URL: ${url} -> Failed: ${err.message}`);
  }
}
