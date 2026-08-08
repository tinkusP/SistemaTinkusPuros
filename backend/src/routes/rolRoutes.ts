/**
 * @openapi
 * components:
 *   schemas:
 *     Rol:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f123abc456def789012345"
 *
 *         nombre:
 *           type: string
 *           example: "Administrador"
 *
 *         codigo:
 *           type: string
 *           example: "ADMINISTRADOR"
 *
 *         descripcion:
 *           type: string
 *           example: "Rol con acceso completo al sistema"
 *
 *         estado:
 *           type: boolean
 *           example: true
 *
 *         permisos:
 *           type: array
 *           items:
 *             type: string
 *           example:
 *             - "ROLES_VER"
 *             - "ROLES_CREAR"
 *             - "ROLES_EDITAR"
 *
 *         esRolSistema:
 *           type: boolean
 *           example: true
 *
 *         fechaCreado:
 *           type: string
 *           format: date-time
 *           example: "2026-07-16T17:40:00.000Z"
 *
 *         usuarioCreador:
 *           type: string
 *           nullable: true
 *           example: "64f123abc456def789012346"
 *
 *         fechaEdit:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-07-16T18:00:00.000Z"
 *
 *         usuarioEdit:
 *           type: string
 *           nullable: true
 *           example: "64f123abc456def789012346"
 *
 *         fechaEliminado:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-07-16T19:00:00.000Z"
 *
 *         usuarioEliminador:
 *           type: string
 *           nullable: true
 *           example: "64f123abc456def789012346"
 *
 *     RolInput:
 *       type: object
 *       required:
 *         - nombre
 *         - codigo
 *       properties:
 *         nombre:
 *           type: string
 *           example: "Administrador"
 *
 *         codigo:
 *           type: string
 *           example: "ADMINISTRADOR"
 *
 *         descripcion:
 *           type: string
 *           example: "Rol con acceso completo al sistema"
 *
 *         estado:
 *           type: boolean
 *           example: true
 *
 *         permisos:
 *           type: array
 *           items:
 *             type: string
 *           example:
 *             - "ROLES_VER"
 *             - "ROLES_CREAR"
 *             - "ROLES_EDITAR"
 *
 *         esRolSistema:
 *           type: boolean
 *           example: true
 */

import { Router } from "express"
import { body, param } from "express-validator"

import { RolController } from "../controllers/RolController"
import { handleInputErrors } from "../middleware/validation"
import { authenticate } from "../middleware/auth"
import { soloAdministracion } from "../middleware/soloAdministracion"

const router = Router()
router.use(authenticate, soloAdministracion)

/**
 * @openapi
 * /api/rol:
 *   post:
 *     tags:
 *       - Rol
 *     summary: Crear un nuevo rol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RolInput'
 *     responses:
 *       201:
 *         description: Rol creado correctamente
 *       400:
 *         description: Datos inválidos o código duplicado
 *       500:
 *         description: Error al crear rol
 */
router.post(
    "/",

    body("nombre")
        .trim()
        .notEmpty()
        .withMessage("El nombre del rol es obligatorio")
        .isLength({ max: 50 })
        .withMessage("El nombre no puede tener más de 50 caracteres"),

    body("codigo")
        .trim()
        .notEmpty()
        .withMessage("El código del rol es obligatorio")
        .isLength({ max: 50 })
        .withMessage("El código no puede tener más de 50 caracteres")
        .matches(/^[A-Za-z0-9_]+$/)
        .withMessage(
            "El código solo puede contener letras, números y guiones bajos"
        ),

    body("descripcion")
        .optional()
        .trim()
        .isLength({ max: 250 })
        .withMessage(
            "La descripción no puede tener más de 250 caracteres"
        ),

    body("estado")
        .optional()
        .isBoolean()
        .withMessage("El estado debe ser true o false"),

    body("permisos")
        .optional()
        .isArray()
        .withMessage("Los permisos deben enviarse como un arreglo"),

    body("permisos.*")
        .optional()
        .isString()
        .withMessage("Cada permiso debe ser un texto")
        .trim()
        .notEmpty()
        .withMessage("Los permisos no pueden estar vacíos"),

    body("esRolSistema")
        .optional()
        .isBoolean()
        .withMessage("esRolSistema debe ser true o false"),

    handleInputErrors,
    RolController.createRol
)

/**
 * @openapi
 * /api/rol:
 *   get:
 *     tags:
 *       - Rol
 *     summary: Obtener todos los roles no eliminados
 *     responses:
 *       200:
 *         description: Lista de roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Rol'
 *       500:
 *         description: Error al obtener roles
 */
router.get(
    "/",
    RolController.getAllRoles
)

/**
 * @openapi
 * /api/rol/{id}:
 *   get:
 *     tags:
 *       - Rol
 *     summary: Obtener un rol por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del rol
 *         example: "64f123abc456def789012345"
 *     responses:
 *       200:
 *         description: Rol encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rol'
 *       400:
 *         description: ID no válido
 *       404:
 *         description: Rol no encontrado
 *       500:
 *         description: Error al obtener rol
 */
router.get(
    "/:id",

    param("id")
        .isMongoId()
        .withMessage("ID de rol no válido"),

    handleInputErrors,
    RolController.getRolById
)

/**
 * @openapi
 * /api/rol/{id}:
 *   put:
 *     tags:
 *       - Rol
 *     summary: Actualizar un rol por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del rol
 *         example: "64f123abc456def789012345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RolInput'
 *     responses:
 *       200:
 *         description: Rol actualizado
 *       400:
 *         description: Datos o ID inválidos
 *       404:
 *         description: Rol no encontrado
 *       500:
 *         description: Error al actualizar rol
 */
router.put(
    "/:id",

    param("id")
        .isMongoId()
        .withMessage("ID de rol no válido"),

    body("nombre")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("El nombre del rol no puede estar vacío")
        .isLength({ max: 50 })
        .withMessage("El nombre no puede tener más de 50 caracteres"),

    body("codigo")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("El código del rol no puede estar vacío")
        .isLength({ max: 50 })
        .withMessage("El código no puede tener más de 50 caracteres")
        .matches(/^[A-Za-z0-9_]+$/)
        .withMessage(
            "El código solo puede contener letras, números y guiones bajos"
        ),

    body("descripcion")
        .optional()
        .trim()
        .isLength({ max: 250 })
        .withMessage(
            "La descripción no puede tener más de 250 caracteres"
        ),

    body("estado")
        .optional()
        .isBoolean()
        .withMessage("El estado debe ser true o false"),

    body("permisos")
        .optional()
        .isArray()
        .withMessage("Los permisos deben enviarse como un arreglo"),

    body("permisos.*")
        .optional()
        .isString()
        .withMessage("Cada permiso debe ser un texto")
        .trim()
        .notEmpty()
        .withMessage("Los permisos no pueden estar vacíos"),

    body("esRolSistema")
        .optional()
        .isBoolean()
        .withMessage("esRolSistema debe ser true o false"),

    handleInputErrors,
    RolController.updateRol
)

/**
 * @openapi
 * /api/rol/{id}:
 *   delete:
 *     tags:
 *       - Rol
 *     summary: Eliminar lógicamente un rol
 *     description: Desactiva el rol y registra el usuario y fecha de eliminación.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del rol
 *         example: "64f123abc456def789012345"
 *     responses:
 *       200:
 *         description: Rol eliminado lógicamente
 *       400:
 *         description: ID no válido
 *       403:
 *         description: No se puede eliminar un rol del sistema
 *       404:
 *         description: Rol no encontrado
 *       500:
 *         description: Error al eliminar rol
 */
router.delete(
    "/:id",

    param("id")
        .isMongoId()
        .withMessage("ID de rol no válido"),

    handleInputErrors,
    RolController.deleteRol
)

export default router
