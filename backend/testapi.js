const http = require('http');

const url = 'http://localhost:3001/api/world-data/testgen123';

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.slice(0, 300));
  });
}).on('error', e => console.log('Error:', e.message));