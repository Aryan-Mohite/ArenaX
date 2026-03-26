export const protect = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  // For now simple check (later JWT)
  if (token !== "mysecrettoken") {
    return res.status(403).json({ message: "Invalid token" });
  }

  next(); // move to controller
};