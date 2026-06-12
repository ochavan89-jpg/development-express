import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)", color: "var(--gold)", letterSpacing: 2 }}>
      LOADING...
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/operators" element={<Operators />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}