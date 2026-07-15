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

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)", color: "var(--gold)" }}>
        LOADING...
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<ProtectedRoute roles={["admin", "owner"]}><Machines /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute roles={["admin", "owner", "client"]}><Wallet /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={["admin", "owner"]}><Reports /></ProtectedRoute>} />
            <Route path="/operators" element={<ProtectedRoute roles={["admin"]}><Operators /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute roles={["admin", "owner", "client"]}><Bookings /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}