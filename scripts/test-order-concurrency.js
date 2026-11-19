/**
 * scripts/test-order-concurrency.js
 * Verifies atomic stock deduction under high-concurrency order placement.
 *
 * SAFETY RULES:
 * 1. REFUSES to run unless DATABASE_URL points strictly to localhost or 127.0.0.1.
 */

require('dotenv').config();
const { Pool } = require('pg');
const assert = require('assert');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

// 1. Safety check: URL must strictly point to localhost or 127.0.0.1
try {
  const parsed = new URL(dbUrl);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.error('❌ SAFETY REFUSAL: DATABASE_URL must point to localhost or 127.0.0.1 to avoid touching remote databases.');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const port = process.env.PORT || 5000;
const serverUrl = `http://localhost:${port}`;

async function runTest() {
  console.log(`🔒 Starting concurrency order test against ${serverUrl}...`);

  // Verify server is reachable
  try {
    const ping = await fetch(`${serverUrl}/api/products`);
    if (!ping.ok) {
      throw new Error(`Server returned status ${ping.status}`);
    }
  } catch (err) {
    console.error(`❌ ERROR: Local server is not reachable at ${serverUrl}. Please ensure server is running.`);
    console.error(err.message);
    process.exit(1);
  }

  const client = await pool.connect();
  let testProductId = null;
  const createdOrderIds = [];

  try {
    // 1. Ensure category exists for foreign key
    let catRes = await client.query('SELECT id FROM categories LIMIT 1');
    let categoryId;
    if (catRes.rows.length === 0) {
      const newCat = await client.query("INSERT INTO categories (name, slug) VALUES ('Test Category', 'test-category') RETURNING id");
      categoryId = newCat.rows[0].id;
    } else {
      categoryId = catRes.rows[0].id;
    }

    // 2. Create tracked product with stock = 2
    const prodRes = await client.query(`
      INSERT INTO products (name, description, price, category_id, stock, trackStock, available)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['Concurrency Test Item', 'Testing atomic stock checks', 50.0, categoryId, 2, 1, 1]);

    testProductId = prodRes.rows[0].id;
    console.log(`📦 Created test product (ID: ${testProductId}) with stock = 2 (trackStock = 1).`);

    // 3. Fire 6 order requests at once
    console.log('🚀 Firing 6 concurrent order requests (qty: 1 each)...');
    const orderPayload = {
      customer_name: 'Concurrency Tester',
      customer_phone: '0612345678',
      customer_address: '123 Concurrency Blvd',
      items: [
        { product_id: testProductId, quantity: 1 }
      ]
    };

    const requests = Array.from({ length: 6 }).map((_, idx) =>
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.0.0.${idx + 1}`
        },
        body: JSON.stringify(orderPayload)
      }).then(async res => {
        const body = await res.json().catch(() => ({}));
        return { index: idx + 1, status: res.status, body };
      })
    );

    const responses = await Promise.all(requests);

    const successes = responses.filter(r => r.status === 201);
    const conflicts = responses.filter(r => r.status === 409);
    const others = responses.filter(r => r.status !== 201 && r.status !== 409);

    console.log(`📊 Results: ${successes.length} succeeded (201), ${conflicts.length} conflicted (409), ${others.length} other.`);

    // Record created order ids for cleanup
    successes.forEach(s => {
      if (s.body && s.body.id) createdOrderIds.push(s.body.id);
    });

    // 4. Check final stock in DB
    const finalProdRes = await client.query('SELECT stock FROM products WHERE id = $1', [testProductId]);
    const finalStock = finalProdRes.rows[0].stock;
    console.log(`📦 Final product stock in DB: ${finalStock}`);

    // Assertions
    assert.strictEqual(successes.length, 2, `Expected exactly 2 orders to succeed, but got ${successes.length}`);
    assert.strictEqual(conflicts.length, 4, `Expected exactly 4 orders to get 409 conflict, but got ${conflicts.length}`);
    assert.strictEqual(others.length, 0, `Expected 0 unexpected status codes, but got ${others.length}`);
    assert.strictEqual(finalStock, 0, `Expected final stock to be exactly 0, but got ${finalStock}`);

    // Verify 409 payload structure
    for (const conf of conflicts) {
      assert.strictEqual(conf.body.productId, testProductId, 'Conflict response should have productId');
      assert.strictEqual(conf.body.available, 0, 'Conflict response available should be 0');
      assert.ok(typeof conf.body.error === 'string' && conf.body.error.includes('Not enough stock'), 'Conflict response should have descriptive error');
    }

    console.log('✅ ALL CONCURRENCY ASSERTIONS PASSED!');
  } finally {
    // 5. Cleanup
    console.log('🧹 Cleaning up test data...');
    if (createdOrderIds.length > 0) {
      await client.query('DELETE FROM notifications WHERE orderid = ANY($1)', [createdOrderIds]).catch(() => {});
      await client.query('DELETE FROM order_items WHERE order_id = ANY($1)', [createdOrderIds]).catch(() => {});
      await client.query('DELETE FROM orders WHERE id = ANY($1)', [createdOrderIds]).catch(() => {});
    }
    if (testProductId) {
      await client.query('DELETE FROM products WHERE id = $1', [testProductId]).catch(() => {});
    }
    client.release();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
