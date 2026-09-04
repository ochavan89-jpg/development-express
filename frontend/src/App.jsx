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

function LoadingScreen() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--navy)", color:"var(--gold)" }}>
      LOADING...
    </div>
  );
}

function PublicLogin() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <Layout />;
}

function RequireRole({ roles, children }) {
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
          <Route path="/" element={<PublicLogin />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RequireRole roles={["admin","owner"]}><Machines /></RequireRole>} />
            <Route path="/wallet" element={<RequireRole roles={["admin","owner","client"]}><Wallet /></RequireRole>} />
            <Route path="/reports" element={<RequireRole roles={["admin","owner"]}><Reports /></RequireRole>} />
            <Route path="/operators" element={<RequireRole roles={["admin"]}><Operators /></RequireRole>} />
            <Route path="/bookings" element={<RequireRole roles={["admin","owner","client","operator"]}><Bookings /></RequireRole>} />
            <Route path="/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}