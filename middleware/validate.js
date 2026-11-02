const { z } = require('zod');

/**
 * Express middleware for Zod validation on body, params, and/or query.
 * Rejects unknown fields when schemas use .strict().
 */
function validate({ body, params, query }) {
  return (req, res, next) => {
    try {
      if (params) {
        req.params = params.parse(req.params);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (body) {
        req.body = body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const firstIssue = err.issues[0];
        const field = firstIssue.path.join('.') || 'field';
        return res.status(400).json({
          error: `Invalid input for ${field}: ${firstIssue.message}`,
          issues: err.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
        });
      }
      return res.status(400).json({ error: 'Invalid request data.' });
    }
  };
}

// Common schemas
const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
}).strict();

module.exports = {
  validate,
  z,
  idParamSchema
};
