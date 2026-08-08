import api from "@/lib/axios";

import {
  ActualizarGestionSchema,
  CrearGestionSchema,
  GestionResponseSchema,
  ObtenerGestionesResponseSchema,
} from "@/types/GestionType";

import type {
  ActualizarGestionForm,
  ActualizarGestionResponse,
  CambiarEstadoGestionPayload,
  CrearGestionResponse,
  FiltrosGestion,
  GestionFormulario,
  ObtenerGestionResponse,
  ObtenerGestionesResponse,
} from "@/types/GestionType";

import { ObjectIdSchema } from "@/types/CommonType";

import {
  obtenerMensajeError,
} from "./apiError";

const GESTION_URL =
  "/gestiones";

/* =========================================
   OBTENER GESTIONES
========================================= */

export async function obtenerGestiones(
  filtros: FiltrosGestion = {},
): Promise<ObtenerGestionesResponse> {
  try {
    const params =
      new URLSearchParams();

    if (filtros.estado) {
      params.set(
        "estado",
        filtros.estado,
      );
    }

    if (
      filtros.anio !==
        undefined &&
      filtros.anio !==
        ""
    ) {
      params.set(
        "anio",
        String(
          filtros.anio,
        ),
      );
    }

    if (
      filtros.buscar?.trim()
    ) {
      params.set(
        "buscar",
        filtros.buscar.trim(),
      );
    }

    params.set(
      "pagina",
      String(
        filtros.pagina ??
          1,
      ),
    );

    params.set(
      "limite",
      String(
        filtros.limite ??
          10,
      ),
    );

    const { data } =
      await api.get(
        GESTION_URL,
        {
          params,
        },
      );

    return ObtenerGestionesResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo las gestiones",
      ),
    );
  }
}

/* =========================================
   OBTENER GESTIÓN POR ID
========================================= */

export async function obtenerGestionPorId(
  gestionId: string,
): Promise<ObtenerGestionResponse> {
  try {
    const id =
      ObjectIdSchema.parse(
        gestionId,
      );

    const { data } =
      await api.get(
        `${GESTION_URL}/${id}`,
      );

    return GestionResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo la gestión",
      ),
    );
  }
}

/* =========================================
   OBTENER GESTIÓN ACTIVA
========================================= */

export async function obtenerGestionActiva(): Promise<
  ObtenerGestionResponse
> {
  try {
    const { data } =
      await api.get(
        `${GESTION_URL}/activa`,
      );

    return GestionResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error obteniendo la gestión activa",
      ),
    );
  }
}

/* =========================================
   CREAR GESTIÓN
========================================= */

export async function crearGestion(
  formulario: GestionFormulario,
): Promise<CrearGestionResponse> {
  try {
    /*
     * El esquema ya elimina el antiguo
     * cupoMaximo del formulario.
     */
    const payload =
      CrearGestionSchema.parse(
        formulario,
      );

    const { data } =
      await api.post(
        GESTION_URL,
        payload,
      );

    return GestionResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error creando la gestión",
      ),
    );
  }
}

/* =========================================
   ACTUALIZAR GESTIÓN
========================================= */

export async function actualizarGestion({
  gestionId,
  formulario,
}: {
  gestionId:
    string;

  formulario:
    ActualizarGestionForm;
}): Promise<ActualizarGestionResponse> {
  try {
    const id =
      ObjectIdSchema.parse(
        gestionId,
      );

    const payload =
      ActualizarGestionSchema.parse(
        formulario,
      );

    const { data } =
      await api.put(
        `${GESTION_URL}/${id}`,
        payload,
      );

    return GestionResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error actualizando la gestión",
      ),
    );
  }
}

/* =========================================
   CAMBIAR ESTADO
========================================= */

export async function cambiarEstadoGestion({
  gestionId,
  estado,
}: CambiarEstadoGestionPayload): Promise<
  ActualizarGestionResponse
> {
  try {
    const id =
      ObjectIdSchema.parse(
        gestionId,
      );

    const { data } =
      await api.patch(
        `${GESTION_URL}/${id}/estado`,
        {
          estado,
        },
      );

    return GestionResponseSchema.parse(
      data,
    );
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error cambiando el estado de la gestión",
      ),
    );
  }
}

/* =========================================
   ELIMINAR LÓGICAMENTE
========================================= */

export async function eliminarGestion(
  gestionId: string,
): Promise<{
  message:
    string;
}> {
  try {
    const id =
      ObjectIdSchema.parse(
        gestionId,
      );

    const { data } =
      await api.delete<{
        message?: string;
      }>(
        `${GESTION_URL}/${id}`,
      );

    return {
      message:
        data.message ||
        "Gestión eliminada correctamente",
    };
  } catch (error) {
    throw new Error(
      obtenerMensajeError(
        error,
        "Error eliminando la gestión",
      ),
    );
  }
}