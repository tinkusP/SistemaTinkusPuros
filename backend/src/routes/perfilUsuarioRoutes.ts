import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { body, param } from "express-validator";
import mongoose from "mongoose";

import { PerfilUsuarioController } from "../controllers/PerfilUsuarioController";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { uploadRegistroCuenta } from "../middleware/uploadCuentaPerfil";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { autorizarEdicion, historialAutorizaciones, miAutorizacion } from "../controllers/AutorizacionEdicionPerfilController";
import { completarPerfilAutorizado } from "../controllers/CompletarPerfilController";

const router = Router();

const ESTADOS_EDITABLES = [
  "PENDIENTE",
  "ACTIVO",
  "BLOQUEADO",
  "INACTIVO",
] as const;

const TIPOS_ORIGEN = [
  "INTERNO",
  "EXTERNO",
  "INTERNO_UMSA",
  "EXTERNO_UMSA",
  "EXTERNO_NO_UMSA",
] as const;

const TIPOS_FRATERNO = [
  "NUEVO",
  "ANTIGUO",
] as const;

/**
 * Cuando se usa multipart/form-data, el frontend puede enviar un arreglo
 * como texto JSON: ["id1", "id2"]. Este middleware lo convierte en arreglo
 * antes de ejecutar las validaciones y el controlador.
 */
const normalizarRelaciones = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  for (const campo of ["roles", "gestion"] as const) {
    const valor = req.body?.[campo];

    if (typeof valor !== "string") {
      continue;
    }

    const texto = valor.trim();

    if (!texto.startsWith("[")) {
      continue;
    }

    try {
      const convertido = JSON.parse(texto);

      if (Array.isArray(convertido)) {
        req.body[campo] = convertido;
      }
    } catch {
      // La validación posterior devolverá el mensaje correspondiente.
    }
  }

  next();
};

const obtenerPrimeraEntrada = (
  bodyValue: Request["body"],
  campos: string[],
): unknown => {
  for (const campo of campos) {
    if (
      bodyValue?.[campo] !== undefined &&
      bodyValue?.[campo] !== null &&
      bodyValue?.[campo] !== ""
    ) {
      return bodyValue[campo];
    }
  }

  return undefined;
};

const validarRelacionObjectId = (
  campos: string[],
  nombreCampo: string,
  requerido: boolean,
) =>
  body(campos[0]).custom(
    (_valor, { req }) => {
      const entrada = obtenerPrimeraEntrada(
        req.body,
        campos,
      );

      if (entrada === undefined) {
        if (requerido) {
          throw new Error(
            `Debe enviar al menos un ${nombreCampo}`,
          );
        }

        return true;
      }

      const ids = Array.isArray(entrada)
        ? entrada
        : [entrada];

      if (ids.length === 0) {
        throw new Error(
          `Debe enviar al menos un ${nombreCampo}`,
        );
      }

      const existeIdInvalido = ids.some(
        (id) =>
          typeof id !== "string" ||
          !mongoose.isValidObjectId(id.trim()),
      );

      if (existeIdInvalido) {
        throw new Error(
          `Cada ${nombreCampo} debe contener un ID válido`,
        );
      }

      return true;
    },
  );

const validacionesDatosPersonalesRegistro = [
  body("nombres")
    .trim()
    .notEmpty()
    .withMessage("Los nombres son obligatorios")
    .isLength({ max: 100 })
    .withMessage("Los nombres no pueden superar 100 caracteres"),

  body("apellidoPaterno")
    .trim()
    .notEmpty()
    .withMessage("El apellido paterno es obligatorio")
    .isLength({ max: 100 })
    .withMessage(
      "El apellido paterno no puede superar 100 caracteres",
    ),

  body("apellidoMaterno")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 100 })
    .withMessage(
      "El apellido materno no puede superar 100 caracteres",
    ),

  body("ci")
    .trim()
    .notEmpty()
    .withMessage("El CI es obligatorio")
    .isNumeric()
    .withMessage("El CI solo puede contener números")
    .isLength({ max: 20 })
    .withMessage("El CI no puede superar 20 caracteres"),

  body("complementoCi")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 10 })
    .withMessage(
      "El complemento del CI no puede superar 10 caracteres",
    ),

  body("expedidoCi")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 10 })
    .withMessage(
      "El expedido del CI no puede superar 10 caracteres",
    ),

  body("fechaNacimiento")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de nacimiento no tiene un formato válido",
    ),

  body("sexo")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isIn(["HOMBRE", "MUJER"])
    .withMessage("El género debe ser HOMBRE o MUJER")
    .isLength({ max: 20 })
    .withMessage("El sexo no puede superar 20 caracteres"),

  body("telefono")
    .trim()
    .notEmpty()
    .withMessage("El teléfono es obligatorio")
    .isLength({ max: 20 })
    .withMessage(
      "El teléfono no puede superar 20 caracteres",
    ),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage("El correo electrónico no es válido")
    .isLength({ max: 100 })
    .withMessage(
      "El correo no puede superar 100 caracteres",
    ),

  body("tipoOrigen")
    .isIn([...TIPOS_ORIGEN])
    .withMessage(
      "El tipo de origen académico no es válido",
    ),

  body("tipoFraterno")
    .isIn([...TIPOS_FRATERNO])
    .withMessage(
      "El tipo de fraterno debe ser NUEVO o ANTIGUO",
    ),

  body("ci").optional().trim().isNumeric().withMessage("El CI solo puede contener números"),
  body("registroUniversitario").optional({ nullable: true, checkFalsy: true }).trim().isNumeric().withMessage("El registro universitario solo puede contener números"),
  body("sexo").optional({ nullable: true, checkFalsy: true }).isIn(["HOMBRE", "MUJER"]).withMessage("El género debe ser HOMBRE o MUJER"),

  body("registroUniversitario")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isNumeric()
    .withMessage(
      "El registro universitario solo puede contener números",
    )
    .isLength({ max: 30 })
    .withMessage(
      "El registro universitario no puede superar 30 caracteres",
    ),

  body("facultad")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 150 })
    .withMessage(
      "La facultad no puede superar 150 caracteres",
    ),

  body("carrera")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 150 })
    .withMessage(
      "La carrera no puede superar 150 caracteres",
    ),

  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria")
    .isLength({
      min: 8,
      max: 100,
    })
    .withMessage(
      "La contraseña debe tener entre 8 y 100 caracteres",
    ),
];

const validacionesActualizacion = [
  param("id")
    .isMongoId()
    .withMessage("ID de usuario no válido"),

  validarRelacionObjectId(
    ["roles", "rolId", "rol"],
    "rol",
    false,
  ),

  validarRelacionObjectId(
    ["gestion", "gestionId"],
    "ID de gestión",
    false,
  ),

  body("nombres")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Los nombres no pueden estar vacíos")
    .isLength({ max: 100 })
    .withMessage(
      "Los nombres no pueden superar 100 caracteres",
    ),

  body("apellidoPaterno")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(
      "El apellido paterno no puede estar vacío",
    )
    .isLength({ max: 100 })
    .withMessage(
      "El apellido paterno no puede superar 100 caracteres",
    ),

  body("apellidoMaterno")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 100 })
    .withMessage(
      "El apellido materno no puede superar 100 caracteres",
    ),

  body("ci")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("El CI no puede estar vacío")
    .isLength({ max: 20 })
    .withMessage("El CI no puede superar 20 caracteres"),

  body("complementoCi")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 10 })
    .withMessage(
      "El complemento del CI no puede superar 10 caracteres",
    ),

  body("expedidoCi")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 10 })
    .withMessage(
      "El expedido del CI no puede superar 10 caracteres",
    ),

  body("fechaNacimiento")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de nacimiento no tiene un formato válido",
    ),

  body("sexo")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 20 })
    .withMessage("El sexo no puede superar 20 caracteres"),

  body("telefono")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("El teléfono no puede estar vacío")
    .isLength({ max: 20 })
    .withMessage(
      "El teléfono no puede superar 20 caracteres",
    ),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("El correo electrónico no es válido")
    .isLength({ max: 100 })
    .withMessage(
      "El correo no puede superar 100 caracteres",
    ),

  body("fotoPerfil")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString()
    .withMessage(
      "La ruta de la foto de perfil debe ser texto",
    )
    .isLength({ max: 500 })
    .withMessage(
      "La ruta de la foto no puede superar 500 caracteres",
    ),

  body("tipoOrigen")
    .optional()
    .isIn([...TIPOS_ORIGEN])
    .withMessage(
      "El tipo de origen académico no es válido",
    ),

  body("tipoFraterno")
    .optional()
    .isIn([...TIPOS_FRATERNO])
    .withMessage(
      "El tipo de fraterno debe ser NUEVO o ANTIGUO",
    ),

  body("registroUniversitario")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 30 })
    .withMessage(
      "El registro universitario no puede superar 30 caracteres",
    ),

  body("facultad")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 150 })
    .withMessage(
      "La facultad no puede superar 150 caracteres",
    ),

  body("carrera")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .trim()
    .isLength({ max: 150 })
    .withMessage(
      "La carrera no puede superar 150 caracteres",
    ),

  body("estado")
    .optional()
    .isIn([...ESTADOS_EDITABLES])
    .withMessage(
      "El estado debe ser PENDIENTE, ACTIVO, BLOQUEADO o INACTIVO. Para eliminar use DELETE.",
    ),

  body("emailVerificado")
    .optional()
    .isBoolean()
    .withMessage(
      "emailVerificado debe ser true o false",
    )
    .toBoolean(),

  body("requiereCambioPassword")
    .optional()
    .isBoolean()
    .withMessage(
      "requiereCambioPassword debe ser true o false",
    )
    .toBoolean(),
];

/**
 * @openapi
 * components:
 *   schemas:
 *     RolResumen:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "68782c6c5123456789012346"
 *         nombre:
 *           type: string
 *           example: "Fraterno"
 *         codigo:
 *           type: string
 *           example: "FRATERNO"
 *         descripcion:
 *           type: string
 *           nullable: true
 *         permisos:
 *           type: object
 *         estado:
 *           type: string
 *
 *     GestionResumen:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "68782c6c5123456789012347"
 *         nombre:
 *           type: string
 *           example: "Gestión 2026"
 *
 *     PerfilUsuario:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "68782c6c5123456789012345"
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RolResumen'
 *         gestion:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/GestionResumen'
 *         nombres:
 *           type: string
 *           example: "Juan Carlos"
 *         apellidoPaterno:
 *           type: string
 *           example: "Pérez"
 *         apellidoMaterno:
 *           type: string
 *           nullable: true
 *           example: "Mamani"
 *         ci:
 *           type: string
 *           example: "8444174"
 *         complementoCi:
 *           type: string
 *           nullable: true
 *           example: "1A"
 *         expedidoCi:
 *           type: string
 *           nullable: true
 *           example: "LP"
 *         fechaNacimiento:
 *           type: string
 *           format: date
 *           nullable: true
 *         sexo:
 *           type: string
 *           nullable: true
 *           example: "MASCULINO"
 *         telefono:
 *           type: string
 *           example: "76543210"
 *         email:
 *           type: string
 *           format: email
 *           example: "juan@gmail.com"
 *         fotoPerfil:
 *           type: string
 *           nullable: true
 *           example: "/uploads/cuentas-perfil/foto.webp"
 *         tipoOrigen:
 *           type: string
 *           enum: [INTERNO, EXTERNO]
 *         tipoFraterno:
 *           type: string
 *           enum: [NUEVO, ANTIGUO]
 *         registroUniversitario:
 *           type: string
 *           nullable: true
 *         facultad:
 *           type: string
 *           nullable: true
 *         carrera:
 *           type: string
 *           nullable: true
 *         estado:
 *           type: string
 *           enum:
 *             - PENDIENTE
 *             - ACTIVO
 *             - BLOQUEADO
 *             - INACTIVO
 *             - ELIMINADO
 *         emailVerificado:
 *           type: boolean
 *         intentosFallidos:
 *           type: integer
 *         bloqueadoHasta:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         ultimoLogin:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         ultimoCambioPassword:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         requiereCambioPassword:
 *           type: boolean
 *         fechaCreado:
 *           type: string
 *           format: date-time
 *         fechaEdit:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fechaEliminado:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "juan@gmail.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "ClaveSegura2026!"
 *
 *     CambioPasswordInput:
 *       type: object
 *       required:
 *         - passwordActual
 *         - passwordNueva
 *       properties:
 *         passwordActual:
 *           type: string
 *           format: password
 *         passwordNueva:
 *           type: string
 *           format: password
 *
 *     ErrorRespuesta:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 */

/**
 * @openapi
 * /api/perfilusuario/registro:
 *   post:
 *     tags:
 *       - PerfilUsuario
 *     summary: Registrar un perfil de usuario
 *     description: >
 *       Crea el perfil de usuario y recibe en la misma solicitud la foto,
 *       el carnet de identidad en PDF y el registro universitario en PDF.
 *       El frontend puede enviar rolId y gestionId cuando existe un solo valor.
 *       También se aceptan roles y gestion como arreglos.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - rolId
 *               - gestionId
 *               - nombres
 *               - apellidoPaterno
 *               - ci
 *               - telefono
 *               - email
 *               - tipoOrigen
 *               - tipoFraterno
 *               - password
 *               - carnetIdentidadPdf
 *             properties:
 *               rolId:
 *                 type: string
 *                 description: ID del rol enviado por el frontend
 *                 example: "68782c6c5123456789012346"
 *               roles:
 *                 type: array
 *                 description: Alternativa a rolId
 *                 items:
 *                   type: string
 *               gestionId:
 *                 type: string
 *                 description: ID de la gestión enviada por el frontend
 *                 example: "68782c6c5123456789012347"
 *               gestion:
 *                 type: array
 *                 description: Alternativa a gestionId
 *                 items:
 *                   type: string
 *               nombres:
 *                 type: string
 *               apellidoPaterno:
 *                 type: string
 *               apellidoMaterno:
 *                 type: string
 *               ci:
 *                 type: string
 *               complementoCi:
 *                 type: string
 *               expedidoCi:
 *                 type: string
 *               fechaNacimiento:
 *                 type: string
 *                 format: date
 *               sexo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               tipoOrigen:
 *                 type: string
 *                 enum: [INTERNO, EXTERNO]
 *               tipoFraterno:
 *                 type: string
 *                 enum: [NUEVO, ANTIGUO]
 *               registroUniversitario:
 *                 type: string
 *               facultad:
 *                 type: string
 *               carrera:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               fotoPerfil:
 *                 type: string
 *                 format: binary
 *                 description: Foto opcional del usuario
 *               carnetIdentidadPdf:
 *                 type: string
 *                 format: binary
 *                 description: Carnet obligatorio en PDF, JPG, PNG o WebP
 *               registroUniversitarioPdf:
 *                 type: string
 *                 format: binary
 *                 description: Registro universitario opcional en PDF, JPG, PNG o WebP
 *     responses:
 *       201:
 *         description: Perfil registrado correctamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Correo o CI duplicado
 *       500:
 *         description: Error interno
 */
router.post(
  "/registro",
  uploadRegistroCuenta.fields([
    {
      name: "fotoPerfil",
      maxCount: 1,
    },
    {
      name: "carnetIdentidadPdf",
      maxCount: 1,
    },
    {
      name: "carnetIdentidadReverso",
      maxCount: 1,
    },
    {
      name: "registroUniversitarioPdf",
      maxCount: 1,
    },
  ]),
  normalizarRelaciones,
  body("tokenRegistro").optional({ checkFalsy: true }).trim(),
  validarRelacionObjectId(
    ["roles", "rolId", "rol"],
    "rol",
    true,
  ),
  validarRelacionObjectId(
    ["gestion", "gestionId"],
    "ID de gestión",
    true,
  ),
  ...validacionesDatosPersonalesRegistro,
  handleInputErrors,
  PerfilUsuarioController.registrarCuenta,
);

router.get("/autorizacion-edicion/mia", authenticate, miAutorizacion);
router.post("/completar-perfil-autorizado", authenticate, uploadRegistroCuenta.fields([{name:"fotoPerfil",maxCount:1},{name:"carnetIdentidadPdf",maxCount:1},{name:"carnetIdentidadReverso",maxCount:1},{name:"registroUniversitarioPdf",maxCount:1}]), completarPerfilAutorizado);
router.get("/:id/autorizaciones-edicion", authenticate, soloAdministracion, param("id").isMongoId(), handleInputErrors, historialAutorizaciones);
router.post("/:id/autorizaciones-edicion", authenticate, soloAdministracion, param("id").isMongoId(), body("motivo").trim().notEmpty().isLength({ max: 500 }), body("campos").isArray({ min: 1 }), body("campos.*").isIn(["DATOS_PERSONALES", "FOTO_PERFIL", "CARNET_ANVERSO", "CARNET_REVERSO", "REGISTRO_UNIVERSITARIO"]), handleInputErrors, autorizarEdicion);

/**
 * @openapi
 * /api/perfilusuario/login:
 *   post:
 *     tags:
 *       - PerfilUsuario
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login correcto
 *       401:
 *         description: Credenciales incorrectas
 *       403:
 *         description: Cuenta pendiente, inactiva o bloqueada
 *       500:
 *         description: Error durante el inicio de sesión
 */
router.post(
  "/login",
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio")
    .isEmail()
    .withMessage(
      "El correo electrónico no es válido",
    ),
  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria"),
  handleInputErrors,
  PerfilUsuarioController.login,
);

/**
 * @openapi
 * /api/perfilusuario/usuario:
 *   get:
 *     tags:
 *       - PerfilUsuario
 *     summary: Obtener el usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado
 *       401:
 *         description: Usuario no autenticado
 *       404:
 *         description: Usuario no encontrado
 */
router.get(
  "/usuario",
  authenticate,
  PerfilUsuarioController.usuario,
);

/**
 * @openapi
 * /api/perfilusuario:
 *   get:
 *     tags:
 *       - PerfilUsuario
 *     summary: Obtener todos los perfiles no eliminados
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de perfiles con roles y gestiones
 *       500:
 *         description: Error al obtener perfiles
 */
router.get(
  "/",
  authenticate,
  soloAdministracion,
  PerfilUsuarioController.getAllPerfilUsuarios,
);

/**
 * @openapi
 * /api/perfilusuario/password/{id}:
 *   put:
 *     tags:
 *       - PerfilUsuario
 *     summary: Actualizar la contraseña de un perfil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CambioPasswordInput'
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         description: Datos inválidos o contraseña actual incorrecta
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/password/:id",
  authenticate,
  param("id")
    .isMongoId()
    .withMessage("ID de usuario no válido"),
  body("passwordActual")
    .notEmpty()
    .withMessage(
      "La contraseña actual es obligatoria",
    ),
  body("passwordNueva")
    .notEmpty()
    .withMessage(
      "La nueva contraseña es obligatoria",
    )
    .isLength({
      min: 8,
      max: 100,
    })
    .withMessage(
      "La nueva contraseña debe tener entre 8 y 100 caracteres",
    )
    .custom(
      (
        passwordNueva: string,
        { req },
      ) => {
        if (
          passwordNueva ===
          req.body.passwordActual
        ) {
          throw new Error(
            "La nueva contraseña debe ser diferente a la contraseña actual",
          );
        }

        return true;
      },
    ),
  handleInputErrors,
  PerfilUsuarioController.updatePassword,
);

router.post(
  "/password-temporal/:id",
  authenticate,
  soloAdministracion,
  param("id").isMongoId().withMessage("ID de usuario no válido"),
  handleInputErrors,
  PerfilUsuarioController.generarPasswordTemporal,
);

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   get:
 *     tags:
 *       - PerfilUsuario
 *     summary: Obtener un perfil por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Perfil encontrado
 *       400:
 *         description: ID no válido
 *       404:
 *         description: Perfil no encontrado
 */
router.get(
  "/:id",
  authenticate,
  soloAdministracion,
  param("id")
    .isMongoId()
    .withMessage("ID de usuario no válido"),
  handleInputErrors,
  PerfilUsuarioController.getPerfilUsuarioById,
);

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   put:
 *     tags:
 *       - PerfilUsuario
 *     summary: Actualizar un perfil de usuario
 *     description: >
 *       Permite actualizar datos, roles, gestiones y foto. El estado ELIMINADO
 *       no se admite aquí; para ello debe usarse DELETE.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               rolId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *               gestionId:
 *                 type: string
 *               gestion:
 *                 type: array
 *                 items:
 *                   type: string
 *               nombres:
 *                 type: string
 *               apellidoPaterno:
 *                 type: string
 *               apellidoMaterno:
 *                 type: string
 *               ci:
 *                 type: string
 *               complementoCi:
 *                 type: string
 *               expedidoCi:
 *                 type: string
 *               fechaNacimiento:
 *                 type: string
 *                 format: date
 *               sexo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               fotoPerfil:
 *                 type: string
 *                 format: binary
 *               tipoOrigen:
 *                 type: string
 *                 enum: [INTERNO, EXTERNO]
 *               tipoFraterno:
 *                 type: string
 *                 enum: [NUEVO, ANTIGUO]
 *               registroUniversitario:
 *                 type: string
 *               facultad:
 *                 type: string
 *               carrera:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum:
 *                   - PENDIENTE
 *                   - ACTIVO
 *                   - BLOQUEADO
 *                   - INACTIVO
 *               emailVerificado:
 *                 type: boolean
 *               requiereCambioPassword:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Perfil no encontrado
 *       409:
 *         description: Correo o CI duplicado
 */
router.put(
  "/:id",
  authenticate,
  soloAdministracion,
  uploadRegistroCuenta.single("fotoPerfil"),
  normalizarRelaciones,
  ...validacionesActualizacion,
  handleInputErrors,
  PerfilUsuarioController.updatePerfilUsuario,
);

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   delete:
 *     tags:
 *       - PerfilUsuario
 *     summary: Eliminar lógicamente un perfil
 *     description: >
 *       No elimina el documento de MongoDB. Cambia el estado a ELIMINADO
 *       y registra fechaEliminado y usuarioEliminador.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Perfil eliminado lógicamente
 *       400:
 *         description: ID no válido
 *       404:
 *         description: Perfil no encontrado o ya eliminado
 */
router.delete(
  "/:id",
  authenticate,
  param("id")
    .isMongoId()
    .withMessage("ID de usuario no válido"),
  handleInputErrors,
  PerfilUsuarioController.deletePerfilUsuario,
);

export default router;
