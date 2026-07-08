import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RequireRole roles={["admin", "owner"]}><Machines /></RequireRole>} />
            <Route path="/wallet" element={<RequireRole roles={["admin", "owner", "client"]}><Wallet /></RequireRole>} />
            <Route path="/reports" element={<RequireRole roles={["admin", "owner"]}><Reports /></RequireRole>} />
            <Route path="/operators" element={<RequireRole roles={["admin"]}><Operators /></RequireRole>} />
            <Route path="/bookings" element={<RequireRole roles={["admin", "owner", "client"]}><Bookings /></RequireRole>} />
            <Route path="/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}