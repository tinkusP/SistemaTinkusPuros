import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { lazy, Suspense } from "react";

import { AuthProvider } from "./Context/AuthContext";

// Layouts
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import ComunicadosView from "./layouts/ComunicadosView";

// Vistas
import LoginView from "./views/auth/LoginView";
import CambiarPasswordObligatorioView from "./views/auth/CambiarPasswordObligatorioView";

import PerfilUsuarioView from "./views/perfilUsuario/PerfilUsuarioView";

import DashboardView from "./views/DashboardView";
import CrearCuenta from "./views/perfilUsuario/CrearCuenta";
import PerfilView from "./views/perfilUsuario/PerfilView";

import CrearPerfilUsuarioView from "./views/perfilUsuario/CrearPerfilUsuarioView";
import EditPerfilUsuarioView from "./views/perfilUsuario/EditPerfilUsuarioView";

import RolDetailView from "./views/rol/RolDetailView";
import CrearRolView from "./views/rol/CrearRolView";
import EditRolView from "./views/rol/EditRolView";

import GestionView from "./views/gestion/GestionView";
import CrearGestionView from "./views/gestion/CrearGestionView";
import EditGestionView from "./views/gestion/EditarGestionView";
import PreregistroView from "./views/preregistro/PreregistroView";
import CrearPreregistroView from "./views/preregistro/CrearPreregistroView";
import EditarPreregistroView from "./views/preregistro/EditarPreregistroView";
import MisPreregistrosView from "./views/preregistro/MisPreregistrosView";
import PostulanteGuiaView from "./views/guia/PostulanteGuiaView";
import DetallePostulanteGuiaView from "./views/guia/DetallePostulanteGuiaView";
import AnuncioAdminView from "./views/comunicacion/AnuncioAdminView";
import AuditoriaView from "./views/comunicacion/AuditoriaView";
import NotificacionesView from "./views/comunicacion/NotificacionesView";
import CuotaView from "./views/cuota/CuotaView";
import DetalleCuotaView from "./views/cuota/DetalleCuotaView";
import MisPagosView from "./views/cuota/MisPagosView";
import FraternoView from "./views/fraterno/FraternoView";
import TraspasoView from "./views/fraterno/TraspasoView";
import AsistenciaView from "./views/fraterno/AsistenciaView";
import MiAsistenciaView from "./views/fraterno/MiAsistenciaView";
import IndumentariaView from "./views/indumentaria/IndumentariaView";
import MisTallasView from "./views/indumentaria/MisTallasView";
import AdminMiPerfilView from "./views/perfilUsuario/AdminMiPerfilView";
import GuiaBloqueView from "./views/guia/GuiaBloqueView";
import MiBloqueGuiaView from "./views/guia/MiBloqueGuiaView";
import MiBloqueFraternoView from "./views/fraterno/MiBloqueFraternoView";
import AsistenciaPostulanteGuiaView from "./views/guia/AsistenciaPostulanteGuiaView";
import MiAsistenciaPostulanteGuiaView from "./views/guia/MiAsistenciaPostulanteGuiaView";
import FacultadesView from "./views/perfilUsuario/FacultadesView";
import ReportesView from "./views/reportes/ReportesView";
import PasosVideoView from "./views/guia/PasosVideoView";
import CancioneroView from "./views/guia/CancioneroView";
import TokenRegistroView from "./views/tokens/TokenRegistroView";
const MiCredencialQrView=lazy(()=>import("./views/perfilUsuario/MiCredencialQrView"));
const EscanerQrView=lazy(()=>import("./views/perfilUsuario/EscanerQrView"));

// Vista principal del panel del postulante


export default function Router() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Routes>
          {/* =====================================
              AUTENTICACIÓN
          ====================================== */}

          <Route element={<AuthLayout />}>
            <Route
              path="/auth/login"
              element={<LoginView />}
            />
          </Route>

          <Route
            path="/auth/registrar"
            element={<CrearCuenta />}
          />
          <Route path="/cambiar-password-obligatorio" element={<CambiarPasswordObligatorioView />} />

          {/* =====================================
              PANEL ADMINISTRATIVO
          ====================================== */}

          <Route element={<AppLayout />}>
            <Route
              path="/dashboard"
              element={<DashboardView />}
            />

            <Route  path="/perfilUsuario"   element={<PerfilView />}/>
            <Route path="/admin/mi-perfil" element={<AdminMiPerfilView />} />
            <Route
                path="/perfilUsuario/crear"
                element={<CrearPerfilUsuarioView />}
                
              />

              
                <Route
                path="/perfilUsuario/:perfilUsuarioId/editar"
                element={<EditPerfilUsuarioView />}
                
              />

            <Route
              path="/perfil-usuario"
              element={<PerfilUsuarioView />}
              
            />


                <Route
              path="/rol"
              element={<RolDetailView />}

            />
             <Route
                  path="/rol/crear"
                  element={<CrearRolView />}
                />
 <Route
                  path="/rol/:rolId/editar"
                  element={<EditRolView />}
                />



                <Route
              path="/gestion"
              element={<GestionView />}

            />

     <Route
              path="/gestion/:gestionId/editar"
              element={<EditGestionView />}

            />
            <Route
              path="/gestion/crear"
              element={<CrearGestionView />}

            />

            <Route path="/preregistros" element={<PreregistroView />} />
            <Route path="/preregistros/crear" element={<CrearPreregistroView />} />
            <Route path="/preregistros/:preregistroId/editar" element={<EditarPreregistroView />} />
            <Route path="/postulantes-guia" element={<PostulanteGuiaView />} />
            <Route path="/postulantes-guia/:id" element={<DetallePostulanteGuiaView />} />
            <Route path="/guias-bloques" element={<GuiaBloqueView />} />
            <Route path="/mi-bloque-guia" element={<MiBloqueGuiaView />} />
            <Route path="/anuncios" element={<AnuncioAdminView />} />
            <Route path="/auditoria" element={<AuditoriaView />} />
            <Route path="/cuotas" element={<CuotaView />} />
            <Route path="/cuotas/:id" element={<DetalleCuotaView />} />
            <Route path="/fraternos" element={<FraternoView />} />
            <Route path="/traspasos" element={<TraspasoView />} />
            <Route path="/asistencias" element={<AsistenciaView />} />
            <Route path="/asistencias-postulantes-guia" element={<AsistenciaPostulanteGuiaView />} />
            <Route path="/facultades" element={<FacultadesView />} />
            <Route path="/reportes" element={<ReportesView />} />
            <Route path="/tokens-registro" element={<TokenRegistroView />} />
            <Route path="/indumentaria" element={<IndumentariaView />} />
            <Route path="/pasos" element={<PasosVideoView />} />
            <Route path="/cancionero" element={<CancioneroView />} />
            <Route path="/escaner-qr" element={<Suspense fallback={<p className="p-8 text-center">Cargando escáner...</p>}><EscanerQrView /></Suspense>} />

          </Route>

          {/* =====================================
              PANEL DEL POSTULANTE / FRATERNO
          ====================================== */}

          <Route
            path="/comunicados"
            element={<ComunicadosView />}
          />

          {/*
            El menú de Comunicados navega a /perfil. Esta ruta debe ser
            independiente porque ComunicadosView es una página completa y no
            renderiza un <Outlet /> para rutas hijas.
          */}
          <Route
            path="/perfil"
            element={<PerfilView />}
          />
          <Route path="/mis-preregistros" element={<MisPreregistrosView />} />
          <Route path="/notificaciones" element={<NotificacionesView />} />
          <Route path="/mis-pagos" element={<MisPagosView />} />
          <Route path="/mis-tallas" element={<MisTallasView />} />
          <Route path="/mi-asistencia" element={<MiAsistenciaView />} />
          <Route path="/mi-asistencia-guia" element={<MiAsistenciaPostulanteGuiaView />} />
          <Route path="/mi-bloque" element={<MiBloqueFraternoView />} />
          <Route path="/mi-credencial-qr" element={<Suspense fallback={<p className="p-8 text-center">Generando credencial...</p>}><MiCredencialQrView /></Suspense>} />

          {/* =====================================
              REDIRECCIONES
          ====================================== */}

          {/* Compatibilidad con enlaces antiguos y marcadores guardados. */}
          <Route path="/login" element={<Navigate to="/auth/login" replace />} />
          <Route path="/perfil-usuarios" element={<Navigate to="/perfil-usuario" replace />} />
          <Route path="/roles" element={<Navigate to="/rol" replace />} />

          <Route
            path="*"
            element={
              <Navigate
                to="/auth/login"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
