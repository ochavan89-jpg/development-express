import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";

import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import Operators from "./pages/Operators";
import Bookings from "./pages/Bookings";
import Users from "./pages/Users";

function Guard({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "var(--navy)" }} />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Guard roles={["admin", "owner"]}><Machines /></Guard>} />
            <Route path="/wallet" element={<Guard roles={["admin", "owner", "client"]}><Wallet /></Guard>} />
            <Route path="/reports" element={<Guard roles={["admin", "owner"]}><Reports /></Guard>} />
            <Route path="/operators" element={<Guard roles={["admin"]}><Operators /></Guard>} />
            <Route path="/bookings" element={<Guard roles={["admin", "owner", "client"]}><Bookings /></Guard>} />
            <Route path="/users" element={<Guard roles={["admin"]}><Users /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}