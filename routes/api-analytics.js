const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createAnalyticsRoutes(db) {
  const router = express.Router();

  // GET /api/analytics — dashboard analytics (admin only)
  router.get('/', authenticateToken, (req, res) => {
    try {
      // Total revenue (all time)
      const totalRevRow = db.get('SELECT COALESCE(SUM(total), 0) as val FROM orders');
      const totalRevenue = totalRevRow.val;

      // Revenue this month
      const monthRevRow = db.get(
        "SELECT COALESCE(SUM(total), 0) as val FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
      );
      const monthRevenue = monthRevRow.val;

      // Revenue this week (last 7 days)
      const weekRevRow = db.get(
        "SELECT COALESCE(SUM(total), 0) as val FROM orders WHERE created_at >= datetime('now', '-7 days')"
      );
      const weekRevenue = weekRevRow.val;

      // Average order value
      const avgRow = db.get('SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders');
      const avgOrderValue = avgRow.cnt > 0 ? avgRow.total / avgRow.cnt : 0;

      // Orders per day — last 30 days
      const dailyRows = db.all(
        `SELECT date(created_at) as day, COUNT(*) as count
         FROM orders
         WHERE created_at >= datetime('now', '-30 days')
         GROUP BY date(created_at)
         ORDER BY day ASC`
      );

      // Build a full 30-day array with zeros for missing days
      const dailyMap = {};
      dailyRows.forEach(r => { dailyMap[r.day] = r.count; });
      const dailyOrders = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyOrders.push({ day: key, count: dailyMap[key] || 0 });
      }

      // Top 10 products by order count
      const topProducts = db.all(
        `SELECT oi.product_name, 
                COUNT(*) as orderCount, 
                COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
         FROM order_items oi
         GROUP BY oi.product_name
         ORDER BY orderCount DESC
         LIMIT 10`
      );

      res.json({
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        weekRevenue: Math.round(weekRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        dailyOrders,
        topProducts
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createAnalyticsRoutes;
