// import api from "@/lib/axios";
// import { isAxiosError } from "axios";
// import type {
//   CuentaPerfilFormData,
// } from "@/components/perfilUsuario/CuentaPerfilForm";
// import {
//   LoginResponseSchema,
//   PerfilUsuarioArraySchema,
//   PerfilUsuarioSchema,
//   PerfilUsuarioSafeSchema,
//   type LoginForm,
//   type PerfilPersonalForm,
//   type PerfilUsuarioForm,
// } from "@/types/PerfilUsuarioType";

// /* =========================================
//    MENSAJE DE ERROR
// ========================================= */

// function getErrorMessage(
//   error: unknown,
//   defaultMessage: string,
// ): string {
//   if (
//     isAxiosError(error) &&
//     error.response
//   ) {
//     const data = error.response.data as {
//       error?: unknown;
//       message?: unknown;
//     };

//     if (typeof data.error === "string") {
//       return data.error;
//     }

//     if (typeof data.message === "string") {
//       return data.message;
//     }
//   }

//   if (error instanceof Error) {
//     return error.message;
//   }

//   return defaultMessage;
// }

// /* =========================================
//    CREAR PERFIL USUARIO
// ========================================= */

// export async function createPerfilUsuario(
//   formData: PerfilUsuarioForm,
// ) {
//   try {
//     const { data } = await api.post(
//       "/perfilusuario/registro",
//       formData,
//     );

//     return data as {
//       message: string;
//     };
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error creando perfil de usuario",
//       ),
//     );
//   }
// }


// export async function createCuentaPerfil(
//   datos: CuentaPerfilFormData,
// ) {
//   try {
//     const formData = new FormData();

//     formData.append(
//       "nombres",
//       datos.nombres.trim(),
//     );

//     formData.append(
//       "apellidoPaterno",
//       datos.apellidoPaterno.trim(),
//     );

//     formData.append(
//       "apellidoMaterno",
//       datos.apellidoMaterno.trim(),
//     );

//     formData.append(
//       "ci",
//       datos.ci.trim(),
//     );

//     formData.append(
//       "complementoCi",
//       datos.complementoCi.trim(),
//     );

//     formData.append(
//       "expedidoCi",
//       datos.expedidoCi.trim(),
//     );

//     formData.append(
//       "fechaNacimiento",
//       datos.fechaNacimiento,
//     );

//     formData.append(
//       "sexo",
//       datos.sexo,
//     );

//     formData.append(
//       "telefono",
//       datos.telefono.trim(),
//     );

//     formData.append(
//       "email",
//       datos.email
//         .trim()
//         .toLowerCase(),
//     );

//     formData.append(
//       "tipoOrigen",
//       datos.tipoOrigen,
//     );

//     formData.append(
//       "tipoFraterno",
//       datos.tipoFraterno,
//     );

//     formData.append(
//       "registroUniversitario",
//       datos.registroUniversitario.trim(),
//     );

//     formData.append(
//       "facultad",
//       datos.facultad.trim(),
//     );

//     formData.append(
//       "carrera",
//       datos.carrera.trim(),
//     );

//     formData.append(
//       "password",
//       datos.password,
//     );

//     if (datos.fotoPerfil) {
//       const nombreSeguro =
//         datos.ci
//           .trim()
//           .replace(
//             /[^a-zA-Z0-9_-]/g,
//             "",
//           );

//       const archivoRenombrado =
//         new File(
//           [datos.fotoPerfil],
//           `${nombreSeguro}.webp`,
//           {
//             type:
//               datos.fotoPerfil.type ||
//               "image/webp",
//           },
//         );

//       formData.append(
//         "fotoPerfil",
//         archivoRenombrado,
//       );
//     }

//     const { data } =
//       await api.post(
//         "/perfilusuario/registro",
//         formData,
//       );

//     return data;

//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "No se pudo registrar la cuenta",
//       ),
//     );
//   }
// }

// /* =========================================
//    OBTENER TODOS LOS PERFILES
// ========================================= */

// export async function getPerfilUsuarios() {
//   try {
//     const { data } = await api.get(
//       "/perfilusuario",
//     );

//     console.log(data)
//     const response =
//       PerfilUsuarioArraySchema.safeParse(data);
// console.log(response)
//     if (!response.success) {
//       console.error(
//         "Error Zod al validar perfiles:",
//         response.error.format(),
//       );

//       console.error(
//         "Datos recibidos:",
//         data,
//       );

//       throw new Error(
//         "La respuesta de perfiles no tiene el formato esperado",
//       );
//     }

//     return response.data;
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error obteniendo perfiles de usuario",
//       ),
//     );
//   }
// }

// /* =========================================
//    OBTENER PERFIL POR ID
// ========================================= */

// export async function getPerfilUsuarioById(
//   id: string,
// ) {
//   try {
//     if (!id) {
//       throw new Error(
//         "El ID del perfil es obligatorio",
//       );
//     }

//     const { data } = await api.get(
//       `/perfilusuario/${id}`,
//     );

//     const response =
//       PerfilUsuarioSchema.safeParse(data);

//     if (!response.success) {
//       console.error(
//         "Error Zod al validar perfil:",
//         response.error.format(),
//       );

//       console.error(
//         "Datos recibidos:",
//         data,
//       );

//       throw new Error(
//         "La respuesta del perfil no tiene el formato esperado",
//       );
//     }

//     return response.data;
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error obteniendo perfil de usuario",
//       ),
//     );
//   }
// }

// /* =========================================
//    ACTUALIZAR PERFIL USUARIO
// ========================================= */

// type UpdatePerfilUsuarioType = {
//   perfilUsuarioId: string;
//   formData: Partial<PerfilUsuarioForm>;
// };

// export async function updatePerfilUsuario({
//   perfilUsuarioId,
//   formData,
// }: UpdatePerfilUsuarioType) {
//   try {
//     if (!perfilUsuarioId) {
//       throw new Error(
//         "El ID del perfil es obligatorio",
//       );
//     }

//     const { data } = await api.put(
//       `/perfilusuario/${perfilUsuarioId}`,
//       formData,
//     );

//     return data as {
//       message: string;
//     };
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error actualizando perfil de usuario",
//       ),
//     );
//   }
// }

// /* =========================================
//    ELIMINAR PERFIL LÓGICAMENTE
// ========================================= */

// export async function deletePerfilUsuario(
//   id: string,
// ) {
//   try {
//     if (!id) {
//       throw new Error(
//         "El ID del perfil es obligatorio",
//       );
//     }

//     const { data } = await api.delete(
//       `/perfilusuario/${id}`,
//     );

//     return data as {
//       message: string;
//     };
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error eliminando perfil de usuario",
//       ),
//     );
//   }
// }

// /* =========================================
//    LOGIN
// ========================================= */

// export async function loginPerfilUsuario(
//   formData: LoginForm,
// ) {
//   try {
//     const { data } = await api.post(
//       "/perfilusuario/login",
//       {
//         email: formData.email
//           .trim()
//           .toLowerCase(),

//         password: formData.password,
//       },
//     );

//     const response =
//       LoginResponseSchema.safeParse(data);

//     if (!response.success) {
//       console.error(
//         "Error Zod al validar login:",
//         response.error.format(),
//       );

//       console.error(
//         "Datos recibidos:",
//         data,
//       );

//       throw new Error(
//         "La respuesta del login no tiene el formato esperado",
//       );
//     }

//     localStorage.setItem(
//       "AUTH_TOKEN",
//       response.data.tokenjwt,
//     );

//     localStorage.setItem(
//       "AUTH_USER",
//       JSON.stringify(
//         response.data.usuario,
//       ),
//     );

//     return response.data;
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error iniciando sesión",
//       ),
//     );
//   }
// }

// /* =========================================
//    OBTENER USUARIO AUTENTICADO
// ========================================= */

// export async function getUsuarioAutenticado() {
//   try {
//     const { data } = await api.get(
//       "/perfilusuario/usuario",
//     );

//     const response =
//       PerfilUsuarioSafeSchema.safeParse(data);

//     if (!response.success) {
//       console.error(
//         "Error Zod al validar usuario autenticado:",
//         response.error.format(),
//       );

//       console.error(
//         "Datos recibidos:",
//         data,
//       );

//       throw new Error(
//         "La respuesta del usuario no tiene el formato esperado",
//       );
//     }

//     return response.data;
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error obteniendo usuario autenticado",
//       ),
//     );
//   }
// }

// /* =========================================
//    ACTUALIZAR CONTRASEÑA
// ========================================= */

// type UpdatePasswordType = {
//   id: string;
//   passwordActual: string;
//   passwordNueva: string;
// };

// export async function updatePasswordPerfilUsuario({
//   id,
//   passwordActual,
//   passwordNueva,
// }: UpdatePasswordType) {
//   try {
//     if (!id) {
//       throw new Error(
//         "El ID del usuario es obligatorio",
//       );
//     }

//     const { data } = await api.put(
//       `/perfilusuario/password/${id}`,
//       {
//         passwordActual,
//         passwordNueva,
//       },
//     );

//     return data as {
//       message: string;
//     };
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error actualizando contraseña",
//       ),
//     );
//   }
// }

// /* =========================================
//    ACTUALIZAR PERFIL PERSONAL
// ========================================= */

// type UpdatePerfilPersonalType = {
//   perfilUsuarioId: string;
//   formData: PerfilPersonalForm;
// };

// export async function updatePerfilPersonal({
//   perfilUsuarioId,
//   formData,
// }: UpdatePerfilPersonalType) {
//   try {
//     if (!perfilUsuarioId) {
//       throw new Error(
//         "El ID del perfil es obligatorio",
//       );
//     }

//     const { data } = await api.put(
//       `/perfilusuario/${perfilUsuarioId}`,
//       formData,
//     );

//     return data as {
//       message: string;
//     };
//   } catch (error) {
//     throw new Error(
//       getErrorMessage(
//         error,
//         "Error actualizando perfil personal",
//       ),
//     );
//   }
// }
import api from "@/lib/axios";
import { isAxiosError } from "axios";

import {
  ActualizarPerfilResponseSchema,
  LoginResponseSchema,
  LoginSchema,
  PerfilPorIdResponseSchema,
  PerfilUsuarioSchema,
  PerfilesResponseSchema,
  RegistrarCuentaResponseSchema,
} from "@/types/PerfilUsuarioType";

import type {
  ActualizarPerfilForm,
  ActualizarPerfilResponse,
  CambiarPasswordForm,
  LoginForm,
  LoginResponse,
  PerfilPorIdResponse,
  PerfilUsuarioDetalleType,
  PerfilUsuarioForm,
  PerfilUsuarioType,
  PerfilesResponse,
  RegistrarCuentaResponse,
} from "@/types/PerfilUsuarioType";

import { ObjectIdSchema } from "@/types/CommonType";

import {
  obtenerMensajeError,
} from "./apiError";

const PERFIL_URL =
  "/perfilusuario";

export type ErrorRegistroCuenta = Error & {
  tipo?: "DUPLICADO" | "ARCHIVO" | "DATO" | "TOKEN";
  campo?: string;
  archivo?: string;
  accion?: string;
};

/* =========================================
   HELPERS DE FORMDATA
========================================= */

function appendTextoOpcional(
  formData: FormData,
  campo: string,
  valor:
    | string
    | undefined
    | null,
): void {
  if (
    valor === undefined ||
    valor === null
  ) {
    return;
  }

  const texto =
    valor.trim();

  if (!texto) {
    return;
  }

  formData.append(
    campo,
    texto,
  );
}

function appendBooleanoOpcional(
  formData: FormData,
  campo: string,
  valor:
    | boolean
    | undefined,
): void {
  if (
    valor === undefined
  ) {
    return;
  }

  formData.append(
    campo,
    String(valor),
  );
}

function crearFormDataRegistro(
  datos: PerfilUsuarioForm,
): FormData {
  const formData =
    new FormData();

  appendTextoOpcional(formData, "tokenRegistro", datos.tokenRegistro);

  /*
   * Las rutas aceptan roles y gestion
   * como arreglos JSON dentro de multipart.
   */
  formData.append(
    "roles",
    JSON.stringify(
      datos.roles,
    ),
  );

  formData.append(
    "gestion",
    JSON.stringify(
      datos.gestion,
    ),
  );

  formData.append(
    "nombres",
    datos.nombres.trim(),
  );

  formData.append(
    "apellidoPaterno",
    datos.apellidoPaterno.trim(),
  );

  appendTextoOpcional(
    formData,
    "apellidoMaterno",
    datos.apellidoMaterno,
  );

  formData.append(
    "ci",
    datos.ci.trim(),
  );

  appendTextoOpcional(
    formData,
    "complementoCi",
    datos.complementoCi,
  );

  appendTextoOpcional(
    formData,
    "expedidoCi",
    datos.expedidoCi,
  );

  appendTextoOpcional(
    formData,
    "fechaNacimiento",
    datos.fechaNacimiento,
  );

  appendTextoOpcional(
    formData,
    "sexo",
    datos.sexo,
  );

  formData.append(
    "telefono",
    datos.telefono.trim(),
  );

  formData.append(
    "email",
    datos.email
      .trim()
      .toLowerCase(),
  );

  formData.append(
    "tipoOrigen",
    datos.tipoOrigen,
  );

  formData.append(
    "tipoFraterno",
    datos.tipoFraterno,
  );

  appendTextoOpcional(
    formData,
    "registroUniversitario",
    datos.registroUniversitario,
  );

  appendTextoOpcional(
    formData,
    "facultad",
    datos.facultad,
  );

  appendTextoOpcional(
    formData,
    "carrera",
    datos.carrera,
  );

  formData.append(
    "password",
    datos.password,
  );

  if (datos.fotoPerfil) {
    formData.append(
      "fotoPerfil",
      datos.fotoPerfil,
    );
  }

  if (datos.carnetIdentidadPdf) {
    formData.append(
      "carnetIdentidadPdf",
      datos.carnetIdentidadPdf,
    );
  }
  if (datos.carnetIdentidadReverso) formData.append("carnetIdentidadReverso", datos.carnetIdentidadReverso);

  if (datos.registroUniversitarioPdf) {
    formData.append(
      "registroUniversitarioPdf",
      datos.registroUniversitarioPdf,
    );
  }

  return formData;
}

function crearFormDataActualizacion(
  datos: ActualizarPerfilForm,
): FormData {
  const formData =
    new FormData();

  if (datos.roles) {
    formData.append(
      "roles",
      JSON.stringify(
        datos.roles,
      ),
    );
  }

  if (datos.gestion) {
    formData.append(
      "gestion",
      JSON.stringify(
        datos.gestion,
      ),
    );
  }

  appendTextoOpcional(
    formData,
    "nombres",
    datos.nombres,
  );

  appendTextoOpcional(
    formData,
    "apellidoPaterno",
    datos.apellidoPaterno,
  );

  appendTextoOpcional(
    formData,
    "apellidoMaterno",
    datos.apellidoMaterno,
  );

  appendTextoOpcional(
    formData,
    "ci",
    datos.ci,
  );

  appendTextoOpcional(
    formData,
    "complementoCi",
    datos.complementoCi,
  );

  appendTextoOpcional(
    formData,
    "expedidoCi",
    datos.expedidoCi,
  );

  appendTextoOpcional(
    formData,
    "fechaNacimiento",
    datos.fechaNacimiento,
  );

  appendTextoOpcional(
    formData,
    "sexo",
    datos.sexo,
  );

  appendTextoOpcional(
    formData,
    "telefono",
    datos.telefono,
  );

  if (datos.email) {
    formData.append(
      "email",
      datos.email
        .trim()
        .toLowerCase(),
    );
  }

  if (datos.fotoPerfil) {
    formData.append(
      "fotoPerfil",
      datos.fotoPerfil,
    );
  }

  appendTextoOpcional(
    formData,
    "tipoOrigen",
    datos.tipoOrigen,
  );

  appendTextoOpcional(
    formData,
    "tipoFraterno",
    datos.tipoFraterno,
  );

  appendTextoOpcional(
    formData,
    "registroUniversitario",
    datos.registroUniversitario,
  );

  appendTextoOpcional(
    formData,
    "facultad",
    datos.facultad,
  );

  appendTextoOpcional(
    formData,
    "carrera",
    datos.carrera,
  );

  appendTextoOpcional(
    formData,
    "estado",
    datos.estado,
  );

  appendBooleanoOpcional(
    formData,
    "emailVerificado",
    datos.emailVerificado,
  );

  appendBooleanoOpcional(
    formData,
    "requiereCambioPassword",
    datos.requiereCambioPassword,
  );

  return formData;
}

/* =========================================
   REGISTRAR CUENTA
========================================= */

export async function createCuentaPerfil(
  datos: PerfilUsuarioForm,
): Promise<RegistrarCuentaResponse> {
  try {
    const formData =
      crearFormDataRegistro(
        datos,
      );

    const { data } =
      await api.post(
        `${PERFIL_URL}/registro`,
        formData,
      );

    /*
     * No se establece Content-Type manualmente.
     * Axios agrega automáticamente el boundary
     * correcto para multipart/form-data.
     */
    return RegistrarCuentaResponseSchema.parse(
      data,
    );
  } catch (error) {
    const resultado = new Error(
      obtenerMensajeError(error, "No se pudo registrar la cuenta"),
    ) as ErrorRegistroCuenta;
    if (isAxiosError(error) && error.response?.data && typeof error.response.data === "object") {
      const detalle = error.response.data as Partial<ErrorRegistroCuenta>;
      resultado.tipo = detalle.tipo;
      resultado.campo = detalle.campo;
      resultado.archivo = detalle.archivo;
      resultado.accion = detalle.accion;
    }
    throw resultado;
  }
}

/*
 * Alias para conservar compatibilidad con
 * componentes que utilizaban este nombre.
 */
export const createPerfilUsuario =
  createCuentaPerfil;

/* =========================================
   OBTENER TODOS LOS PERFILES
========================================= */

export async function getPerfilUsuariosResponse(): Promise<
  PerfilesResponse
> {
  try {
    const { data } =
      await api.get(
        PERFIL_URL,
      );

    return PerfilesResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo los perfiles de usuario",
      ),
    );
  }
}

/*
 * Conserva el comportamiento anterior:
 * devuelve directamente el arreglo.
 */
export async function getPerfilUsuarios(): Promise<
  PerfilUsuarioType[]
> {
  const respuesta =
    await getPerfilUsuariosResponse();

  return respuesta.perfiles;
}

/* =========================================
   OBTENER PERFIL COMPLETO POR ID
========================================= */

export async function getPerfilUsuarioByIdResponse(
  id: string,
): Promise<PerfilPorIdResponse> {
  try {
    const perfilId =
      ObjectIdSchema.parse(
        id,
      );

    const { data } =
      await api.get(
        `${PERFIL_URL}/${perfilId}`,
      );

    /*
     * Esta respuesta incluye:
     * - datos del perfil
     * - roles poblados
     * - gestiones pobladas
     * - documentos del usuario
     */
    return PerfilPorIdResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo el perfil de usuario",
      ),
    );
  }
}

/*
 * Devuelve directamente el perfil completo,
 * incluidos sus documentos.
 */
export async function getPerfilUsuarioById(
  id: string,
): Promise<PerfilUsuarioDetalleType> {
  const respuesta =
    await getPerfilUsuarioByIdResponse(
      id,
    );

  return respuesta.perfil;
}

/* =========================================
   ACTUALIZAR PERFIL
========================================= */

export async function updatePerfilUsuario({
  perfilUsuarioId,
  formData,
}: {
  perfilUsuarioId:
    string;

  formData:
    ActualizarPerfilForm;
}): Promise<ActualizarPerfilResponse> {
  try {
    const perfilId =
      ObjectIdSchema.parse(
        perfilUsuarioId,
      );

    const multipart =
      crearFormDataActualizacion(
        formData,
      );

    const { data } =
      await api.put(
        `${PERFIL_URL}/${perfilId}`,
        multipart,
      );

    return ActualizarPerfilResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error actualizando el perfil de usuario",
      ),
    );
  }
}

/*
 * Alias para formularios personales.
 */
export async function updatePerfilPersonal({
  perfilUsuarioId,
  formData,
}: {
  perfilUsuarioId:
    string;

  formData:
    ActualizarPerfilForm;
}): Promise<ActualizarPerfilResponse> {
  return updatePerfilUsuario({
    perfilUsuarioId,
    formData,
  });
}

export async function autorizarEdicionPerfil(perfilUsuarioId: string, datos: { motivo: string; campos: string[]; horasVigencia?: number }) {
  const { data } = await api.post(`${PERFIL_URL}/${perfilUsuarioId}/autorizaciones-edicion`, {
    motivo: datos.motivo,
    horasVigencia: datos.horasVigencia ?? 48,
    campos: datos.campos,
  });
  return data as { message: string };
}

export async function generarPasswordTemporal(perfilUsuarioId: string) {
  const { data } = await api.post(`${PERFIL_URL}/password-temporal/${perfilUsuarioId}`);
  return data as { message: string; passwordTemporal: string; usuario: string };
}

/* =========================================
   ELIMINAR PERFIL LÓGICAMENTE
========================================= */

export async function deletePerfilUsuario(
  id: string,
  ciConfirmacion: string,
): Promise<{
  message:
    string;
}> {
  try {
    const perfilId =
      ObjectIdSchema.parse(
        id,
      );

    const { data } =
      await api.delete<{
        message?: string;
      }>(
        `${PERFIL_URL}/${perfilId}`,
        { data: { ciConfirmacion } },
      );

    return {
      message:
        data.message ||
        "Perfil eliminado correctamente",
    };
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error eliminando el perfil de usuario",
      ),
    );
  }
}

/* =========================================
   LOGIN
========================================= */

export async function loginPerfilUsuario(
  formulario: LoginForm,
): Promise<LoginResponse> {
  try {
    const credenciales =
      LoginSchema.parse(
        formulario,
      );

    const { data } =
      await api.post(
        `${PERFIL_URL}/login`,
        {
          email:
            credenciales.email
              .trim()
              .toLowerCase(),

          password:
            credenciales.password,
        },
      );

    const respuesta =
      LoginResponseSchema.parse(
        data,
      );

    if (
      typeof window !==
      "undefined"
    ) {
      localStorage.setItem(
        "AUTH_TOKEN",
        respuesta.tokenjwt,
      );

      localStorage.setItem(
        "AUTH_USER",
        JSON.stringify(
          respuesta.usuario,
        ),
      );
    }

    return respuesta;
  } catch (error) {
    if (isAxiosError(error)) {
      const data = error.response?.data as { codigo?: unknown; error?: unknown } | undefined;
      throw new ErrorLogin(
        typeof data?.error === "string" ? data.error : obtenerMensajeError(error, "Error iniciando sesión"),
        typeof data?.codigo === "string" ? data.codigo : "ERROR_LOGIN",
      );
    }
    throw new ErrorLogin(obtenerMensajeError(error, "Error iniciando sesión"), "ERROR_LOGIN");
  }
}

export class ErrorLogin extends Error {
  constructor(message: string, public readonly codigo: string) {
    super(message);
    this.name = "ErrorLogin";
  }
}

/* =========================================
   OBTENER USUARIO AUTENTICADO
========================================= */

export async function getUsuarioAutenticado(): Promise<
  PerfilUsuarioType
> {
  try {
    const { data } =
      await api.get(
        `${PERFIL_URL}/usuario`,
      );

    return PerfilUsuarioSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo el usuario autenticado",
      ),
    );
  }
}

/* =========================================
   ACTUALIZAR CONTRASEÑA
========================================= */

export async function updatePasswordPerfilUsuario({
  id,
  passwordActual,
  passwordNueva,
}: {
  id:
    string;

  passwordActual:
    string;

  passwordNueva:
    string;
}): Promise<{
  message:
    string;
}> {
  try {
    const perfilId =
      ObjectIdSchema.parse(
        id,
      );

    const payload: CambiarPasswordForm = {
      passwordActual,
      passwordNueva,
    };

    const { data } =
      await api.put<{
        message?: string;
      }>(
        `${PERFIL_URL}/password/${perfilId}`,
        payload,
      );

    return {
      message:
        data.message ||
        "Contraseña actualizada correctamente",
    };
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error actualizando la contraseña",
      ),
    );
  }
}
