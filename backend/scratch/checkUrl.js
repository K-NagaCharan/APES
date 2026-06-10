import axios from 'axios';

async function main() {
  const url = 'https://res.cloudinary.com/dxgl7wq2e/raw/upload/v1781110692/apes/deliveries/delivery-4bae7888-0ab7-46e2-8520-72436d514a44.zip';
  try {
    const res = await axios.get(url);
    console.log("Success! Status:", res.status);
  } catch (err) {
    console.error("Failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Headers:", err.response.headers);
      console.error("Data:", err.response.data.toString());
    }
  }
}

main();
