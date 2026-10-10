const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createAnalyticsRoutes(db) {
  const router = express.Router();

  // GET /api/analytics — dashboard analytics (admin only)
  router.get('/', authenticateToken, async (req, res) => {
    try {
      // Total revenue (all time)
      const totalRevRow = await db.get('SELECT COALESCE(SUM(total), 0) as val FROM orders');
      const totalRevenue = totalRevRow.val;

      // Revenue this month (SQLite strftime replaced with Postgres TO_CHAR)
      const monthRevRow = await db.get(
        "SELECT COALESCE(SUM(total), 0) as val FROM orders WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')"
      );
      const monthRevenue = monthRevRow.val;

      // Revenue this week (last 7 days) - SQLite datetime replaced with Postgres INTERVAL
      const weekRevRow = await db.get(
        "SELECT COALESCE(SUM(total), 0) as val FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"
      );
      const weekRevenue = weekRevRow.val;

      // Average order value
      const avgRow = await db.get('SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders');
      const avgOrderValue = parseInt(avgRow.cnt) > 0 ? avgRow.total / parseInt(avgRow.cnt) : 0;

      // Orders per day — last 30 days
      const dailyRows = await db.all(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM orders
         WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY day ASC`
      );

      // Build a full 30-day array with zeros for missing days
      const dailyMap = {};
      dailyRows.forEach(r => { 
        // In postgres DATE() can sometimes return a Date object depending on driver, 
        // we'll safely convert it to YYYY-MM-DD string format
        const dayStr = (r.day instanceof Date) ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
        dailyMap[dayStr] = parseInt(r.count); 
      });
      const dailyOrders = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyOrders.push({ day: key, count: dailyMap[key] || 0 });
      }

      // Top 10 products by order count
      const topProducts = await db.all(
        `SELECT oi.product_name, 
                COUNT(*) as orderCount, 
                COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
         FROM order_items oi
         GROUP BY oi.product_name
         ORDER BY orderCount DESC
         LIMIT 10`
      );

      // Fix PG BigInt strings returning from COUNT(*)
      const topProductsFormatted = topProducts.map(p => ({
        product_name: p.product_name,
        orderCount: parseInt(p.ordercount || p.orderCount),
        revenue: Math.round(p.revenue * 100) / 100
      }));

      res.json({
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        weekRevenue: Math.round(weekRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        dailyOrders,
        topProducts: topProductsFormatted
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createAnalyticsRoutes;
