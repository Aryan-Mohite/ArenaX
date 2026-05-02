import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * AdminRoute — wraps routes that require both:
 *   1. Authentication (valid token)
 *   2. Admin privileges (user.isAdmin === true in JWT payload)
 *
 * Non-authenticated users  → redirected to /login (with return path)
 * Authenticated non-admins → redirected to / with a clear 403 message
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user?.isAdmin) {
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  return children;
}
