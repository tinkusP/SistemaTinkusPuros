// src/context/AuthContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type Usuario = {
  _id: string;
  nombre: string;
  email: string;
  cargo?: string;
  sucursal?: string;
};

type AuthContextType = {
  usuario: Usuario | null;
  setUsuario: (user: Usuario | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  return (
    <AuthContext.Provider value={{ usuario, setUsuario }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
