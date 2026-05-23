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

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)", color: "var(--gold)" }}>
      LOADING...
    </div>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
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
          <Route path="/" element={<LoginRoute />} />

          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/dashboard" element={<Guard roles={["admin", "owner", "client", "operator"]}><Dashboard /></Guard>} />
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