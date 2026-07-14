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

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
      LOADING...
    </div>
  );
}

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RequireAuth roles={["admin", "owner"]}><Machines /></RequireAuth>} />
            <Route path="/wallet" element={<RequireAuth roles={["admin", "owner", "client"]}><Wallet /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth roles={["admin", "owner"]}><Reports /></RequireAuth>} />
            <Route path="/operators" element={<RequireAuth roles={["admin"]}><Operators /></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth roles={["admin", "owner", "client"]}><Bookings /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth roles={["admin"]}><Users /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}