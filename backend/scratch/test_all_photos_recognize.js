import axios from 'axios';
const urls = [
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780994444/apes/photos/csferaoodlqmujzx6ti4.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996806/apes/photos/s6ozsissvhpx0xuky1qp.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996807/apes/photos/it9r9ttnr9or2omdm4fk.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780996808/apes/photos/xpgmeahctkylue2pkrlq.jpg",
  "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781005581/apes/photos/dnmofxe11qsccmrktw6n.png"
];
for (const url of urls) {
  console.log(`\nTesting URL: ${url}`);
  try {
    const res = await axios.post('http://localhost:5001/recognize', { imageUrl: url }, { timeout: 60000 });
    console.log(`Success: detected ${res.data.faces ? res.data.faces.length : 0} faces.`);
  } catch (err) {
    console.log(`Error status: ${err.response ? err.response.status : 'None'}, msg: ${err.message}`);
    if (err.response && err.response.data) {
      console.log('Error Data:', err.response.data);
    }
  }
}
