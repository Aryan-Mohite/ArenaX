/**
 * 404 handler — catches any request that didn't match a route.
 * Must be registered AFTER all routes in app.js.
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Global error handler.
 * Must be registered as the very last middleware in app.js (4 parameters).
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Don't leak stack traces in production
  const response = {
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  console.error(`[${statusCode}] ${err.message}`);
  res.status(statusCode).json(response);
};
