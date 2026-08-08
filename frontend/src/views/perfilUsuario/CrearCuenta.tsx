// import {
//   useMemo,
// } from "react";

// import {
//   useMutation,
//   useQuery,
// } from "@tanstack/react-query";

// import {
//   ArrowLeft,
//   UserPlus,
// } from "lucide-react";

// import {
//   Link,
//   useNavigate,
// } from "react-router-dom";

// import {
//   toast,
// } from "react-toastify";

// import {
//   createPerfilUsuario,
// } from "@/api/PerfilUsuarioApi";

// import {
//   obtenerGestionActiva,
// } from "@/api/GestionApi";

// import {
//   obtenerRolesActivos,
// } from "@/api/RolApi";

// import PerfilUsuarioForm, {
//   construirPayloadRegistro,
//   type PerfilUsuarioFormData,
// } from "@/components/perfilUsuario/PerfilUsuarioForm";

// export default function CrearCuenta() {
//   const navigate =
//     useNavigate();

//   const rolesQuery =
//     useQuery({
//       queryKey: [
//         "roles-activos",
//       ],

//       queryFn:
//         obtenerRolesActivos,
//     });

//   const gestionQuery =
//     useQuery({
//       queryKey: [
//         "gestion-activa",
//       ],

//       queryFn:
//         obtenerGestionActiva,
//     });

//   const rolFraterno =
//     useMemo(
//       () =>
//         rolesQuery.data?.find(
//           (rol) =>
//             rol.codigo
//               .trim()
//               .toUpperCase() ===
//             "FRATERNO",
//         ),
//       [
//         rolesQuery.data,
//       ],
//     );

//   const gestionActiva =
//     gestionQuery.data
//       ?.gestion;

//   const mutation =
//     useMutation({
//       mutationFn:
//         createPerfilUsuario,

//       onSuccess:
//         (
//           respuesta,
//         ) => {
//           toast.success(
//             respuesta.message ||
//               "Cuenta registrada correctamente",
//           );

//           navigate(
//             "/login",
//           );
//         },

//       onError:
//         (
//           error,
//         ) => {
//           toast.error(
//             error instanceof Error
//               ? error.message
//               : "No se pudo registrar la cuenta",
//           );
//         },
//     });

//   const cargando =
//     rolesQuery.isLoading ||
//     gestionQuery.isLoading;

//   const errorConfiguracion =
//     rolesQuery.isError ||
//     gestionQuery.isError ||
//     !rolFraterno ||
//     !gestionActiva;

//   const enviarFormulario =
//     async (
//       datos: PerfilUsuarioFormData,
//     ) => {
//       const payload =
//         construirPayloadRegistro(
//           datos,
//         );

//       await mutation.mutateAsync(
//         payload,
//       );
//     };

//   if (cargando) {
//     return (
//       <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
//         <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
//           Cargando formulario de registro...
//         </div>
//       </main>
//     );
//   }

//   if (
//     errorConfiguracion
//   ) {
//     return (
//       <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
//         <div className="max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
//           <h1 className="text-xl font-black text-red-700">
//             El registro no está disponible
//           </h1>

//           <p className="mt-3 text-sm text-slate-600">
//             Debe existir una gestión activa y un rol con código FRATERNO para habilitar el registro.
//           </p>

//           <Link
//             to="/login"
//             className="mt-6 inline-flex items-center gap-2 font-bold text-[#841534] hover:underline"
//           >
//             <ArrowLeft className="h-5 w-5" />
//             Volver al inicio de sesión
//           </Link>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
//       <div className="mx-auto max-w-5xl space-y-6">
//         <header className="rounded-3xl bg-gradient-to-r from-[#841534] via-[#a33b39] to-[#c39b37] p-7 text-white shadow-xl">
//           <div className="flex items-start gap-4">
//             <div className="rounded-2xl bg-white/15 p-3">
//               <UserPlus className="h-8 w-8" />
//             </div>

//             <div>
//               <p className="text-sm font-semibold text-white/80">
//                 Registro de postulantes
//               </p>

//               <h1 className="text-3xl font-black">
//                 Crear una cuenta
//               </h1>

//               <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
//                 Completa tus datos y adjunta el carnet de identidad y el registro universitario en PDF.
//               </p>
//             </div>
//           </div>
//         </header>

//         <PerfilUsuarioForm
//           modo="REGISTRO_PUBLICO"
//           valoresIniciales={{
//             roles: [
//               rolFraterno._id,
//             ],

//             gestion: [
//               gestionActiva._id,
//             ],
//           }}
//           guardando={
//             mutation.isPending
//           }
//           textoBoton="Enviar solicitud"
//           onSubmit={
//             enviarFormulario
//           }
//           cancelar={() =>
//             navigate(
//               "/login",
//             )
//           }
//         />

//         <p className="text-center text-sm text-slate-500">
//           ¿Ya tienes una cuenta?{" "}

//           <Link
//             to="/login"
//             className="font-bold text-[#841534] hover:underline"
//           >
//             Iniciar sesión
//           </Link>
//         </p>
//       </div>
//     </main>
//   );
// }

import {
  useMemo,
  useState,
} from "react";

import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import {
  ArrowLeft,
  UserPlus,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  toast,
} from "react-toastify";

import {
  createPerfilUsuario,
} from "@/api/PerfilUsuarioApi";

import {
  obtenerGestionActiva,
} from "@/api/GestionApi";

import PerfilUsuarioForm, {
  construirPayloadRegistro,
  type PerfilUsuarioFormData,
} from "@/components/perfilUsuario/PerfilUsuarioForm";
import { limpiarBorradorRegistro } from "@/utils/borradorRegistro";
import { validarToken } from "@/api/TokenRegistroApi";

/* =========================================
   ROL PREDETERMINADO DEL REGISTRO PÚBLICO
========================================= */

/*
 * Este es el ObjectId del rol FRATERNO.
 * Se asignará automáticamente a toda persona
 * que se registre desde "Crear cuenta".
 */
const ROL_FRATERNO_ID =
  "6a57fb30d96747f03f9225ad";

export default function CrearCuenta() {
  const navigate =
    useNavigate();
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [codigoToken, setCodigoToken] = useState("");
  const [tokenValidado, setTokenValidado] = useState<any>(null);
  const validarMutation = useMutation({mutationFn:validarToken,onSuccess:(r)=>setTokenValidado(r.token),onError:(e)=>setErrorRegistro(e instanceof Error?e.message:"Token no válido")});

  /* =========================================
     OBTENER GESTIÓN ACTIVA
  ========================================= */

  const gestionQuery =
    useQuery({
      queryKey: [
        "gestion-activa",
      ],

      queryFn:
        obtenerGestionActiva,
    });

  const gestionActiva =
    gestionQuery.data
      ?.gestion;

  /*
   * Mantener estable el objeto evita que
   * PerfilUsuarioForm se reinicie durante
   * cada renderizado.
   */
  const valoresIniciales =
    useMemo(
      () => ({
        tokenRegistro: tokenValidado?.codigo || "",
        roles: [
          ROL_FRATERNO_ID,
        ],

        gestion:
          (tokenValidado?.gestion?._id || gestionActiva?._id)
            ? [
                tokenValidado?.gestion?._id || gestionActiva._id,
              ]
            : [],
      }),
      [
        gestionActiva?._id, tokenValidado,
      ],
    );

  /* =========================================
     REGISTRAR CUENTA
  ========================================= */

  const mutation =
    useMutation({
      mutationFn:
        createPerfilUsuario,

      onSuccess:
        async (
          respuesta,
        ) => {
          await limpiarBorradorRegistro();
          toast.success(respuesta.message || "Solicitud enviada correctamente");
          setSolicitudEnviada(true);
        },

      onError:
        (
          error,
        ) => {
          const mensaje = error instanceof Error
            ? error.message
            : "No se pudo registrar la cuenta";
          setErrorRegistro(mensaje);
        },
    });

  const enviarFormulario =
    async (
      datos: PerfilUsuarioFormData,
    ) => {
      /*
       * Se vuelve a forzar el rol y la gestión.
       * Así no dependemos de que permanezcan
       * dentro del estado interno del formulario.
       */
      const datosRegistro: PerfilUsuarioFormData = {
        ...datos,

        tokenRegistro: tokenValidado?.codigo || "",

        roles: [
          ROL_FRATERNO_ID,
        ],

        gestion:
          gestionActiva?._id
            ? [
                gestionActiva._id,
              ]
            : [],
      };

      const payload =
        construirPayloadRegistro(
          datosRegistro,
        );

      setErrorRegistro(null);
      try {
        await mutation.mutateAsync(
          payload,
        );
      } catch {
        // onError muestra el detalle en una ventana modal.
      }
    };

  /* =========================================
     ESTADOS DE CARGA
  ========================================= */

  if (!tokenValidado) return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"><div className="text-center text-5xl">🔐</div><h1 className="mt-4 text-center text-2xl font-black text-[#841534]">Token de invitación</h1><p className="mt-2 text-center text-sm text-slate-600">Ingresa el token único entregado por un administrador para habilitar la creación de tu cuenta.</p><form className="mt-6 space-y-4" onSubmit={async e=>{e.preventDefault();setErrorRegistro(null);try{await validarMutation.mutateAsync(codigoToken)}catch{}}}><input autoFocus value={codigoToken} onChange={e=>setCodigoToken(e.target.value.toUpperCase())} placeholder="FRA-XXXXXXXX" className="w-full rounded-xl border px-4 py-3 text-center font-mono text-lg uppercase tracking-widest"/><button disabled={validarMutation.isPending||!codigoToken.trim()} className="w-full rounded-xl bg-[#841534] px-4 py-3 font-bold text-white disabled:opacity-50">{validarMutation.isPending?"Validando...":"Continuar al registro"}</button></form><Link to="/auth/login" className="mt-5 block text-center text-sm font-bold text-[#841534]">Volver al inicio de sesión</Link>{errorRegistro&&<div className="mt-4 rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">{errorRegistro}</div>}</section></main>;

  if (
    gestionQuery.isLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
          Cargando formulario de registro...
        </div>
      </main>
    );
  }

  if (
    gestionQuery.isError ||
    !gestionActiva
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-black text-red-700">
            El registro no está disponible
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Debe existir una gestión activa para habilitar el registro de cuentas.
          </p>

          <Link
            to="/auth/login"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#841534] hover:underline"
          >
            <ArrowLeft className="h-5 w-5" />

            Volver al inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  /* =========================================
     VISTA
  ========================================= */

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-[#841534] via-[#a33b39] to-[#c39b37] p-7 text-white shadow-xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3">
              <UserPlus className="h-8 w-8" />
            </div>

            <div>
              <p className="text-sm font-semibold text-white/80">
                Registro de postulantes
              </p>

              <h1 className="text-3xl font-black">
                Crear una cuenta
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                Completa tus datos. Si deseas, puedes adjuntar el carnet y el registro universitario como PDF o imagen.
              </p>
            </div>
          </div>
        </header>

        <PerfilUsuarioForm
          modo="REGISTRO_PUBLICO"
          valoresIniciales={
            valoresIniciales
          }
          guardando={
            mutation.isPending
          }
          textoBoton="Enviar solicitud"
          onSubmit={
            enviarFormulario
          }
          cancelar={() =>
            navigate(
              "/auth/login",
            )
          }
        />

        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          Tu avance y los documentos seleccionados se guardan automáticamente en este dispositivo. Por seguridad, la contraseña no se guarda.
        </p>

        <p className="text-center text-sm text-slate-500">
          ¿Ya tienes una cuenta?{" "}

          <Link
            to="/auth/login"
            className="font-bold text-[#841534] hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
        {solicitudEnviada && (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="solicitud-enviada-titulo">
            <section className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
              <button type="button" onClick={() => navigate("/auth/login")} aria-label="Cerrar" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-700">✕</button>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
              <h2 id="solicitud-enviada-titulo" className="mt-4 text-2xl font-black text-[#841534]">Solicitud registrada</h2>
              <p className="mt-3 text-slate-600">Tu cuenta quedó pendiente de aprobación. Cuando administración te dé de alta podrás ingresar; desde ese momento comenzará el plazo para pagar tu primera cuota o el total.</p>
              <button type="button" onClick={() => navigate("/auth/login")} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Ir al inicio de sesión</button>
            </section>
          </div>
        )}
        {errorRegistro && (
          <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="error-registro-titulo">
            <section className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
              <button type="button" onClick={() => setErrorRegistro(null)} aria-label="Cerrar" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-700">✕</button>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-3xl text-red-700">!</div>
              <h2 id="error-registro-titulo" className="mt-4 text-2xl font-black text-red-700">No se pudo enviar la solicitud</h2>
              <p className="mt-3 text-slate-700">{errorRegistro}</p>
              <p className="mt-3 text-sm text-slate-500">Tus datos permanecen en el formulario. Corrige o reemplaza el archivo indicado y vuelve a intentarlo.</p>
              <button type="button" autoFocus onClick={() => setErrorRegistro(null)} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Entendido, corregir</button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
