import { Router } from "express"
import { PerfilUsuarioController } from "../controllers/PerfilUsuarioController"

const router = Router()

/**
 * @openapi
 * components:
 *   schemas:
 *     PerfilUsuario:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f123abc456"
 *       
 *         idRol:
 *           type: string
 *         idSucursal:
 *           type: string
 *         nombres:
 *           type: string
 *         apellidos:
 *           type: string
 *         edad:
 *           type: number
 *         sexo:
 *           type: string
 *         ci:
 *           type: string
 *         telefono:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         estado:
 *           type: boolean
 *         creadoPor:
 *           type: string
 *         actualizadoPor:
 *           type: string
 *         eliminadoPor:
 *           type: string
 *         fechaCreacion:
 *           type: string
 *           format: date-time
 *         fechaActualizacion:
 *           type: string
 *           format: date-time
 *         fechaEliminado:
 *           type: string
 *           format: date-time
 *
 *     PerfilUsuarioInput:
 *       type: object
 *       required:
 *         - idRol
 *         - idSucursal
 *         - nombres
 *         - apellidos
 *         - password
 *       properties:
 *         idRol:
 *           type: string
 *         idSucursal:
 *           type: string
 *         nombres:
 *           type: string
 *         apellidos:
 *           type: string
 *         edad:
 *           type: number
 *         sexo:
 *           type: string
 *         ci:
 *           type: string
 *         telefono:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         creadoPor:
 *           type: string
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           example: "admin@gmail.com"
 *         password:
 *           type: string
 *           example: "123456"
 *
 *     UpdatePasswordInput:
 *       type: object
 *       required:
 *         - passwordActual
 *         - passwordNueva
 *       properties:
 *         passwordActual:
 *           type: string
 *         passwordNueva:
 *           type: string
 *         actualizadoPor:
 *           type: string
 */

/**
 * @openapi
 * /api/perfilusuario:
 *   post:
 *     tags:
 *       - PerfilUsuario
 *     summary: Crear perfil de usuario
 */
router.post("/", PerfilUsuarioController.registrarCuenta)

/**
 * @openapi
 * /api/perfilusuario:
 *   get:
 *     tags:
 *       - PerfilUsuario
 *     summary: Obtener todos los perfiles
 */
router.get("/", PerfilUsuarioController.getAllPerfilUsuarios)

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   get:
 *     tags:
 *       - PerfilUsuario
 *     summary: Obtener perfil por ID
 */
router.get("/:id", PerfilUsuarioController.getPerfilUsuarioById)

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   put:
 *     tags:
 *       - PerfilUsuario
 *     summary: Actualizar perfil usuario
 */
router.put("/:id", PerfilUsuarioController.updatePerfilUsuario)

/**
 * @openapi
 * /api/perfilusuario/{id}:
 *   delete:
 *     tags:
 *       - PerfilUsuario
 *     summary: Eliminar perfil (lógico)
 */
router.delete("/:id", PerfilUsuarioController.deletePerfilUsuario)

/**
 * @openapi
 * /api/perfilusuario/login:
 *   post:
 *     tags:
 *       - PerfilUsuario
 *     summary: Login de usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 */
router.post("/login", PerfilUsuarioController.login)

/**
 * @openapi
 * /api/perfilusuario/password/{id}:
 *   put:
 *     tags:
 *       - PerfilUsuario
 *     summary: Actualizar contraseña
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
 *             $ref: '#/components/schemas/UpdatePasswordInput'
 */
router.put("/password/:id", PerfilUsuarioController.updatePassword)

export default router