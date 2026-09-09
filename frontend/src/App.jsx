import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 24, color: "var(--gold)" }}>Loading...</div>;
  }

  if (!user) return <Navigate to="/" replace />;

  return <Layout />;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RoleRoute roles={["admin", "owner"]}><Machines /></RoleRoute>} />
            <Route path="/wallet" element={<RoleRoute roles={["admin", "owner", "client"]}><Wallet /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute roles={["admin", "owner"]}><Reports /></RoleRoute>} />
            <Route path="/operators" element={<RoleRoute roles={["admin"]}><Operators /></RoleRoute>} />
            <Route path="/bookings" element={<RoleRoute roles={["admin", "owner", "client"]}><Bookings /></RoleRoute>} />
            <Route path="/users" element={<RoleRoute roles={["admin"]}><Users /></RoleRoute>} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}