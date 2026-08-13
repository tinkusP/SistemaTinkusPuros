import type { Request, Response } from "express"
import Rol from "../models/Rol"
import { normalizarPermisosRol, PERMISOS_VALIDOS } from "../security/PermisosCatalogo"

export class RolController {

    // Crear rol
    static createRol = async (req: Request, res: Response) => {
        const permisos = normalizarPermisosRol(req.body.permisos);
        const permisosInvalidos = permisos.filter((permiso) => !PERMISOS_VALIDOS.has(permiso));
        if (permisosInvalidos.length) return res.status(400).json({ error: `Permisos no autorizados: ${permisosInvalidos.join(", ")}`, permisosInvalidos });
        const rol = new Rol({
            nombre: req.body.nombre,
            codigo: req.body.codigo,
            descripcion: req.body.descripcion,
            estado: req.body.estado ?? true,
            permisos,
            esRolSistema: req.body.esRolSistema ?? false,

            usuarioCreador: req.usuario?._id ?? null,
            fechaCreado: new Date()
        })

        try {
            await rol.save()

            res.status(201).json({
                message: "Rol creado",
                rol
            })

        } catch (error: any) {
            console.log(error)

            if (error.code === 11000) {
                return res.status(400).json({
                    error: "Ya existe un rol con ese código"
                })
            }

            res.status(500).json({
                error: "Error al crear rol"
            })
        }
    }

    // Obtener todos los roles no eliminados
    static getAllRoles = async (_req: Request, res: Response) => {
        try {
            const roles = await Rol.find({
                fechaEliminado: null
            }).sort({
                nombre: 1
            })

            res.json(roles)

        } catch (error) {
            console.log(error)

            res.status(500).json({
                error: "Error al obtener roles"
            })
        }
    }

    // Obtener rol por ID
    static getRolById = async (req: Request, res: Response) => {
        const { id } = req.params

        try {
            const rol = await Rol.findOne({
                _id: id,
                fechaEliminado: null
            })

            if (!rol) {
                res.status(404).json({
                    error: "Rol no encontrado"
                })
                return
            }

            res.json(rol)

        } catch (error) {
            console.log(error)

            res.status(500).json({
                error: "Error al obtener rol"
            })
        }
    }

    // Actualizar rol
    static updateRol = async (req: Request, res: Response) => {
        const { id } = req.params

        try {
            const rol = await Rol.findOne({
                _id: id,
                fechaEliminado: null
            })

            if (!rol) {
                res.status(404).json({
                    error: "Rol no encontrado"
                })
                return
            }

            // Actualización manual
            rol.nombre = req.body.nombre ?? rol.nombre
            rol.codigo = req.body.codigo ?? rol.codigo
            rol.descripcion = req.body.descripcion ?? rol.descripcion
            rol.estado = req.body.estado ?? rol.estado
            if (req.body.permisos) {
                const permisos = normalizarPermisosRol(req.body.permisos)
                const permisosInvalidos = permisos.filter((permiso) => !PERMISOS_VALIDOS.has(permiso))
                if (permisosInvalidos.length) return res.status(400).json({ error: `Permisos no autorizados: ${permisosInvalidos.join(", ")}`, permisosInvalidos })
                rol.permisos = permisos
            }
            rol.esRolSistema =
                req.body.esRolSistema ?? rol.esRolSistema

            rol.usuarioEdit = req.usuario?._id ?? null
            rol.fechaEdit = new Date()

            await rol.save()

            res.json({
                message: "Rol actualizado",
                rol
            })

        } catch (error: any) {
            console.log(error)

            if (error.code === 11000) {
                return res.status(400).json({
                    error: "Ya existe otro rol con ese código"
                })
            }

            res.status(500).json({
                error: "Error al actualizar rol"
            })
        }
    }

    // Eliminar lógico
    static deleteRol = async (req: Request, res: Response) => {
        const { id } = req.params

        try {
            const rol = await Rol.findOne({
                _id: id,
                fechaEliminado: null
            })

            if (!rol) {
                res.status(404).json({
                    error: "Rol no encontrado"
                })
                return
            }

            if (rol.esRolSistema) {
                res.status(403).json({
                    error: "No se puede eliminar un rol del sistema"
                })
                return
            }

            rol.estado = false
            rol.usuarioEliminador = req.usuario?._id ?? null
            rol.fechaEliminado = new Date()

            await rol.save()

            res.json({
                message: "Rol eliminado lógicamente"
            })

        } catch (error) {
            console.log(error)

            res.status(500).json({
                error: "Error al eliminar rol"
            })
        }
    }
}
