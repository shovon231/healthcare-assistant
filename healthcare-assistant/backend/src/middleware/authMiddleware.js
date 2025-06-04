const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

const protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("Not authorized to access this route", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error(`JWT verification error: ${err.message}`);
    return next(new AppError("Not authorized to access this route", 401));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`User role ${req.user.role} is not authorized`, 403)
      );
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
