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

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
      LOADING...
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;

  return children;
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
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/dashboard" element={<RequireRole roles={["admin", "owner", "client", "operator"]}><Dashboard /></RequireRole>} />
            <Route path="/machines" element={<RequireRole roles={["admin", "owner"]}><Machines /></RequireRole>} />
            <Route path="/wallet" element={<RequireRole roles={["admin", "owner", "client"]}><Wallet /></RequireRole>} />
            <Route path="/reports" element={<RequireRole roles={["admin", "owner"]}><Reports /></RequireRole>} />
            <Route path="/operators" element={<RequireRole roles={["admin"]}><Operators /></RequireRole>} />
            <Route path="/bookings" element={<RequireRole roles={["admin", "owner", "client"]}><Bookings /></RequireRole>} />
            <Route path="/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}