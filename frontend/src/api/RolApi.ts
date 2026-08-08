// import axios, {
//   AxiosError,
// } from "axios";

// import api from "@/lib/axios";

// import {
//   CrearRolSchema,
//   EditarRolSchema,
//   RolArraySchema,
//   RolResponseSchema,
//   RolSchema,
//   RolesResponseSchema,
  
// } from "@/types/RolType";

// import type {
//   CrearRolForm,
//   EditarRolForm,
//   RolType,
//   RolOption,
// } from "@/types/RolType";

// /* =========================================
//    RUTA BASE
// ========================================= */

// const ROL_URL = "/rol";

// /* =========================================
//    EXTRAER MENSAJE DE ERROR
// ========================================= */

// function obtenerMensajeError(
//   error: unknown,
// ): string {
//   if (
//     axios.isAxiosError(error)
//   ) {
//     const axiosError =
//       error as AxiosError<{
//         message?: string;
//         error?: string;
//       }>;

//     return (
//       axiosError.response?.data
//         ?.message ||
//       axiosError.response?.data
//         ?.error ||
//       axiosError.message ||
//       "Ocurrió un error al procesar la solicitud"
//     );
//   }

//   if (
//     error instanceof Error
//   ) {
//     return error.message;
//   }

//   return "Ocurrió un error inesperado";
// }

// /* =========================================
//    OBTENER TODOS LOS ROLES
// ========================================= */

// export async function obtenerRoles(): Promise<
//   RolType[]
// > {
//   try {
//     const { data } =
//       await api.get(
//         ROL_URL,
//       );

//     /*
//      * Soporta:
//      *
//      * [
//      *   { rol... }
//      * ]
//      *
//      * o:
//      *
//      * {
//      *   roles: [
//      *     { rol... }
//      *   ]
//      * }
//      */

//     if (
//       Array.isArray(data)
//     ) {
//       return RolArraySchema.parse(
//         data,
//       );
//     }

//     const respuesta =
//       RolesResponseSchema.parse(
//         data,
//       );

//     return respuesta.roles;
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    OBTENER ROLES ACTIVOS
// ========================================= */

// export async function obtenerRolesActivos(): Promise<
//   RolType[]
// > {
//   try {
//     const roles =
//       await obtenerRoles();

//     return roles.filter(
//       (rol) =>
//         rol.estado === true &&
//         !rol.fechaEliminado,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }
// /* =========================================
//    OBTENER ROLES PARA FORMULARIOS
// ========================================= */

// export async function obtenerRolesActivosParaFormulario(): Promise<
//   RolOption[]
// > {
//   const roles =
//     await obtenerRolesActivos();

//   return roles.map((rol) => ({
//     _id: String(rol._id),
//     nombre: rol.nombre,
//     codigo: rol.codigo,
//     descripcion: rol.descripcion,
//   }));
// }
// /* =========================================
//    OBTENER ROL POR ID
// ========================================= */

// export async function obtenerRolPorId(
//   rolId: string,
// ): Promise<RolType> {
//   try {
//     const { data } =
//       await api.get(
//         `${ROL_URL}/${rolId}`,
//       );

//     /*
//      * Soporta:
//      *
//      * { rol: {...} }
//      *
//      * o directamente:
//      *
//      * {...}
//      */

//     if (
//       data &&
//       typeof data === "object" &&
//       "rol" in data
//     ) {
//       return RolResponseSchema.parse(
//         data,
//       ).rol;
//     }

//     return RolSchema.parse(
//       data,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    CREAR ROL
// ========================================= */

// export async function crearRol(
//   formData: CrearRolForm,
// ): Promise<RolType> {
//   try {
//     const payload =
//       CrearRolSchema.parse(
//         formData,
//       );

//     const { data } =
//       await api.post(
//         ROL_URL,
//         payload,
//       );

//     if (
//       data &&
//       typeof data === "object" &&
//       "rol" in data
//     ) {
//       return RolResponseSchema.parse(
//         data,
//       ).rol;
//     }

//     return RolSchema.parse(
//       data,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    ACTUALIZAR ROL
// ========================================= */

// export async function actualizarRol(
//   rolId: string,
//   formData: EditarRolForm,
// ): Promise<RolType> {
//   try {
//     const payload =
//       EditarRolSchema.parse(
//         formData,
//       );

//     const { data } =
//       await api.put(
//         `${ROL_URL}/${rolId}`,
//         payload,
//       );

//     if (
//       data &&
//       typeof data === "object" &&
//       "rol" in data
//     ) {
//       return RolResponseSchema.parse(
//         data,
//       ).rol;
//     }

//     return RolSchema.parse(
//       data,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    CAMBIAR ESTADO DEL ROL
// ========================================= */

// export async function cambiarEstadoRol(
//   rolId: string,
//   estado: boolean,
// ): Promise<RolType> {
//   try {
//     const { data } =
//       await api.patch(
//         `${ROL_URL}/${rolId}/estado`,
//         {
//           estado,
//         },
//       );

//     if (
//       data &&
//       typeof data === "object" &&
//       "rol" in data
//     ) {
//       return RolResponseSchema.parse(
//         data,
//       ).rol;
//     }

//     return RolSchema.parse(
//       data,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    ASIGNAR PERMISOS AL ROL
// ========================================= */

// export async function asignarPermisosRol(
//   rolId: string,
//   permisos: string[],
// ): Promise<RolType> {
//   try {
//     const { data } =
//       await api.patch(
//         `${ROL_URL}/${rolId}/permisos`,
//         {
//           permisos,
//         },
//       );

//     if (
//       data &&
//       typeof data === "object" &&
//       "rol" in data
//     ) {
//       return RolResponseSchema.parse(
//         data,
//       ).rol;
//     }

//     return RolSchema.parse(
//       data,
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }

// /* =========================================
//    ELIMINAR ROL
// ========================================= */

// export async function eliminarRol(
//   rolId: string,
// ): Promise<string> {
//   try {
//     const { data } =
//       await api.delete<{
//         message?: string;
//       }>(
//         `${ROL_URL}/${rolId}`,
//       );

//     return (
//       data.message ||
//       "Rol eliminado correctamente"
//     );
//   } catch (error) {
//     throw new Error(
//       obtenerMensajeError(
//         error,
//       ),
//     );
//   }
// }
import api from "@/lib/axios";

import {
  CrearRolSchema,
  EditarRolSchema,
  RolArraySchema,
  RolSchema,
} from "@/types/RolType";

import type {
  CrearRolForm,
  EditarRolForm,
  RolOption,
  RolType,
} from "@/types/RolType";

import { ObjectIdSchema } from "@/types/CommonType";

import {
  obtenerMensajeError,
} from "./apiError";

/* =========================================
   RUTA BASE
========================================= */

const ROL_URL = "/rol";

/* =========================================
   HELPERS DE RESPUESTA
========================================= */

function extraerRol(
  data: unknown,
): RolType {
  if (
    data &&
    typeof data === "object" &&
    "rol" in data
  ) {
    return RolSchema.parse(
      (
        data as {
          rol: unknown;
        }
      ).rol,
    );
  }

  return RolSchema.parse(
    data,
  );
}

function extraerRoles(
  data: unknown,
): RolType[] {
  if (
    Array.isArray(data)
  ) {
    return RolArraySchema.parse(
      data,
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "roles" in data
  ) {
    return RolArraySchema.parse(
      (
        data as {
          roles: unknown;
        }
      ).roles,
    );
  }

  throw new Error(
    "La respuesta de roles no tiene el formato esperado",
  );
}

/* =========================================
   OBTENER TODOS LOS ROLES
========================================= */

export async function obtenerRoles(): Promise<
  RolType[]
> {
  try {
    const { data } =
      await api.get(
        ROL_URL,
      );

    return extraerRoles(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo los roles",
      ),
    );
  }
}

/* =========================================
   OBTENER ROLES ACTIVOS
========================================= */

export async function obtenerRolesActivos(): Promise<
  RolType[]
> {
  const roles =
    await obtenerRoles();

  return roles.filter(
    (rol) =>
      rol.estado === true &&
      !rol.fechaEliminado,
  );
}

/* =========================================
   OPCIONES PARA SELECT
========================================= */

export async function obtenerRolesActivosParaFormulario(): Promise<
  RolOption[]
> {
  const roles =
    await obtenerRolesActivos();

  return roles.map(
    (rol) => ({
      _id:
        rol._id,

      nombre:
        rol.nombre,

      codigo:
        rol.codigo,

      descripcion:
        rol.descripcion,
    }),
  );
}

/* =========================================
   OBTENER ROL POR ID
========================================= */

export async function obtenerRolPorId(
  rolId: string,
): Promise<RolType> {
  try {
    const id =
      ObjectIdSchema.parse(
        rolId,
      );

    const { data } =
      await api.get(
        `${ROL_URL}/${id}`,
      );

    return extraerRol(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo el rol",
      ),
    );
  }
}

/* =========================================
   CREAR ROL
========================================= */

export async function crearRol(
  formulario: CrearRolForm,
): Promise<RolType> {
  try {
    const payload =
      CrearRolSchema.parse(
        formulario,
      );

    const { data } =
      await api.post(
        ROL_URL,
        payload,
      );

    return extraerRol(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error creando el rol",
      ),
    );
  }
}

/* =========================================
   ACTUALIZAR ROL
========================================= */

export async function actualizarRol(
  rolId: string,
  formulario: EditarRolForm,
): Promise<RolType> {
  try {
    const id =
      ObjectIdSchema.parse(
        rolId,
      );

    const payload =
      EditarRolSchema.parse(
        formulario,
      );

    const { data } =
      await api.put(
        `${ROL_URL}/${id}`,
        payload,
      );

    return extraerRol(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error actualizando el rol",
      ),
    );
  }
}

/* =========================================
   CAMBIAR ESTADO
========================================= */

/*
 * En el router actual no existe:
 *
 * PATCH /rol/:id/estado
 *
 * Por eso el cambio de estado se realiza
 * mediante PUT /rol/:id.
 */
export async function cambiarEstadoRol(
  rolId: string,
  estado: boolean,
): Promise<RolType> {
  return actualizarRol(
    rolId,
    {
      estado,
    },
  );
}

/* =========================================
   ASIGNAR PERMISOS
========================================= */

/*
 * En el router actual no existe:
 *
 * PATCH /rol/:id/permisos
 *
 * Los permisos se actualizan mediante
 * PUT /rol/:id.
 */
export async function asignarPermisosRol(
  rolId: string,
  permisos: string[],
): Promise<RolType> {
  return actualizarRol(
    rolId,
    {
      permisos,
    },
  );
}

/* =========================================
   ELIMINAR LÓGICAMENTE
========================================= */

export async function eliminarRol(
  rolId: string,
): Promise<string> {
  try {
    const id =
      ObjectIdSchema.parse(
        rolId,
      );

    const { data } =
      await api.delete<{
        message?: string;
      }>(
        `${ROL_URL}/${id}`,
      );

    return (
      data.message ||
      "Rol eliminado correctamente"
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error eliminando el rol",
      ),
    );
  }
}