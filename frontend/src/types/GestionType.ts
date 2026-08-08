// import { z } from "zod";

// /* ======================================================
//    ESTADOS
// ====================================================== */

// export const ESTADOS_GESTION = [
//   "PLANIFICACION",
//   "INSCRIPCIONES",
//   "ACTIVA",
//   "CERRADA",
// ] as const;

// export type EstadoGestion =
//   (typeof ESTADOS_GESTION)[number];

// /* ======================================================
//    ESQUEMA Y TIPO DEL FORMULARIO
// ====================================================== */

// export const gestionSchema = z
//   .object({
//     anio: z
//       .number({
//         error: "El año es obligatorio y debe ser un número",
//       })
//       .int("El año debe ser un número entero")
//       .min(2020, "El año mínimo permitido es 2020")
//       .max(2100, "El año máximo permitido es 2100"),

//     nombre: z
//       .string({
//         error: "El nombre es obligatorio",
//       })
//       .trim()
//       .min(
//         3,
//         "El nombre debe tener al menos 3 caracteres",
//       )
//       .max(
//         100,
//         "El nombre no debe superar los 100 caracteres",
//       ),

//     descripcion: z
//       .string()
//       .trim()
//       .max(
//         500,
//         "La descripción no debe superar los 500 caracteres",
//       )
//       .optional(),

//     fechaInicio: z
//       .string({
//         error: "La fecha de inicio es obligatoria",
//       })
//       .min(
//         1,
//         "La fecha de inicio es obligatoria",
//       ),

//     fechaFin: z
//       .string({
//         error: "La fecha final es obligatoria",
//       })
//       .min(
//         1,
//         "La fecha de finalización es obligatoria",
//       ),

//     fechaInicioInscripcion: z
//       .string()
//       .optional(),

//     fechaFinInscripcion: z
//       .string()
//       .optional(),

//     cupoMaximo: z
//       .number({
//         error:
//           "El cupo máximo es obligatorio y debe ser un número",
//       })
//       .int(
//         "El cupo máximo debe ser un número entero",
//       )
//       .min(
//         1,
//         "El cupo máximo debe ser mayor a cero",
//       ),

//     estado: z.enum(ESTADOS_GESTION, {
//       error: "El estado de la gestión es obligatorio",
//     }),
//   })
//   .superRefine((datos, contexto) => {
//     if (
//       datos.fechaInicio &&
//       datos.fechaFin &&
//       new Date(datos.fechaFin) <=
//         new Date(datos.fechaInicio)
//     ) {
//       contexto.addIssue({
//         code: "custom",
//         path: ["fechaFin"],
//         message:
//           "La fecha final debe ser posterior a la fecha inicial",
//       });
//     }

//     const tieneInicioInscripcion = Boolean(
//       datos.fechaInicioInscripcion,
//     );

//     const tieneFinInscripcion = Boolean(
//       datos.fechaFinInscripcion,
//     );

//     if (
//       tieneInicioInscripcion !==
//       tieneFinInscripcion
//     ) {
//       contexto.addIssue({
//         code: "custom",
//         path: [
//           tieneInicioInscripcion
//             ? "fechaFinInscripcion"
//             : "fechaInicioInscripcion",
//         ],
//         message:
//           "Debes registrar ambas fechas de inscripción",
//       });
//     }

//     if (
//       datos.fechaInicioInscripcion &&
//       datos.fechaFinInscripcion &&
//       new Date(
//         datos.fechaFinInscripcion,
//       ) <=
//         new Date(
//           datos.fechaInicioInscripcion,
//         )
//     ) {
//       contexto.addIssue({
//         code: "custom",
//         path: ["fechaFinInscripcion"],
//         message:
//           "El cierre de inscripciones debe ser posterior al inicio",
//       });
//     }
//   });

// export type GestionFormulario =
//   z.infer<typeof gestionSchema>;

// /* ======================================================
//    ENTIDAD GESTIÓN
// ====================================================== */

// export interface UsuarioAuditoriaGestion {
//   _id: string;
//   nombres: string;
//   apellidoPaterno?: string;
//   apellidoMaterno?: string;
//   email?: string;
// }

// export interface Gestion {
//   _id: string;

//   anio: number;
//   nombre: string;
//   descripcion?: string | null;

//   fechaInicio: string;
//   fechaFin: string;

//   fechaInicioInscripcion?: string | null;
//   fechaFinInscripcion?: string | null;

//   cupoMaximo: number;
//   estado: EstadoGestion;

//   fechaCreado?: string;

//   usuarioCreador?:
//     | UsuarioAuditoriaGestion
//     | string
//     | null;

//   fechaEdit?: string | null;

//   usuarioEdit?:
//     | UsuarioAuditoriaGestion
//     | string
//     | null;

//   fechaEliminado?: string | null;

//   usuarioEliminador?:
//     | UsuarioAuditoriaGestion
//     | string
//     | null;
// }

// /* ======================================================
//    RESPUESTAS DE LA API
// ====================================================== */

// export interface CrearGestionResponse {
//   message: string;
//   gestion: Gestion;
// }

// export interface ActualizarGestionResponse {
//   message: string;
//   gestion: Gestion;
// }

// export interface ObtenerGestionResponse {
//   gestion: Gestion;
// }

// export interface PaginacionGestion {
//   pagina: number;
//   limite: number;
//   total: number;
//   totalPaginas: number;
// }

// export interface ObtenerGestionesResponse {
//   gestiones: Gestion[];
//   paginacion: PaginacionGestion;
// }

// /* ======================================================
//    FILTROS Y PAYLOADS
// ====================================================== */

// export interface FiltrosGestion {
//   estado?: EstadoGestion | "";
//   anio?: number | "";
//   buscar?: string;
//   pagina?: number;
//   limite?: number;
// }

// export interface ActualizarGestionPayload {
//   gestionId: string;
//   formulario: GestionFormulario;
// }

// export interface CambiarEstadoGestionPayload {
//   gestionId: string;
//   estado: EstadoGestion;
// }
import { z } from "zod";

import {
  FechaApiSchema,
  ObjectIdSchema,
  UsuarioAuditoriaSchema,
} from "./CommonType";

export const ESTADOS_GESTION = [
  "PLANIFICACION",
  "INSCRIPCIONES",
  "ACTIVA",
  "CERRADA",
] as const;

export const EstadoGestionSchema = z.enum(ESTADOS_GESTION);
export type EstadoGestion = z.infer<typeof EstadoGestionSchema>;

export const GestionSchema = z
  .object({
    _id: ObjectIdSchema,
    anio: z.number().int(),
    nombre: z.string().min(1),
    descripcion: z.string().nullable().optional(),
    fechaInicio: FechaApiSchema,
    fechaFin: FechaApiSchema,
    fechaInicioInscripcion: FechaApiSchema.nullable().optional(),
    fechaFinInscripcion: FechaApiSchema.nullable().optional(),
    cupoMaximoHombres: z.number().int().min(0),
    cupoMaximoMujeres: z.number().int().min(0),

    // Solo lectura: el backend calcula este valor.
    cupoMaximo: z.number().int().min(1),

    estado: EstadoGestionSchema,
    fechaCreado: FechaApiSchema.nullable().optional(),
    usuarioCreador: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEdit: FechaApiSchema.nullable().optional(),
    usuarioEdit: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEliminado: FechaApiSchema.nullable().optional(),
    usuarioEliminador: UsuarioAuditoriaSchema.nullable().optional(),
  })
  .passthrough();

export const GestionArraySchema = z.array(GestionSchema);

const CamposGestionFormularioSchema = z.object({
  anio: z
    .number({ error: "El año es obligatorio y debe ser un número" })
    .int("El año debe ser un número entero")
    .min(2020, "El año mínimo permitido es 2020")
    .max(2100, "El año máximo permitido es 2100"),

  nombre: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre no debe superar los 100 caracteres"),

  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción no debe superar los 500 caracteres")
    .optional()
    .or(z.literal("")),

  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  fechaFin: z.string().min(1, "La fecha de finalización es obligatoria"),
  fechaInicioInscripcion: z.string().optional().or(z.literal("")),
  fechaFinInscripcion: z.string().optional().or(z.literal("")),

  cupoMaximoHombres: z
    .number({ error: "El cupo máximo de hombres debe ser un número" })
    .int("El cupo de hombres debe ser un entero")
    .min(0, "El cupo de hombres no puede ser negativo"),

  cupoMaximoMujeres: z
    .number({ error: "El cupo máximo de mujeres debe ser un número" })
    .int("El cupo de mujeres debe ser un entero")
    .min(0, "El cupo de mujeres no puede ser negativo"),

  estado: EstadoGestionSchema,
});

const validarGestion = (
  datos: {
    fechaInicio?: string;
    fechaFin?: string;
    fechaInicioInscripcion?: string;
    fechaFinInscripcion?: string;
    cupoMaximoHombres?: number;
    cupoMaximoMujeres?: number;
  },
  contexto: z.RefinementCtx,
): void => {
  if (
    datos.fechaInicio &&
    datos.fechaFin &&
    new Date(datos.fechaFin) <= new Date(datos.fechaInicio)
  ) {
    contexto.addIssue({
      code: "custom",
      path: ["fechaFin"],
      message: "La fecha final debe ser posterior a la fecha inicial",
    });
  }

  const tieneInicioInscripcion = Boolean(datos.fechaInicioInscripcion);
  const tieneFinInscripcion = Boolean(datos.fechaFinInscripcion);

  if (tieneInicioInscripcion !== tieneFinInscripcion) {
    contexto.addIssue({
      code: "custom",
      path: [
        tieneInicioInscripcion
          ? "fechaFinInscripcion"
          : "fechaInicioInscripcion",
      ],
      message: "Debes registrar ambas fechas de inscripción",
    });
  }

  if (
    datos.fechaInicioInscripcion &&
    datos.fechaFinInscripcion &&
    new Date(datos.fechaFinInscripcion) <=
      new Date(datos.fechaInicioInscripcion)
  ) {
    contexto.addIssue({
      code: "custom",
      path: ["fechaFinInscripcion"],
      message: "El cierre de inscripciones debe ser posterior al inicio",
    });
  }

  if (
    datos.cupoMaximoHombres !== undefined &&
    datos.cupoMaximoMujeres !== undefined &&
    datos.cupoMaximoHombres + datos.cupoMaximoMujeres <= 0
  ) {
    contexto.addIssue({
      code: "custom",
      path: ["cupoMaximoMujeres"],
      message: "La suma de los cupos debe ser mayor a cero",
    });
  }
};

// cupoMaximo no se envía: el backend lo calcula.
export const CrearGestionSchema =
  CamposGestionFormularioSchema.superRefine(validarGestion);

export const ActualizarGestionSchema =
  CamposGestionFormularioSchema.partial().superRefine(validarGestion);

export const GestionResponseSchema = z
  .object({
    message: z.string().optional(),
    gestion: GestionSchema,
  })
  .passthrough();

export const PaginacionGestionSchema = z.object({
  pagina: z.number().int(),
  limite: z.number().int(),
  total: z.number().int(),
  totalPaginas: z.number().int(),
});

export const ObtenerGestionesResponseSchema = z.object({
  gestiones: GestionArraySchema,
  paginacion: PaginacionGestionSchema,
});

export type Gestion = z.infer<typeof GestionSchema>;
export type GestionFormulario = z.input<typeof CrearGestionSchema>;
export type CrearGestionPayload = z.output<typeof CrearGestionSchema>;
export type ActualizarGestionForm = z.input<typeof ActualizarGestionSchema>;
export type ActualizarGestionData = z.output<typeof ActualizarGestionSchema>;
export type CrearGestionResponse = z.infer<typeof GestionResponseSchema>;
export type ActualizarGestionResponse = z.infer<typeof GestionResponseSchema>;
export type ObtenerGestionResponse = z.infer<typeof GestionResponseSchema>;
export type PaginacionGestion = z.infer<typeof PaginacionGestionSchema>;
export type ObtenerGestionesResponse = z.infer<
  typeof ObtenerGestionesResponseSchema
>;

export interface FiltrosGestion {
  estado?: EstadoGestion | "";
  anio?: number | "";
  buscar?: string;
  pagina?: number;
  limite?: number;
}

export interface ActualizarGestionPayload {
  gestionId: string;
  formulario: ActualizarGestionForm;
}

export interface CambiarEstadoGestionPayload {
  gestionId: string;
  estado: EstadoGestion;
}