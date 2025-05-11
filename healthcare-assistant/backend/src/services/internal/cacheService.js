const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10-min TTL

const setCache = (key, value) => {
  cache.set(key, value);
};

const getCache = (key) => {
  return cache.get(key);
};

const deleteCache = (key) => {
  cache.del(key);
};

module.exports = { setCache, getCache, deleteCache };
