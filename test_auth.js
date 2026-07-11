const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    
    // Now try to update the profile
    const updateOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/update-profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    
    const updateReq = http.request(updateOptions, (updateRes) => {
      let updateData = '';
      updateRes.on('data', chunk => updateData += chunk);
      updateRes.on('end', () => {
        console.log('Update Response:', updateRes.statusCode, updateData);
      });
    });
    
    updateReq.write(JSON.stringify({
      currentPassword: 'admin',
      newPassword: 'newpassword123',
      newUsername: 'newwebsite'
    }));
    updateReq.end();
  });
});

req.write(JSON.stringify({ username: 'admin', password: 'admin' }));
req.end();
