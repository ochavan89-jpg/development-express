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
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--navy)", color:"var(--gold)", letterSpacing:2 }}>
      LOADING...
    </div>
  );
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function Protected({ roles, children }) {
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
          <Route path="/" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Protected roles={["admin","owner"]}><Machines /></Protected>} />
            <Route path="/wallet" element={<Protected roles={["admin","owner","client"]}><Wallet /></Protected>} />
            <Route path="/reports" element={<Protected roles={["admin","owner"]}><Reports /></Protected>} />
            <Route path="/operators" element={<Protected roles={["admin"]}><Operators /></Protected>} />
            <Route path="/bookings" element={<Protected roles={["admin","owner","client"]}><Bookings /></Protected>} />
            <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}