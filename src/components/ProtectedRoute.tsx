import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../hooks/useSession";

// Wrap routes that need a signed-in user. Everything else about access is
// still enforced by Supabase RLS; this only improves the experience.
export function ProtectedRoute() {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (!session)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
