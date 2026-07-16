import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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

function Guard({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)", color: "var(--gold)" }}>
        LOADING...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />

          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Guard roles={["admin", "owner"]}><Machines /></Guard>} />
            <Route path="/wallet" element={<Guard roles={["admin", "owner", "client"]}><Wallet /></Guard>} />
            <Route path="/reports" element={<Guard roles={["admin", "owner"]}><Reports /></Guard>} />
            <Route path="/operators" element={<Guard roles={["admin"]}><Operators /></Guard>} />
            <Route path="/bookings" element={<Guard roles={["admin", "owner", "client"]}><Bookings /></Guard>} />
            <Route path="/users" element={<Guard roles={["admin"]}><Users /></Guard>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}