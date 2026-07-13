import { BrowserRouter, Navigate, Outlet, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import Operators from "./pages/Operators";
import Bookings from "./pages/Bookings";
import Users from "./pages/Users";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/machines" element={<RoleRoute roles={["admin", "owner"]}><Machines /></RoleRoute>} />
              <Route path="/wallet" element={<RoleRoute roles={["admin", "owner", "client"]}><Wallet /></RoleRoute>} />
              <Route path="/reports" element={<RoleRoute roles={["admin", "owner"]}><Reports /></RoleRoute>} />
              <Route path="/operators" element={<RoleRoute roles={["admin"]}><Operators /></RoleRoute>} />
              <Route path="/bookings" element={<RoleRoute roles={["admin", "owner", "client"]}><Bookings /></RoleRoute>} />
              <Route path="/users" element={<RoleRoute roles={["admin"]}><Users /></RoleRoute>} />
            </Route>
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}