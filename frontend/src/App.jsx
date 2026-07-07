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

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--navy)", color:"var(--gold)" }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicLogin() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--navy)", color:"var(--gold)" }}>Loading...</div>;
  }

  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<PublicLogin />} />
          <Route path="/login" element={<PublicLogin />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<ProtectedRoute roles={["admin","owner"]}><Machines /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute roles={["admin","owner","client"]}><Wallet /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={["admin","owner"]}><Reports /></ProtectedRoute>} />
            <Route path="/operators" element={<ProtectedRoute roles={["admin"]}><Operators /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute roles={["admin","owner","client"]}><Bookings /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}