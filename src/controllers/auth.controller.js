const authService = require('../services/auth.service');
const { success } = require('../utils/response');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return success(res, 200, 'Login berhasil', result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id, req.user.role);
    return success(res, 200, 'Data profil berhasil diambil', profile);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me };
