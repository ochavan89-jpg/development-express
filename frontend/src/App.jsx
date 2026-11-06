import { BrowserRouter, Navigate, Outlet, Routes, Route } from "react-router-dom";
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

function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["admin", "owner"]} />}>
            <Route element={<Layout />}>
              <Route path="/machines" element={<Machines />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["admin", "owner", "client"]} />}>
            <Route element={<Layout />}>
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/wallet" element={<Wallet />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route element={<Layout />}>
              <Route path="/operators" element={<Operators />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}