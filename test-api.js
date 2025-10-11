const axios = require('axios');

// Paste your generated license key here
const LICENSE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55IjoiVHJpYWwgVXNlciIsImVtYWlsIjoidHJpYWxAY2Etb2ZmaWNlLmNvbSIsImV4cGlyeSI6IjIwMjUtMTAtMTBUMTU6MDg6MDcuOTcyWiIsInVzZXJzIjozLCJpc3N1ZWQiOiIyMDI1LTEwLTA5VDE1OjA4OjA3Ljk3M1oiLCJ0eXBlIjoiY29tbWVyY2lhbCIsImlhdCI6MTc2MDAyMjQ4N30.j_Ed2-flkc2T6xlEnCbC6fp7zFZZdk9oG4MPx5ufYWA';

axios.post('http://localhost:5000/api/license/activate', {
  licenseKey: LICENSE_KEY,
  companyName: 'Test Company',
  email: 'test@example.com'
})
.then(res => {
  console.log('✓ SUCCESS:');
  console.log(JSON.stringify(res.data, null, 2));
})
.catch(err => {
  console.error('✗ ERROR:');
  console.error(err.response?.data || err.message);
});