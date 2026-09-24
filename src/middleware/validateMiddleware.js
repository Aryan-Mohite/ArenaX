import { validationResult } from "express-validator";

/**
 * Runs after any express-validator rule array.
 * If there are validation errors, returns 422 with the full error list.
 * Otherwise calls next() to proceed to the controller.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

export default validate;
