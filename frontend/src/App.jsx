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

function Guard({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0e1a", flexDirection: "column", gap: 16 }}>
        <div className="anim-spin" style={{ width: 40, height: 40, border: "3px solid #8a6a20", borderTopColor: "#f0c040", borderRadius: "50%" }} />
        <p style={{ color: "#c9a84c", fontFamily: "Cinzel", letterSpacing: 3, fontSize: 12 }}>LOADING...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="machines" element={<Guard roles={["admin", "owner"]}><Machines /></Guard>} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="reports" element={<Guard roles={["admin", "owner"]}><Reports /></Guard>} />
            <Route path="operators" element={<Guard roles={["admin"]}><Operators /></Guard>} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="users" element={<Guard roles={["admin"]}><Users /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}