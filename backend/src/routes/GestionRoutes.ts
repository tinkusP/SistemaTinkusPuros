import { Router } from "express";
import {
  body,
  param,
  query,
} from "express-validator";

import {
  actualizarGestion,
  cambiarEstadoGestion,
  crearGestion,
  eliminarGestion,
  obtenerGestionActiva,
  obtenerGestionPorId,
  obtenerGestiones,
} from "../controllers/GestionController";

import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

const ESTADOS_GESTION = [
  "PLANIFICACION",
  "INSCRIPCIONES",
  "ACTIVA",
  "CERRADA",
] as const;

/*
|--------------------------------------------------------------------------
| Validaciones reutilizables
|--------------------------------------------------------------------------
*/

const validarGestionId = [
  param("gestionId")
    .isMongoId()
    .withMessage(
      "El identificador de la gestión no es válido",
    ),
];

const validarFechasInscripcion = body().custom(
  (value, { req }) => {
    const {
      fechaInicioInscripcion,
      fechaFinInscripcion,
    } = req.body;

    const tieneInicio =
      fechaInicioInscripcion !== undefined &&
      fechaInicioInscripcion !== null &&
      fechaInicioInscripcion !== "";

    const tieneFin =
      fechaFinInscripcion !== undefined &&
      fechaFinInscripcion !== null &&
      fechaFinInscripcion !== "";

    if (tieneInicio !== tieneFin) {
      throw new Error(
        "Debe enviar la fecha de inicio y la fecha de finalización de inscripciones",
      );
    }

    if (tieneInicio && tieneFin) {
      const inicio =
        new Date(fechaInicioInscripcion);

      const fin =
        new Date(fechaFinInscripcion);

      if (
        Number.isNaN(inicio.getTime()) ||
        Number.isNaN(fin.getTime())
      ) {
        throw new Error(
          "Las fechas de inscripción no son válidas",
        );
      }

      if (inicio >= fin) {
        throw new Error(
          "La fecha de inicio de inscripción debe ser anterior a la fecha de finalización",
        );
      }
    }

    return true;
  },
);

const validarFechasGestion = body().custom(
  (value, { req }) => {
    const {
      fechaInicio,
      fechaFin,
    } = req.body;

    if (
      fechaInicio === undefined ||
      fechaFin === undefined
    ) {
      return true;
    }

    const inicio =
      new Date(fechaInicio);

    const fin =
      new Date(fechaFin);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime())
    ) {
      throw new Error(
        "Las fechas de inicio y finalización no son válidas",
      );
    }

    if (inicio >= fin) {
      throw new Error(
        "La fecha de inicio debe ser anterior a la fecha de finalización",
      );
    }

    return true;
  },
);

const validarCupoTotal = body().custom(
  (value, { req }) => {
    const {
      cupoMaximoHombres,
      cupoMaximoMujeres,
    } = req.body;

    /*
     * En actualización pueden enviarse de forma parcial.
     * El controlador combinará el valor nuevo con el actual.
     */
    if (
      cupoMaximoHombres === undefined ||
      cupoMaximoMujeres === undefined
    ) {
      return true;
    }

    const hombres =
      Number(cupoMaximoHombres);

    const mujeres =
      Number(cupoMaximoMujeres);

    if (
      !Number.isInteger(hombres) ||
      !Number.isInteger(mujeres)
    ) {
      throw new Error(
        "Los cupos máximos deben ser números enteros",
      );
    }

    if (hombres + mujeres <= 0) {
      throw new Error(
        "La suma de los cupos de hombres y mujeres debe ser mayor a cero",
      );
    }

    return true;
  },
);

/**
 * @openapi
 * tags:
 *   - name: Gestiones
 *     description: Administración de gestiones anuales de la fraternidad
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Gestion:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "669c5ab2f1b3a71ab1234567"
 *         anio:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *           example: 2026
 *         nombre:
 *           type: string
 *           example: "Gestión 2026"
 *         descripcion:
 *           type: string
 *           nullable: true
 *           example: "Gestión correspondiente a la Entrada Universitaria 2026"
 *         fechaInicio:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *         fechaFin:
 *           type: string
 *           format: date-time
 *           example: "2026-12-31T23:59:59.000Z"
 *         fechaInicioInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-02-01T00:00:00.000Z"
 *         fechaFinInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-03-31T23:59:59.000Z"
 *         cupoMaximoHombres:
 *           type: integer
 *           minimum: 0
 *           example: 160
 *         cupoMaximoMujeres:
 *           type: integer
 *           minimum: 0
 *           example: 140
 *         cupoMaximo:
 *           type: integer
 *           minimum: 1
 *           readOnly: true
 *           description: Suma calculada automáticamente de los cupos de hombres y mujeres
 *           example: 300
 *         estado:
 *           type: string
 *           enum:
 *             - PLANIFICACION
 *             - INSCRIPCIONES
 *             - ACTIVA
 *             - CERRADA
 *           example: "PLANIFICACION"
 *         fechaCreado:
 *           type: string
 *           format: date-time
 *         usuarioCreador:
 *           nullable: true
 *           oneOf:
 *             - type: string
 *             - type: object
 *         fechaEdit:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         usuarioEdit:
 *           nullable: true
 *           oneOf:
 *             - type: string
 *             - type: object
 *         fechaEliminado:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         usuarioEliminador:
 *           nullable: true
 *           oneOf:
 *             - type: string
 *             - type: object
 *
 *     CrearGestionRequest:
 *       type: object
 *       required:
 *         - anio
 *         - nombre
 *         - fechaInicio
 *         - fechaFin
 *         - cupoMaximoHombres
 *         - cupoMaximoMujeres
 *       properties:
 *         anio:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *           example: 2026
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: "Gestión 2026"
 *         descripcion:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           example: "Gestión de la fraternidad Tinkus Puros y Naturales"
 *         fechaInicio:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *         fechaFin:
 *           type: string
 *           format: date-time
 *           example: "2026-12-31T23:59:59.000Z"
 *         fechaInicioInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-02-01T00:00:00.000Z"
 *         fechaFinInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-03-31T23:59:59.000Z"
 *         cupoMaximoHombres:
 *           type: integer
 *           minimum: 0
 *           example: 160
 *         cupoMaximoMujeres:
 *           type: integer
 *           minimum: 0
 *           example: 140
 *         estado:
 *           type: string
 *           enum:
 *             - PLANIFICACION
 *             - INSCRIPCIONES
 *             - ACTIVA
 *             - CERRADA
 *           example: "PLANIFICACION"
 *
 *     ActualizarGestionRequest:
 *       type: object
 *       properties:
 *         anio:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *           example: 2026
 *         nombre:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: "Gestión Entrada Universitaria 2026"
 *         descripcion:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *         fechaInicio:
 *           type: string
 *           format: date-time
 *         fechaFin:
 *           type: string
 *           format: date-time
 *         fechaInicioInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fechaFinInscripcion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         cupoMaximoHombres:
 *           type: integer
 *           minimum: 0
 *           example: 170
 *         cupoMaximoMujeres:
 *           type: integer
 *           minimum: 0
 *           example: 150
 *         estado:
 *           type: string
 *           enum:
 *             - PLANIFICACION
 *             - INSCRIPCIONES
 *             - ACTIVA
 *             - CERRADA
 *
 *     CambiarEstadoGestionRequest:
 *       type: object
 *       required:
 *         - estado
 *       properties:
 *         estado:
 *           type: string
 *           enum:
 *             - PLANIFICACION
 *             - INSCRIPCIONES
 *             - ACTIVA
 *             - CERRADA
 *           example: "ACTIVA"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Ocurrió un error al procesar la solicitud"
 *         errors:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @openapi
 * /api/gestiones/activa:
 *   get:
 *     tags:
 *       - Gestiones
 *     summary: Obtener la gestión activa
 *     description: Devuelve la gestión no eliminada que se encuentra en estado ACTIVA.
 *     responses:
 *       200:
 *         description: Gestión activa obtenida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gestion:
 *                   $ref: '#/components/schemas/Gestion'
 *       404:
 *         description: No existe una gestión activa
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  "/activa",
  obtenerGestionActiva,
);

router.use(authenticate, soloAdministracion);

/**
 * @openapi
 * /api/gestiones:
 *   get:
 *     tags:
 *       - Gestiones
 *     summary: Listar gestiones
 *     description: Obtiene gestiones no eliminadas con filtros, búsqueda y paginación.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum:
 *             - PLANIFICACION
 *             - INSCRIPCIONES
 *             - ACTIVA
 *             - CERRADA
 *       - in: query
 *         name: anio
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *         example: 2026
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *           maxLength: 100
 *         example: "universitaria"
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de gestiones obtenida correctamente
 *       400:
 *         description: Filtros no válidos
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  "/",
  authenticate,

  query("estado")
    .optional()
    .isIn(ESTADOS_GESTION)
    .withMessage(
      "El estado utilizado como filtro no es válido",
    ),

  query("anio")
    .optional()
    .isInt({
      min: 2020,
      max: 2100,
    })
    .withMessage(
      "El año utilizado como filtro no es válido",
    ),

  query("buscar")
    .optional()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "La búsqueda no puede superar los 100 caracteres",
    ),

  query("pagina")
    .optional()
    .isInt({
      min: 1,
    })
    .withMessage(
      "La página debe ser mayor o igual a 1",
    ),

  query("limite")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "El límite debe estar entre 1 y 100",
    ),

  handleInputErrors,
  obtenerGestiones,
);

/**
 * @openapi
 * /api/gestiones:
 *   post:
 *     tags:
 *       - Gestiones
 *     summary: Crear una nueva gestión
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearGestionRequest'
 *     responses:
 *       201:
 *         description: Gestión creada correctamente
 *       400:
 *         description: Datos enviados no válidos
 *       409:
 *         description: Ya existe una gestión con ese año o una gestión activa
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/",
  authenticate,

  body("anio")
    .notEmpty()
    .withMessage(
      "El año es obligatorio",
    )
    .bail()
    .isInt({
      min: 2020,
      max: 2100,
    })
    .withMessage(
      "El año debe ser un entero entre 2020 y 2100",
    ),

  body("nombre")
    .trim()
    .notEmpty()
    .withMessage(
      "El nombre es obligatorio",
    )
    .bail()
    .isLength({
      min: 3,
      max: 100,
    })
    .withMessage(
      "El nombre debe tener entre 3 y 100 caracteres",
    ),

  body("descripcion")
    .optional({
      nullable: true,
    })
    .trim()
    .isLength({
      max: 500,
    })
    .withMessage(
      "La descripción no puede superar los 500 caracteres",
    ),

  body("fechaInicio")
    .notEmpty()
    .withMessage(
      "La fecha de inicio es obligatoria",
    )
    .bail()
    .isISO8601()
    .withMessage(
      "La fecha de inicio no es válida",
    ),

  body("fechaFin")
    .notEmpty()
    .withMessage(
      "La fecha de finalización es obligatoria",
    )
    .bail()
    .isISO8601()
    .withMessage(
      "La fecha de finalización no es válida",
    ),

  body("fechaInicioInscripcion")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de inicio de inscripción no es válida",
    ),

  body("fechaFinInscripcion")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de finalización de inscripción no es válida",
    ),

  body("cupoMaximoHombres")
    .notEmpty()
    .withMessage(
      "El cupo máximo de hombres es obligatorio",
    )
    .bail()
    .isInt({
      min: 0,
    })
    .withMessage(
      "El cupo máximo de hombres debe ser un entero mayor o igual a cero",
    ),

  body("cupoMaximoMujeres")
    .notEmpty()
    .withMessage(
      "El cupo máximo de mujeres es obligatorio",
    )
    .bail()
    .isInt({
      min: 0,
    })
    .withMessage(
      "El cupo máximo de mujeres debe ser un entero mayor o igual a cero",
    ),

  body("cupoMaximo")
    .not()
    .exists()
    .withMessage(
      "No debe enviar cupoMaximo; el backend lo calcula automáticamente",
    ),

  body("estado")
    .optional()
    .isIn(ESTADOS_GESTION)
    .withMessage(
      "El estado de la gestión no es válido",
    ),

  validarFechasGestion,
  validarFechasInscripcion,
  validarCupoTotal,

  handleInputErrors,
  crearGestion,
);

/**
 * @openapi
 * /api/gestiones/{gestionId}:
 *   get:
 *     tags:
 *       - Gestiones
 *     summary: Obtener una gestión por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gestionId
 *         required: true
 *         schema:
 *           type: string
 *         example: "669c5ab2f1b3a71ab1234567"
 *     responses:
 *       200:
 *         description: Gestión encontrada correctamente
 *       400:
 *         description: ID no válido
 *       404:
 *         description: Gestión no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  "/:gestionId",
  authenticate,
  ...validarGestionId,
  handleInputErrors,
  obtenerGestionPorId,
);

/**
 * @openapi
 * /api/gestiones/{gestionId}:
 *   put:
 *     tags:
 *       - Gestiones
 *     summary: Actualizar una gestión
 *     description: Permite actualizar uno o varios campos. El cupo máximo total se recalcula automáticamente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gestionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActualizarGestionRequest'
 *     responses:
 *       200:
 *         description: Gestión actualizada correctamente
 *       400:
 *         description: Datos o ID no válidos
 *       404:
 *         description: Gestión no encontrada
 *       409:
 *         description: Conflicto con otra gestión
 *       500:
 *         description: Error interno del servidor
 */
router.put(
  "/:gestionId",
  authenticate,
  ...validarGestionId,

  body("anio")
    .optional()
    .isInt({
      min: 2020,
      max: 2100,
    })
    .withMessage(
      "El año debe ser un entero entre 2020 y 2100",
    ),

  body("nombre")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(
      "El nombre no puede estar vacío",
    )
    .bail()
    .isLength({
      min: 3,
      max: 100,
    })
    .withMessage(
      "El nombre debe tener entre 3 y 100 caracteres",
    ),

  body("descripcion")
    .optional({
      nullable: true,
    })
    .trim()
    .isLength({
      max: 500,
    })
    .withMessage(
      "La descripción no puede superar los 500 caracteres",
    ),

  body("fechaInicio")
    .optional()
    .isISO8601()
    .withMessage(
      "La fecha de inicio no es válida",
    ),

  body("fechaFin")
    .optional()
    .isISO8601()
    .withMessage(
      "La fecha de finalización no es válida",
    ),

  body("fechaInicioInscripcion")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de inicio de inscripción no es válida",
    ),

  body("fechaFinInscripcion")
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isISO8601()
    .withMessage(
      "La fecha de finalización de inscripción no es válida",
    ),

  body("cupoMaximoHombres")
    .optional()
    .isInt({
      min: 0,
    })
    .withMessage(
      "El cupo máximo de hombres debe ser un entero mayor o igual a cero",
    ),

  body("cupoMaximoMujeres")
    .optional()
    .isInt({
      min: 0,
    })
    .withMessage(
      "El cupo máximo de mujeres debe ser un entero mayor o igual a cero",
    ),

  /*
   * El total no debe modificarse directamente.
   */
  body("cupoMaximo")
    .not()
    .exists()
    .withMessage(
      "No debe enviar cupoMaximo; el backend lo calcula automáticamente",
    ),

  body("estado")
    .optional()
    .isIn(ESTADOS_GESTION)
    .withMessage(
      "El estado de la gestión no es válido",
    ),

  /*
   * La validación conjunta de las fechas de inscripción
   * se realiza en el controlador, porque en una edición
   * puede enviarse únicamente una de ellas.
   */
  validarFechasGestion,
  validarCupoTotal,

  handleInputErrors,
  actualizarGestion,
);

/**
 * @openapi
 * /api/gestiones/{gestionId}/estado:
 *   patch:
 *     tags:
 *       - Gestiones
 *     summary: Cambiar el estado de una gestión
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gestionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CambiarEstadoGestionRequest'
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *       400:
 *         description: Estado o ID no válido
 *       404:
 *         description: Gestión no encontrada
 *       409:
 *         description: Ya existe otra gestión activa
 *       500:
 *         description: Error interno del servidor
 */
router.patch(
  "/:gestionId/estado",
  authenticate,
  ...validarGestionId,

  body("estado")
    .notEmpty()
    .withMessage(
      "El estado es obligatorio",
    )
    .bail()
    .isIn(ESTADOS_GESTION)
    .withMessage(
      "El estado de la gestión no es válido",
    ),

  handleInputErrors,
  cambiarEstadoGestion,
);

/**
 * @openapi
 * /api/gestiones/{gestionId}:
 *   delete:
 *     tags:
 *       - Gestiones
 *     summary: Eliminar lógicamente una gestión
 *     description: No elimina el documento físicamente; registra fecha y usuario eliminador.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gestionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gestión eliminada lógicamente
 *       400:
 *         description: ID no válido
 *       404:
 *         description: Gestión no encontrada
 *       409:
 *         description: No se puede eliminar una gestión activa
 *       500:
 *         description: Error interno del servidor
 */
router.delete(
  "/:gestionId",
  authenticate,
  ...validarGestionId,
  handleInputErrors,
  eliminarGestion,
);

export default router;
