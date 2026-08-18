const schoolSettingService = require('../services/schoolSetting.service');
const { success } = require('../utils/response');

async function list(req, res, next) {
  try {
    const items = await schoolSettingService.list();
    return success(res, 200, 'Daftar school settings berhasil diambil', items);
  } catch (err) {
    next(err);
  }
}

async function getByKey(req, res, next) {
  try {
    const item = await schoolSettingService.getByKey(req.params.key);
    return success(res, 200, 'Detail setting berhasil diambil', item);
  } catch (err) {
    next(err);
  }
}

async function upsert(req, res, next) {
  try {
    const item = await schoolSettingService.upsert(req.params.key, req.body);
    return success(res, 200, 'Setting berhasil disimpan', item);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await schoolSettingService.remove(req.params.key);
    return success(res, 200, 'Setting berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getByKey, upsert, remove };
