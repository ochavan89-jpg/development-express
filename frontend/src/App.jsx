import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--navy)", color:"var(--gold)" }}>LOADING...</div>;
  }

  return user ? children : <Navigate to="/" replace />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();

  return roles.includes(user?.role) ? children : <Navigate to="/dashboard" replace />;
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RequireRole roles={["admin","owner"]}><Machines /></RequireRole>} />
            <Route path="/wallet" element={<RequireRole roles={["admin","owner","client"]}><Wallet /></RequireRole>} />
            <Route path="/reports" element={<RequireRole roles={["admin","owner"]}><Reports /></RequireRole>} />
            <Route path="/operators" element={<RequireRole roles={["admin"]}><Operators /></RequireRole>} />
            <Route path="/bookings" element={<RequireRole roles={["admin","owner","client"]}><Bookings /></RequireRole>} />
            <Route path="/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}