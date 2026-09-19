import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
      LOADING...
    </div>
  );
}

function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function Guard({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
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
          <Route element={<PublicOnly />}>
            <Route path="/" element={<Login />} />
          </Route>

          <Route element={<Guard />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<Guard roles={["admin", "owner"]} />}>
                <Route path="/machines" element={<Machines />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
              <Route element={<Guard roles={["admin", "owner", "client"]} />}>
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/bookings" element={<Bookings />} />
              </Route>
              <Route element={<Guard roles={["admin"]} />}>
                <Route path="/operators" element={<Operators />} />
                <Route path="/users" element={<Users />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}