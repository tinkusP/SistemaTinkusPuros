import { isAxiosError } from "axios";

import api from "@/lib/axios";

import {
  ActualizarInscripcionSchema,
  CambiarEstadoInscripcionSchema,
  CrearInscripcionAdministrativaSchema,
  CrearMiInscripcionSchema,
  EliminarInscripcionResponseSchema,
  FiltrosInscripcionSchema,
  InscripcionResponseSchema,
  ListaInscripcionesResponseSchema,
  type ActualizarInscripcionForm,
  type CambiarEstadoInscripcionForm,
  type CrearInscripcionAdministrativaForm,
  type CrearMiInscripcionForm,
  type FiltrosInscripcion,
  type Inscripcion,
  type InscripcionResponse,
  type ListaInscripcionesResponse,
} from "@/types/InscripcionType";

/* =====================================================
   TIPOS AUXILIARES
===================================================== */

type ApiErrorResponse = {
  error?: string;
  message?: string;
  detalle?: string;
  errors?: Array<{
    msg?: string;
    message?: string;
    path?: string;
    param?: string;
  }>;
};

type ObtenerInscripcionParams = {
  id: string;
};

type ObtenerMiInscripcionParams = {
  gestionId?: string;
};

type ActualizarInscripcionParams = {
  id: string;
  formData: ActualizarInscripcionForm;
};

type CambiarEstadoInscripcionParams = {
  id: string;
  formData: CambiarEstadoInscripcionForm;
};

type EliminarInscripcionParams = {
  id: string;
};

/* =====================================================
   HELPERS
===================================================== */

/**
 * Limpia propiedades vacías antes de enviar datos al backend.
 *
 * Conserva:
 * - false
 * - 0
 *
 * Elimina:
 * - undefined
 * - null
 * - strings vacíos
 */
function limpiarPayload<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (
        typeof value === "string" &&
        value.trim() === ""
      ) {
        return false;
      }

      return true;
    }),
  ) as Partial<T>;
}

/**
 * Devuelve un mensaje entendible cuando Axios
 * o el backend generan un error.
 */
function obtenerMensajeError(
  error: unknown,
  mensajePredeterminado: string,
): string {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    if (error instanceof Error) {
      return error.message;
    }

    return mensajePredeterminado;
  }

  const respuesta = error.response?.data;

  const primerErrorValidacion =
    respuesta?.errors?.[0]?.msg ??
    respuesta?.errors?.[0]?.message;

  return (
    respuesta?.error ??
    respuesta?.message ??
    primerErrorValidacion ??
    respuesta?.detalle ??
    mensajePredeterminado
  );
}

/**
 * Construye los parámetros del listado sin mandar
 * propiedades vacías en la URL.
 */
function construirParametrosInscripcion(
  filtros: FiltrosInscripcion,
): Record<string, string | number> {
  const parametros: Record<string, string | number> = {};

  if (filtros.gestionId?.trim()) {
    parametros.gestionId = filtros.gestionId.trim();
  }

  if (filtros.postulanteId?.trim()) {
    parametros.postulanteId = filtros.postulanteId.trim();
  }

  if (filtros.estado) {
    parametros.estado = filtros.estado;
  }

  if (filtros.tipoInscripcion) {
    parametros.tipoInscripcion = filtros.tipoInscripcion;
  }

  if (filtros.origenInscripcion) {
    parametros.origenInscripcion = filtros.origenInscripcion;
  }

  if (filtros.busqueda?.trim()) {
    parametros.busqueda = filtros.busqueda.trim();
  }

  parametros.pagina = filtros.pagina;
  parametros.limite = filtros.limite;

  return parametros;
}

/* =====================================================
   CREAR MI INSCRIPCIÓN
   POST /api/inscripciones/mi-inscripcion
===================================================== */

export async function crearMiInscripcion(
  formData: CrearMiInscripcionForm,
): Promise<InscripcionResponse> {
  try {
    const datosValidados =
      CrearMiInscripcionSchema.parse(formData);

    const payload = limpiarPayload({
      ...datosValidados,

      gestionId:
        datosValidados.gestionId?.trim() || undefined,

      versionReglamento:
        datosValidados.versionReglamento?.trim() ||
        undefined,

      observacionPostulante:
        datosValidados.observacionPostulante?.trim() ||
        undefined,
    });

    const { data } = await api.post(
      "/inscripciones/mi-inscripcion",
      payload,
    );

    return InscripcionResponseSchema.parse(data);
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo crear la inscripción",
      ),
    );
  }
}

/* =====================================================
   OBTENER MI INSCRIPCIÓN
   GET /api/inscripciones/mi-inscripcion
===================================================== */

export async function obtenerMiInscripcion({
  gestionId,
}: ObtenerMiInscripcionParams = {}): Promise<Inscripcion> {
  try {
    const { data } = await api.get(
      "/inscripciones/mi-inscripcion",
      {
        params: gestionId?.trim()
          ? {
              gestionId: gestionId.trim(),
            }
          : undefined,
      },
    );

    const respuesta =
      InscripcionResponseSchema.parse(data);

    return respuesta.inscripcion;
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo obtener tu inscripción",
      ),
    );
  }
}

/* =====================================================
   CREAR INSCRIPCIÓN ADMINISTRATIVA
   POST /api/inscripciones
===================================================== */

export async function crearInscripcionAdministrativa(
  formData: CrearInscripcionAdministrativaForm,
): Promise<InscripcionResponse> {
  try {
    const datosValidados =
      CrearInscripcionAdministrativaSchema.parse(
        formData,
      );

    const payload = limpiarPayload({
      ...datosValidados,

      gestionId: datosValidados.gestionId.trim(),

      postulanteId:
        datosValidados.postulanteId.trim(),

      versionReglamento:
        datosValidados.versionReglamento?.trim() ||
        undefined,

      observacionPostulante:
        datosValidados.observacionPostulante?.trim() ||
        undefined,
    });

    const { data } = await api.post(
      "/inscripciones",
      payload,
    );

    return InscripcionResponseSchema.parse(data);
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo crear la inscripción administrativa",
      ),
    );
  }
}

/* =====================================================
   OBTENER TODAS LAS INSCRIPCIONES
   GET /api/inscripciones
===================================================== */

export async function obtenerInscripciones(
  filtros: Partial<FiltrosInscripcion> = {},
): Promise<ListaInscripcionesResponse> {
  try {
    const filtrosValidados =
      FiltrosInscripcionSchema.parse({
        pagina: 1,
        limite: 20,
        ...filtros,
      });

    const parametros =
      construirParametrosInscripcion(
        filtrosValidados,
      );

    const { data } = await api.get(
      "/inscripciones",
      {
        params: parametros,
      },
    );

    return ListaInscripcionesResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudieron obtener las inscripciones",
      ),
    );
  }
}

/* =====================================================
   OBTENER INSCRIPCIÓN POR ID
   GET /api/inscripciones/:id
===================================================== */

export async function obtenerInscripcionPorId({
  id,
}: ObtenerInscripcionParams): Promise<Inscripcion> {
  try {
    if (!id?.trim()) {
      throw new Error(
        "El ID de la inscripción es obligatorio",
      );
    }

    const { data } = await api.get(
      `/inscripciones/${id.trim()}`,
    );

    const respuesta =
      InscripcionResponseSchema.parse(data);

    return respuesta.inscripcion;
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo obtener la inscripción",
      ),
    );
  }
}

/* =====================================================
   ACTUALIZAR INSCRIPCIÓN
   PUT /api/inscripciones/:id
===================================================== */

export async function actualizarInscripcion({
  id,
  formData,
}: ActualizarInscripcionParams): Promise<InscripcionResponse> {
  try {
    if (!id?.trim()) {
      throw new Error(
        "El ID de la inscripción es obligatorio",
      );
    }

    const datosValidados =
      ActualizarInscripcionSchema.parse(formData);

    const payload = limpiarPayload({
      ...datosValidados,

      versionReglamento:
        datosValidados.versionReglamento?.trim() ||
        undefined,

      observacionPostulante:
        datosValidados.observacionPostulante?.trim() ||
        undefined,

      observacionRevision:
        datosValidados.observacionRevision?.trim() ||
        undefined,
    });

    const { data } = await api.put(
      `/inscripciones/${id.trim()}`,
      payload,
    );

    return InscripcionResponseSchema.parse(data);
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo actualizar la inscripción",
      ),
    );
  }
}

/* =====================================================
   CAMBIAR ESTADO DE INSCRIPCIÓN
   PATCH /api/inscripciones/:id/estado
===================================================== */

export async function cambiarEstadoInscripcion({
  id,
  formData,
}: CambiarEstadoInscripcionParams): Promise<InscripcionResponse> {
  try {
    if (!id?.trim()) {
      throw new Error(
        "El ID de la inscripción es obligatorio",
      );
    }

    const datosValidados =
      CambiarEstadoInscripcionSchema.parse(formData);

    const payload = limpiarPayload({
      ...datosValidados,

      observacionRevision:
        datosValidados.observacionRevision?.trim() ||
        undefined,

      motivoRechazo:
        datosValidados.motivoRechazo?.trim() ||
        undefined,

      motivoCancelacion:
        datosValidados.motivoCancelacion?.trim() ||
        undefined,

      motivoListaEspera:
        datosValidados.motivoListaEspera?.trim() ||
        undefined,
    });

    const { data } = await api.patch(
      `/inscripciones/${id.trim()}/estado`,
      payload,
    );

    return InscripcionResponseSchema.parse(data);
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo cambiar el estado de la inscripción",
      ),
    );
  }
}

/* =====================================================
   ELIMINAR INSCRIPCIÓN
   DELETE /api/inscripciones/:id
===================================================== */

export async function eliminarInscripcion({
  id,
}: EliminarInscripcionParams): Promise<string> {
  try {
    if (!id?.trim()) {
      throw new Error(
        "El ID de la inscripción es obligatorio",
      );
    }

    const { data } = await api.delete(
      `/inscripciones/${id.trim()}`,
    );

    const respuesta =
      EliminarInscripcionResponseSchema.parse(data);

    return respuesta.message;
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "No se pudo eliminar la inscripción",
      ),
    );
  }
}