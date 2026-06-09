import axios from 'axios';
const url = 'https://res.cloudinary.com/dxgl7wq2e/image/upload/v1780994444/apes/photos/csferaoodlqmujzx6ti4.jpg';
axios.post('http://localhost:5001/recognize', { imageUrl: url })
  .then(r => console.log('Success:', JSON.stringify(r.data, null, 2)))
  .catch(e => console.log('Error:', e.response ? e.response.data : e.message));
