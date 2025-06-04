const { body, validationResult } = require("express-validator");
const { AppError } = require("../utils/errorHandler");

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const errorMessages = errors.array().map((err) => err.msg);
    return next(new AppError(errorMessages.join(", "), 400));
  };
};

const appointmentValidationRules = () => {
  return [
    body("patientId").isMongoId().withMessage("Invalid patient ID"),
    body("doctorId").isMongoId().withMessage("Invalid doctor ID"),
    body("date").isISO8601().withMessage("Invalid date format"),
    body("reason").optional().isString().trim().escape(),
  ];
};

const patientValidationRules = () => {
  return [
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("phone").isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().withMessage("Invalid email"),
  ];
};

module.exports = {
  validate,
  appointmentValidationRules,
  patientValidationRules,
};
