import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, hasValidConfig } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  isMockUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMockUser, setIsMockUser] = useState(!hasValidConfig);

  useEffect(() => {
    if (!hasValidConfig || !auth) {
      // Local Storage based Auth for development fallback
      const stored = localStorage.getItem("mock_auth");
      if (stored === "true") {
        setUser({ email: "admin@streetrage.com", uid: "mock-uid-123" } as User);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsMockUser(false);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    if (!hasValidConfig || !auth) {
      if (email === "admin@streetrage.com" && pass === "admin") {
        localStorage.setItem("mock_auth", "true");
        setUser({ email, uid: "mock-uid-123" } as User);
        setIsMockUser(true);
      } else {
        throw new Error("Invalid mock credentials. Try admin@streetrage.com / admin.");
      }
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string) => {
    if (!hasValidConfig || !auth) {
      localStorage.setItem("mock_auth", "true");
      setUser({ email, uid: "mock-uid-123" } as User);
      setIsMockUser(true);
      return;
    }
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    if (!hasValidConfig || !auth) {
      localStorage.removeItem("mock_auth");
      setUser(null);
      return;
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isMockUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
