/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { POS } from "@/pages/POS";
import { Inventory } from "@/pages/Inventory";
import { Customers } from "@/pages/Customers";
import { Returns } from "@/pages/Returns";
import { SalesRecords } from "@/pages/SalesRecords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { syncWithFirebase } from "@/lib/db";

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup, isMockUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F3] selection:bg-[#141414] selection:text-white">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E4E3E0] w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-sans font-bold text-3xl tracking-tight mb-2 uppercase">STREET RAGE</h1>
          <p className="text-xs font-mono text-[#666666] uppercase tracking-wider">
            {isRegistering ? "Register Admin Access" : "Admin Authentication"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-mono font-medium text-[#666666] tracking-wider mb-1 block">Email</label>
              <Input 
                type="email" 
                placeholder="admin@streetrage.com" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="font-mono border-[#E4E3E0] bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono font-medium text-[#666666] tracking-wider mb-1 block">Password</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="font-mono border-[#E4E3E0] bg-white"
              />
            </div>
            
            {error && <p className="text-[10px] text-red-500 font-mono text-center mt-2 leading-relaxed">{error}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#141414] hover:bg-[#333333] text-white uppercase tracking-widest text-xs py-6 mt-4">
            {loading ? "Authenticating..." : isRegistering ? "Create Admin Account" : "Access System"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }} 
            className="text-[11px] font-mono text-[#666666] hover:text-[#141414] underline"
          >
            {isRegistering ? "Already have an account? Sign In" : "Need to register? Sign Up"}
          </button>
        </div>

        {isMockUser && (
          <div className="mt-6 p-3 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-800 font-mono leading-relaxed">
            <span className="font-bold">Offline / Dev Mode:</span>
            <br />
            Sign in with <span className="font-bold">admin@streetrage.com</span> / <span className="font-bold">admin</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MainAppRoutes() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      // Sync local state cache with Firebase once logged in
      syncWithFirebase();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F3]">
        <div className="text-center font-mono text-xs text-[#666666] uppercase tracking-widest animate-pulse">
          Loading Environment...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const isAdmin = user?.email?.toLowerCase().includes("admin") ?? true;
  const defaultRedirect = isAdmin ? "/dashboard" : "/pos";

  return (
    <BrowserRouter>
      <div className="flex h-screen w-full bg-white overflow-hidden selection:bg-[#141414] selection:text-white">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
            <Route path="/dashboard" element={isAdmin ? <Dashboard /> : <Navigate to="/pos" replace />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={isAdmin ? <Inventory /> : <Navigate to="/pos" replace />} />
            <Route path="/sales-records" element={isAdmin ? <SalesRecords /> : <Navigate to="/pos" replace />} />
            <Route path="/customers" element={isAdmin ? <Customers /> : <Navigate to="/pos" replace />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppRoutes />
    </AuthProvider>
  );
}

