import { z } from "zod";

export const ObjectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "ObjectId no válido");

export const FechaApiSchema = z
  .string()
  .min(1, "La fecha no puede estar vacía");

export const UsuarioAuditoriaSchema = z.union([
  ObjectIdSchema,
  z
    .object({
      _id: ObjectIdSchema,
      nombres: z.string().optional(),
      apellidoPaterno: z.string().nullable().optional(),
      apellidoMaterno: z.string().nullable().optional(),
      email: z.string().email().optional(),
    })
    .passthrough(),
]);

export type UsuarioAuditoriaType = z.infer<
  typeof UsuarioAuditoriaSchema
>;