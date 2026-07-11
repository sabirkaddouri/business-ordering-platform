const path = require('path');
const fs = require('fs');
const initSqlJs = require('c:/Users/asus/Desktop/projects/O souly shop 2/node_modules/sql.js');
const bcrypt = require('c:/Users/asus/Desktop/projects/O souly shop 2/node_modules/bcryptjs');

const DB_PATH = 'c:/Users/asus/Desktop/projects/O souly shop 2/db/store.db';

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_PATH)) {
    console.error('DB file not found');
    return;
  }
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);
  
  // 1. Fetch current admin details
  let res = db.exec('SELECT * FROM admin WHERE id = 1');
  console.log('Before update:', JSON.stringify(res[0].values, null, 2));
  
  const currentHash = res[0].values[0][2];
  
  // Verify bcrypt check works with 'admin123'
  const isMatch = bcrypt.compareSync('admin123', currentHash);
  console.log('Password "admin123" matches?', isMatch);
  
  // 2. Perform test update
  const newUsername = 'admin_test';
  const newPasswordHash = bcrypt.hashSync('newpassword123', 10);
  
  db.run('UPDATE admin SET username = ?, password = ? WHERE id = 1', [newUsername, newPasswordHash]);
  
  // 3. Save database
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('Database updated and saved successfully.');
  
  // 4. Verify updated admin details
  const updatedDb = new SQL.Database(fs.readFileSync(DB_PATH));
  res = updatedDb.exec('SELECT * FROM admin WHERE id = 1');
  console.log('After update:', JSON.stringify(res[0].values, null, 2));
  
  const updatedHash = res[0].values[0][2];
  console.log('Password "newpassword123" matches after update?', bcrypt.compareSync('newpassword123', updatedHash));
  
  // 5. Restore original admin details so we don't break login
  const originalHash = bcrypt.hashSync('admin123', 10);
  updatedDb.run('UPDATE admin SET username = ?, password = ? WHERE id = 1', ['admin', originalHash]);
  fs.writeFileSync(DB_PATH, Buffer.from(updatedDb.export()));
  console.log('Database restored back to original.');
}

run().catch(console.error);
