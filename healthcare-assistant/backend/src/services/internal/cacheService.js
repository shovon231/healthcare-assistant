const NodeCache = require("node-cache");
const logger = require("../../utils/logger");

// stdTTL: time to live in seconds for every generated cache element.
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const get = (key) => {
  try {
    const value = cache.get(key);
    if (value) {
      logger.debug(`Cache hit for key: ${key}`);
    } else {
      logger.debug(`Cache miss for key: ${key}`);
    }
    return value;
  } catch (err) {
    logger.error(`Cache get error for key ${key}: ${err.message}`);
    return undefined;
  }
};

const set = (key, value, ttl) => {
  try {
    if (ttl) {
      cache.set(key, value, ttl);
    } else {
      cache.set(key, value);
    }
    logger.debug(`Cache set for key: ${key}`);
    return true;
  } catch (err) {
    logger.error(`Cache set error for key ${key}: ${err.message}`);
    return false;
  }
};

const del = (key) => {
  try {
    cache.del(key);
    logger.debug(`Cache deleted for key: ${key}`);
    return true;
  } catch (err) {
    logger.error(`Cache delete error for key ${key}: ${err.message}`);
    return false;
  }
};

const flush = () => {
  try {
    cache.flushAll();
    logger.debug("Cache flushed");
    return true;
  } catch (err) {
    logger.error(`Cache flush error: ${err.message}`);
    return false;
  }
};

module.exports = {
  get,
  set,
  del,
  flush,
};
