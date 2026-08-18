const { error } = require('../utils/response');

/**
 * Middleware factory: validasi req.body pakai Zod schema.
 * Pakai: router.post('/login', validate(loginSchema), controller.login)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return error(res, 422, firstIssue?.message || 'Input tidak valid');
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
