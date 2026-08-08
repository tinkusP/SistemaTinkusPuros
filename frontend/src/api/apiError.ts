import axios, {
  type AxiosError,
} from "axios";

type ErrorApi = {
  error?: unknown;
  message?: unknown;
  detalles?: unknown;
  errors?: unknown;
};

/**
 * Obtiene un mensaje uniforme desde los errores
 * devueltos por Axios, Zod o JavaScript.
 */
export function obtenerMensajeError(
  error: unknown,
  mensajePredeterminado =
    "Ocurrió un error al procesar la solicitud",
): string {
  if (axios.isAxiosError(error)) {
    const axiosError =
      error as AxiosError<ErrorApi>;

    const data =
      axiosError.response?.data;

    if (
      typeof data?.error ===
      "string"
    ) {
      return data.error;
    }

    if (
      typeof data?.message ===
      "string"
    ) {
      return data.message;
    }

    if (
      Array.isArray(data?.detalles)
    ) {
      const detalles =
        data.detalles.filter(
          (item): item is string =>
            typeof item ===
            "string",
        );

      if (detalles.length > 0) {
        return detalles.join(", ");
      }
    }

    if (
      Array.isArray(data?.errors)
    ) {
      const errores =
        data.errors.filter(
          (item): item is string =>
            typeof item ===
            "string",
        );

      if (errores.length > 0) {
        return errores.join(", ");
      }
    }

    return (
      axiosError.message ||
      mensajePredeterminado
    );
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return mensajePredeterminado;
}