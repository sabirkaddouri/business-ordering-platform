/**
 * scripts/test-order-rules.js
 * Verifies store settings and promo rules on order creation.
 *
 * SAFETY RULES:
 * 1. REFUSES to run unless DATABASE_URL points strictly to localhost or 127.0.0.1.
 * 2. Restores settings and cleans up test data in finally block.
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const assert = require('assert');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

// Safety check: URL must strictly point to localhost or 127.0.0.1
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

let ipCounter = 1;
function getNextIp() {
  ipCounter++;
  return `10.42.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

async function postOrder(payload) {
  const res = await fetch(`${serverUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': getNextIp()
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function runTests() {
  console.log(`🔒 Starting order rules regression tests against ${serverUrl}...`);

  // Verify server is reachable
  try {
    const ping = await fetch(`${serverUrl}/api/products`);
    if (!ping.ok) throw new Error(`Server returned status ${ping.status}`);
  } catch (err) {
    console.error(`❌ ERROR: Local server is not reachable at ${serverUrl}. Ensure the server is running.`);
    process.exit(1);
  }

  const client = await pool.connect();

  let origSettings = null;
  const testProductIds = [];
  const testPromoIds = [];
  const testOrderIds = [];

  try {
    // 0. Backup original settings row
    const settingsRes = await client.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (settingsRes.rows.length === 0) {
      // Seed default settings row if none exists
      await client.query(`
        INSERT INTO settings (siteName, storeOpen, minOrderAmount, deliveryFee, freeDeliveryThreshold, taxEnabled, taxRate)
        VALUES ('Test Shop', 1, 0, 0, null, 0, 0)
      `);
      const s = await client.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
      origSettings = s.rows[0];
    } else {
      origSettings = settingsRes.rows[0];
    }

    // Helper: update settings
    async function updateSettings(fields) {
      const keys = Object.keys(fields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const values = keys.map(k => fields[k]);
      await client.query(`UPDATE settings SET ${setClauses} WHERE id = ${origSettings.id}`, values);
    }

    // Ensure category exists for test products
    let catRes = await client.query('SELECT id FROM categories LIMIT 1');
    let categoryId;
    if (catRes.rows.length === 0) {
      const newCat = await client.query("INSERT INTO categories (name, slug) VALUES ('Rules Test Category', 'rules-test-cat') RETURNING id");
      categoryId = newCat.rows[0].id;
    } else {
      categoryId = catRes.rows[0].id;
    }

    // Create a 50 MAD test product (stock = 100, trackStock = 0)
    const p50Res = await client.query(`
      INSERT INTO products (name, description, price, category_id, stock, trackStock, available)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['Rules Item 50', 'Test product 50 MAD', 50.0, categoryId, 100, 0, 1]);
    const p50Id = p50Res.rows[0].id;
    testProductIds.push(p50Id);

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 1: storeOpen = 0 -> 400 and no order saved
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 1: storeOpen = 0 ---');
    await updateSettings({
      storeopen: 0,
      storeclosedmessage: 'Boutique fermée pour inventaire',
      minorderamount: 0,
      deliveryfee: 0,
      taxenabled: 0
    });

    const countBefore1 = parseInt((await client.query('SELECT COUNT(*) as count FROM orders')).rows[0].count);
    const res1 = await postOrder({
      customer_name: 'Test Closed',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 1 }]
    });

    assert.strictEqual(res1.status, 400, `Expected 400 when store is closed, got ${res1.status}`);
    assert.strictEqual(res1.body.error, 'Boutique fermée pour inventaire');
    const countAfter1 = parseInt((await client.query('SELECT COUNT(*) as count FROM orders')).rows[0].count);
    assert.strictEqual(countAfter1, countBefore1, 'No order should be saved when store is closed');
    console.log('✓ storeOpen = 0 rejected with 400 and custom closed message, 0 orders saved.');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 2: minOrderAmount = 500, order of 50 -> 400; order of 600 -> 201
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 2: minOrderAmount = 500 ---');
    await updateSettings({
      storeopen: 1,
      minorderamount: 500,
      deliveryfee: 0,
      taxenabled: 0
    });

    // Subtotal 50 (1 x 50) < 500 -> 400
    const res2a = await postOrder({
      customer_name: 'Test Min Too Low',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 1 }]
    });
    assert.strictEqual(res2a.status, 400, `Expected 400 when subtotal < minOrderAmount, got ${res2a.status}`);
    assert.strictEqual(res2a.body.error, 'Minimum order amount is 500 MAD.');

    // Subtotal 600 (12 x 50) >= 500 -> 201
    const res2b = await postOrder({
      customer_name: 'Test Min Met',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 12 }]
    });
    assert.strictEqual(res2b.status, 201, `Expected 201 when subtotal >= minOrderAmount, got ${res2b.status}`);
    if (res2b.body.id) testOrderIds.push(res2b.body.id);
    assert.strictEqual(res2b.body.total, 600);
    console.log('✓ minOrderAmount = 500 rejected order of 50 (400), accepted order of 600 (201).');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 3: deliveryFee = 30 -> total = subtotal + 30
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 3: deliveryFee = 30 ---');
    await updateSettings({
      storeopen: 1,
      minorderamount: 0,
      deliveryfee: 30,
      freedeliverythreshold: null,
      taxenabled: 0
    });

    const res3 = await postOrder({
      customer_name: 'Test Delivery Fee',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 1 }] // subtotal 50
    });
    assert.strictEqual(res3.status, 201);
    if (res3.body.id) testOrderIds.push(res3.body.id);
    assert.strictEqual(res3.body.total, 80, `Expected total = 50 + 30 = 80, got ${res3.body.total}`);
    console.log('✓ deliveryFee = 30 added to subtotal (50 + 30 = 80).');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 4: freeDeliveryThreshold = 100 with a 150 subtotal -> fee 0
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 4: freeDeliveryThreshold = 100 with subtotal 150 ---');
    await updateSettings({
      storeopen: 1,
      minorderamount: 0,
      deliveryfee: 30,
      freedeliverythreshold: 100,
      taxenabled: 0
    });

    const res4 = await postOrder({
      customer_name: 'Test Free Delivery',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 3 }] // subtotal 150 >= 100 threshold
    });
    assert.strictEqual(res4.status, 201);
    if (res4.body.id) testOrderIds.push(res4.body.id);
    assert.strictEqual(res4.body.total, 150, `Expected free delivery total = 150, got ${res4.body.total}`);
    console.log('✓ freeDeliveryThreshold = 100 applied: fee is 0, total = 150.');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 5: taxEnabled = 1, taxRate = 20 -> total includes 20%
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 5: taxEnabled = 1, taxRate = 20 ---');
    await updateSettings({
      storeopen: 1,
      minorderamount: 0,
      deliveryfee: 0,
      freedeliverythreshold: null,
      taxenabled: 1,
      taxrate: 20
    });

    const res5 = await postOrder({
      customer_name: 'Test Tax',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      items: [{ product_id: p50Id, quantity: 2 }] // subtotal 100
    });
    assert.strictEqual(res5.status, 201);
    if (res5.body.id) testOrderIds.push(res5.body.id);
    // 100 + 20% = 120
    assert.strictEqual(res5.body.total, 120, `Expected total = 100 + 20% = 120, got ${res5.body.total}`);
    console.log('✓ taxEnabled = 1, taxRate = 20 correctly calculated (100 + 20 = 120).');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 6: promo percentage 10% valid -> discount applied and usageCount + 1
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 6: Valid promo percentage 10% ---');
    await updateSettings({
      storeopen: 1,
      minorderamount: 0,
      deliveryfee: 0,
      freedeliverythreshold: null,
      taxenabled: 0
    });

    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
    const promoRes1 = await client.query(`
      INSERT INTO promotions (code, type, value, minimumOrder, expiryDate, active, usageCount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['PROMO10', 'percentage', 10, 0, futureDate, 1, 0]);
    const promo1Id = promoRes1.rows[0].id;
    testPromoIds.push(promo1Id);

    const res6 = await postOrder({
      customer_name: 'Test Promo 10',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      promoCode: 'PROMO10',
      items: [{ product_id: p50Id, quantity: 2 }] // subtotal 100
    });
    assert.strictEqual(res6.status, 201);
    if (res6.body.id) testOrderIds.push(res6.body.id);
    // 100 - 10% = 90
    assert.strictEqual(res6.body.total, 90, `Expected total = 90, got ${res6.body.total}`);

    // Verify usageCount incremented in DB
    const promoCheck = await client.query('SELECT usagecount FROM promotions WHERE id = $1', [promo1Id]);
    assert.strictEqual(parseInt(promoCheck.rows[0].usagecount), 1, 'usagecount should be 1');
    console.log('✓ promo percentage 10% applied (total 90) and usageCount incremented to 1.');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 7: promo expired yesterday -> ignored (no discount)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 7: Promo expired yesterday ---');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const promoRes2 = await client.query(`
      INSERT INTO promotions (code, type, value, minimumOrder, expiryDate, active, usageCount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['EXPIRED10', 'percentage', 10, 0, yesterday, 1, 0]);
    const promo2Id = promoRes2.rows[0].id;
    testPromoIds.push(promo2Id);

    const res7 = await postOrder({
      customer_name: 'Test Expired Promo',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      promoCode: 'EXPIRED10',
      items: [{ product_id: p50Id, quantity: 2 }] // subtotal 100
    });
    assert.strictEqual(res7.status, 201);
    if (res7.body.id) testOrderIds.push(res7.body.id);
    assert.strictEqual(res7.body.total, 100, `Expected total = 100 (no discount), got ${res7.body.total}`);
    console.log('✓ Expired promo was ignored (total remained 100).');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 8: promo with minimumOrder above subtotal -> ignored
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 8: Promo with minimumOrder above subtotal ---');
    const promoRes3 = await client.query(`
      INSERT INTO promotions (code, type, value, minimumOrder, expiryDate, active, usageCount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['MINORDER10', 'percentage', 10, 500, futureDate, 1, 0]);
    const promo3Id = promoRes3.rows[0].id;
    testPromoIds.push(promo3Id);

    const res8 = await postOrder({
      customer_name: 'Test Min Promo',
      customer_phone: '0612345678',
      customer_city: 'Marrakech',
      customer_address: '123 Test St',
      promoCode: 'MINORDER10',
      items: [{ product_id: p50Id, quantity: 2 }] // subtotal 100 < 500
    });
    assert.strictEqual(res8.status, 201);
    if (res8.body.id) testOrderIds.push(res8.body.id);
    assert.strictEqual(res8.body.total, 100, `Expected total = 100 (no discount), got ${res8.body.total}`);
    console.log('✓ Promo with unmet minimumOrder was ignored (total remained 100).');

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 9: Concurrency stock race scenario still passes
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Case 9: Concurrency stock race scenario ---');
    const raceProdRes = await client.query(`
      INSERT INTO products (name, description, price, category_id, stock, trackStock, available)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['Race Product', 'Testing concurrency', 50.0, categoryId, 2, 1, 1]);
    const raceProdId = raceProdRes.rows[0].id;
    testProductIds.push(raceProdId);

    const raceRequests = Array.from({ length: 6 }).map((_, idx) =>
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': getNextIp()
        },
        body: JSON.stringify({
          customer_name: `Race User ${idx + 1}`,
          customer_phone: '0612345678',
          customer_address: '123 Race St',
          items: [{ product_id: raceProdId, quantity: 1 }]
        })
      }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    );

    const raceResponses = await Promise.all(raceRequests);
    const raceSuccesses = raceResponses.filter(r => r.status === 201);
    const raceConflicts = raceResponses.filter(r => r.status === 409);

    raceSuccesses.forEach(s => {
      if (s.body && s.body.id) testOrderIds.push(s.body.id);
    });

    const finalStockRes = await client.query('SELECT stock FROM products WHERE id = $1', [raceProdId]);
    const finalStock = finalStockRes.rows[0].stock;

    assert.strictEqual(raceSuccesses.length, 2, `Expected 2 successes, got ${raceSuccesses.length}`);
    assert.strictEqual(raceConflicts.length, 4, `Expected 4 conflicts, got ${raceConflicts.length}`);
    assert.strictEqual(finalStock, 0, `Expected final stock 0, got ${finalStock}`);
    console.log('✓ Concurrency test passed: 2 succeeded (201), 4 conflicted (409), final stock is 0.');

    console.log('\n===========================================');
    console.log('ALL ORDER RULES REGRESSION TESTS PASSED! ✅');
    console.log('===========================================');

  } finally {
    console.log('\n🧹 Cleaning up test data & restoring original settings...');

    // 1. Delete test orders and their items
    if (testOrderIds.length > 0) {
      const placeholders = testOrderIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, testOrderIds);
      await client.query(`DELETE FROM orders WHERE id IN (${placeholders})`, testOrderIds);
    }

    // 2. Delete test promos
    if (testPromoIds.length > 0) {
      const placeholders = testPromoIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM promotions WHERE id IN (${placeholders})`, testPromoIds);
    }

    // 3. Delete test products
    if (testProductIds.length > 0) {
      const placeholders = testProductIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM products WHERE id IN (${placeholders})`, testProductIds);
    }

    // 4. Restore original settings
    if (origSettings) {
      const keys = Object.keys(origSettings).filter(k => k !== 'id');
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      const values = keys.map(k => origSettings[k]);
      await client.query(`UPDATE settings SET ${setClauses} WHERE id = $${keys.length + 1}`, [...values, origSettings.id]);
    }

    client.release();
    await pool.end();
    console.log('✓ Cleanup complete.');
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
