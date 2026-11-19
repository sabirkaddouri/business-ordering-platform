/**
 * scripts/reset-admin-password.js
 * CLI command to securely reset an admin user's password.
 *
 * Supports:
 * - Interactive mode: terminal prompts with hidden password input and confirmation.
 * - Non-interactive mode: using ADMIN_USERNAME and NEW_ADMIN_PASSWORD environment variables (e.g. on Railway).
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { Writable } = require('stream');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const WEAK_PASSWORDS = [
  'admin', 'admin123', 'admin1234', 'password', 'password123', 'password1234',
  '123456', '12345678', '123456789012', 'admin@123', 'root', 'changeme',
  'secret', 'qwertyuiop12', 'administrator'
];

function validatePassword(pwd) {
  if (!pwd || pwd.length < 12) {
    return 'Password must be at least 12 characters long.';
  }
  const lower = pwd.toLowerCase();
  for (const weak of WEAK_PASSWORDS) {
    if (lower === weak || lower.includes(weak)) {
      return `Password is too weak (contains obvious word or sequence "${weak}").`;
    }
  }
  return null;
}

function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(query) {
  return new Promise(resolve => {
    let muted = false;
    const mutableStdout = new Writable({
      write: function (chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    process.stdout.write(query);
    muted = true;

    rl.question('', answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const pool = new Pool({ connectionString: dbUrl });
  let client;

  try {
    client = await pool.connect();

    // Query existing admin accounts
    const adminsRes = await client.query('SELECT id, username FROM admin ORDER BY id ASC');
    if (adminsRes.rows.length === 0) {
      console.error('❌ FAILURE: No admin accounts found in the database.');
      process.exit(1);
    }

    const admins = adminsRes.rows;

    // Check if running in non-interactive mode
    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.NEW_ADMIN_PASSWORD;

    if (envPassword) {
      // Non-interactive mode
      console.log('🤖 Running in non-interactive mode...');
      let targetAdmin = null;

      if (envUsername) {
        targetAdmin = admins.find(a => a.username.toLowerCase() === envUsername.toLowerCase().trim());
        if (!targetAdmin) {
          console.error(`❌ FAILURE: Admin username "${envUsername}" not found.`);
          process.exit(1);
        }
      } else {
        if (admins.length === 1) {
          targetAdmin = admins[0];
        } else {
          console.error('❌ FAILURE: Multiple admins found. ADMIN_USERNAME must be specified in non-interactive mode.');
          process.exit(1);
        }
      }

      const valErr = validatePassword(envPassword);
      if (valErr) {
        console.error(`❌ FAILURE: ${valErr}`);
        process.exit(1);
      }

      const hash = await bcrypt.hash(envPassword, 12);
      await client.query('UPDATE admin SET password = $1 WHERE id = $2', [hash, targetAdmin.id]);

      console.log(`✅ SUCCESS: Admin password successfully reset for user "${targetAdmin.username}".`);
      return;
    }

    // Interactive mode
    console.log('🔐 Reset Admin Password');
    console.log('------------------------');
    console.log('Found admin accounts:');
    admins.forEach((a, idx) => {
      console.log(`  [${idx + 1}] ${a.username}`);
    });

    let targetAdmin = null;
    if (admins.length === 1) {
      targetAdmin = admins[0];
      const confirmUser = await ask(`Reset password for "${targetAdmin.username}"? (yes/no): `);
      if (confirmUser.toLowerCase() !== 'yes' && confirmUser.toLowerCase() !== 'y') {
        console.log('Operation cancelled.');
        return;
      }
    } else {
      const choice = await ask(`Select admin account (1-${admins.length}) or type username: `);
      const num = parseInt(choice, 10);
      if (!isNaN(num) && num >= 1 && num <= admins.length) {
        targetAdmin = admins[num - 1];
      } else {
        targetAdmin = admins.find(a => a.username.toLowerCase() === choice.toLowerCase());
      }

      if (!targetAdmin) {
        console.error('❌ FAILURE: Invalid selection.');
        process.exit(1);
      }
    }

    // Prompt for password twice with hidden input
    const pwd1 = await askHidden('Enter new password (at least 12 characters): ');
    const valErr = validatePassword(pwd1);
    if (valErr) {
      console.error(`❌ FAILURE: ${valErr}`);
      process.exit(1);
    }

    const pwd2 = await askHidden('Confirm new password: ');
    if (pwd1 !== pwd2) {
      console.error('❌ FAILURE: Passwords do not match.');
      process.exit(1);
    }

    const confirmSure = await ask(`Are you sure you want to reset the password for "${targetAdmin.username}"? (yes/no): `);
    if (confirmSure.toLowerCase() !== 'yes' && confirmSure.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      return;
    }

    const hash = await bcrypt.hash(pwd1, 12);
    await client.query('UPDATE admin SET password = $1 WHERE id = $2', [hash, targetAdmin.id]);

    console.log(`✅ SUCCESS: Admin password successfully reset for user "${targetAdmin.username}".`);
  } catch (err) {
    console.error('❌ FAILURE:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
