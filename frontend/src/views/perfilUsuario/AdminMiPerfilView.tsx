import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { esRolPoblado } from "@/types/PerfilUsuarioType";
import PerfilView from "./PerfilView";

const CODIGOS_ADMIN = new Set([
  "ADMIN",
  "ADMINISTRADOR",
  "SUPERADMIN",
  "SUPERADMINISTRADOR",
]);

const normalizarRol = (valor: unknown) =>
  String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");

export default function AdminMiPerfilView() {
  const { data: usuario, isLoading, isError } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">
        Cargando perfil administrativo...
      </div>
    );
  }

  if (isError || !usuario) {
    return <Navigate to="/auth/login" replace />;
  }

  const esAdministrador = usuario.roles
    .filter(esRolPoblado)
    .some((rol) =>
      [rol.codigo, rol.nombre]
        .map(normalizarRol)
        .some((valor) => CODIGOS_ADMIN.has(valor)),
    );

  if (!esAdministrador) {
    return <Navigate to="/perfil" replace />;
  }

  return <PerfilView />;
}
