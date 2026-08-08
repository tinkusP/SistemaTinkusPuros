// import type { Request, Response } from "express";
// import bcrypt from "bcrypt";
// import mongoose from "mongoose";
// import path from "node:path";
// import { promises as fs } from "node:fs";
// import sharp from "sharp";

// import PerfilUsuario from "../models/PerfilUsuario";
// import DocumentoUsuario from "../models/DocumentoUsuario";
// import {
//   comprimirPdfOptimizado,
//   verificarArchivoPdf,
// } from "../services/pdfService";
// import { generateJWT } from "../utils/jst";

// class SolicitudInvalidaError extends Error {}

// const normalizarEmail = (valor: unknown): string => {
//   if (typeof valor !== "string" || !valor.trim()) {
//     throw new SolicitudInvalidaError("El correo es obligatorio");
//   }

//   return valor.trim().toLowerCase();
// };

// const textoRequerido = (
//   valor: unknown,
//   nombreCampo: string,
// ): string => {
//   if (typeof valor !== "string" || !valor.trim()) {
//     throw new SolicitudInvalidaError(
//       `El campo ${nombreCampo} es obligatorio`,
//     );
//   }

//   return valor.trim();
// };

// const textoOpcional = (valor: unknown): string | undefined => {
//   if (valor === undefined || valor === null) {
//     return undefined;
//   }

//   if (typeof valor !== "string") {
//     throw new SolicitudInvalidaError(
//       "Uno de los campos de texto tiene un formato inválido",
//     );
//   }

//   const texto = valor.trim();
//   return texto || undefined;
// };

// const obtenerArchivo = (
//   req: Request,
// ): { filename: string } | undefined =>
//   (
//     req as Request & {
//       file?: {
//         filename: string;
//       };
//     }
//   ).file;


// type ArchivoRegistro = {
//   fieldname: string;
//   originalname: string;
//   filename: string;
//   path: string;
//   mimetype: string;
//   size: number;
// };

// type ArchivosRegistroCuenta = {
//   fotoPerfil?: ArchivoRegistro[];
//   carnetIdentidadPdf?: ArchivoRegistro[];
//   registroUniversitarioPdf?: ArchivoRegistro[];
// };

// const obtenerArchivosRegistro = (
//   req: Request,
// ): ArchivosRegistroCuenta => {
//   const archivos = (
//     req as Request & {
//       files?: ArchivosRegistroCuenta;
//     }
//   ).files;

//   return archivos ?? {};
// };

// const obtenerPrimerArchivo = (
//   archivos: ArchivosRegistroCuenta,
//   campo: keyof ArchivosRegistroCuenta,
// ): ArchivoRegistro | undefined =>
//   archivos[campo]?.[0];

// const limpiarNombreArchivo = (
//   valor: string,
// ): string =>
//   valor
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-zA-Z0-9_-]/g, "_")
//     .replace(/_+/g, "_")
//     .replace(/^_|_$/g, "");

// const eliminarRutaSiExiste = async (
//   ruta?: string,
// ): Promise<void> => {
//   if (!ruta) {
//     return;
//   }

//   try {
//     await fs.rm(ruta, {
//       recursive: true,
//       force: true,
//     });
//   } catch (error) {
//     console.error(
//       `No se pudo eliminar la ruta temporal ${ruta}:`,
//       error,
//     );
//   }
// };

// const rutaRelativaStorage = (
//   rutaAbsoluta: string,
// ): string =>
//   path
//     .relative(
//       path.resolve(
//         process.cwd(),
//         "storage",
//       ),
//       rutaAbsoluta,
//     )
//     .split(path.sep)
//     .join("/");

// /**
//  * Acepta un solo ID o un arreglo de IDs y siempre devuelve ObjectId[].
//  * También elimina IDs repetidos.
//  */
// const normalizarObjectIds = (
//   valor: unknown,
//   nombreCampo: string,
// ): mongoose.Types.ObjectId[] => {
//   const valores = Array.isArray(valor)
//     ? valor
//     : valor !== undefined && valor !== null && valor !== ""
//       ? [valor]
//       : [];

//   if (valores.length === 0) {
//     throw new SolicitudInvalidaError(
//       `Debe enviar al menos un ${nombreCampo}`,
//     );
//   }

//   const idsComoTexto = valores.map((item) => String(item).trim());

//   const idInvalido = idsComoTexto.find(
//     (id) => !mongoose.isValidObjectId(id),
//   );

//   if (idInvalido) {
//     throw new SolicitudInvalidaError(
//       `El ID enviado en ${nombreCampo} no es válido`,
//     );
//   }

//   return [...new Set(idsComoTexto)].map(
//     (id) => new mongoose.Types.ObjectId(id),
//   );
// };

// const validarIdParametro = (
//    valor: string | string[] | undefined,
// ): string => {
//   const id = Array.isArray(valor)
//     ? valor[0]
//     : valor;

//   if (
//     typeof id !== "string" ||
//     !id.trim() ||
//     !mongoose.isValidObjectId(id.trim())
//   ) {
//     throw new SolicitudInvalidaError(
//       "El ID del usuario no es válido",
//     );
//   }

//   return id.trim();
// };

// const obtenerRolesEntrada = (body: Request["body"]): unknown =>
//   body.roles ?? body.rolId ?? body.rol;

// const obtenerGestionEntrada = (body: Request["body"]): unknown =>
//   body.gestion ?? body.gestionId;

// const responderError = (
//   res: Response,
//   error: unknown,
//   mensajeInterno: string,
// ) => {
//   console.error(mensajeInterno, error);

//   if (error instanceof SolicitudInvalidaError) {
//     return res.status(400).json({
//       error: error.message,
//     });
//   }

//   if (error instanceof mongoose.Error.CastError) {
//     return res.status(400).json({
//       error: "Uno de los identificadores enviados no es válido",
//     });
//   }

//   if (error instanceof mongoose.Error.ValidationError) {
//     const errores = Object.values(error.errors).map(
//       (detalle) =>
//         (detalle as { message?: string }).message ??
//         "Error de validación",
//     );

//     return res.status(400).json({
//       error: "Los datos enviados no son válidos",
//       detalles: errores,
//     });
//   }

//   const errorMongo = error as {
//     code?: number;
//     keyPattern?: Record<string, number>;
//   };

//   if (errorMongo?.code === 11000) {
//     const campo = Object.keys(errorMongo.keyPattern ?? {})[0];

//     const mensaje =
//       campo === "email"
//         ? "El correo ya está registrado"
//         : campo === "ci"
//           ? "El CI ya está registrado"
//           : "Existe otro usuario con los mismos datos únicos";

//     return res.status(409).json({
//       error: mensaje,
//     });
//   }

//   return res.status(500).json({
//     error: mensajeInterno,
//   });
// };

// const populatePerfil = [
//   {
//     path: "roles",
//     select: "_id nombre codigo descripcion permisos estado",
//   },
//   {
//     path: "gestion",
//   },
// ];

// export class PerfilUsuarioController {
//   /* =========================================
//      CREAR / REGISTRAR CUENTA
//   ========================================= */

//   static registrarCuenta = async (
//     req: Request,
//     res: Response,
//   ) => {
//     const session =
//       await mongoose.startSession();

//     const rutasTemporales:
//       string[] = [];

//     const rutasGeneradas:
//       string[] = [];

//     let carpetaDocumentos:
//       string | undefined;

//     try {
//       const archivos =
//         obtenerArchivosRegistro(
//           req,
//         );

//       const fotoPerfilArchivo =
//         obtenerPrimerArchivo(
//           archivos,
//           "fotoPerfil",
//         );

//       const carnetIdentidadPdf =
//         obtenerPrimerArchivo(
//           archivos,
//           "carnetIdentidadPdf",
//         );

//       const registroUniversitarioPdf =
//         obtenerPrimerArchivo(
//           archivos,
//           "registroUniversitarioPdf",
//         );

//       for (
//         const archivo of [
//           fotoPerfilArchivo,
//           carnetIdentidadPdf,
//           registroUniversitarioPdf,
//         ]
//       ) {
//         if (archivo?.path) {
//           rutasTemporales.push(
//             archivo.path,
//           );
//         }
//       }

//       if (
//         !carnetIdentidadPdf ||
//         !registroUniversitarioPdf
//       ) {
//         throw new SolicitudInvalidaError(
//           "Debe adjuntar el carnet de identidad y el registro universitario en formato PDF",
//         );
//       }

//       const carnetEsPdf =
//         await verificarArchivoPdf(
//           carnetIdentidadPdf.path,
//         );

//       const registroEsPdf =
//         await verificarArchivoPdf(
//           registroUniversitarioPdf.path,
//         );

//       if (!carnetEsPdf) {
//         throw new SolicitudInvalidaError(
//           "El archivo del carnet de identidad no es un PDF válido",
//         );
//       }

//       if (!registroEsPdf) {
//         throw new SolicitudInvalidaError(
//           "El archivo del registro universitario no es un PDF válido",
//         );
//       }

//       const email =
//         normalizarEmail(
//           req.body.email,
//         );

//       const ci =
//         textoRequerido(
//           req.body.ci,
//           "ci",
//         );

//       const registroUniversitario =
//         textoRequerido(
//           req.body
//             .registroUniversitario,
//           "registro universitario",
//         );

//       const passwordPlano =
//         textoRequerido(
//           req.body.password,
//           "password",
//         );

//       const roles =
//         normalizarObjectIds(
//           obtenerRolesEntrada(
//             req.body,
//           ),
//           "rol",
//         );

//       const gestion =
//         normalizarObjectIds(
//           obtenerGestionEntrada(
//             req.body,
//           ),
//           "ID de gestión",
//         );

//       const password =
//         await bcrypt.hash(
//           passwordPlano,
//           10,
//         );

//       session.startTransaction();

//       const cuentaExistente =
//         await PerfilUsuario.findOne({
//           $or: [
//             { email },
//             { ci },
//           ],
//         })
//           .select(
//             "email ci estado",
//           )
//           .session(
//             session,
//           );

//       if (cuentaExistente) {
//         const mensaje =
//           cuentaExistente.email ===
//           email
//             ? "El correo ya está registrado"
//             : "El CI ya está registrado";

//         throw new SolicitudInvalidaError(
//           mensaje,
//         );
//       }

//       /*
//        * Primero se crea el documento de PerfilUsuario.
//        * MongoDB genera aquí el _id que se utilizará
//        * para relacionar y organizar sus documentos.
//        */
//       const perfil =
//         new PerfilUsuario({
//           roles,
//           gestion,

//           nombres:
//             textoRequerido(
//               req.body.nombres,
//               "nombres",
//             ),

//           apellidoPaterno:
//             textoRequerido(
//               req.body
//                 .apellidoPaterno,
//               "apellido paterno",
//             ),

//           apellidoMaterno:
//             textoOpcional(
//               req.body
//                 .apellidoMaterno,
//             ),

//           ci,

//           complementoCi:
//             textoOpcional(
//               req.body
//                 .complementoCi,
//             ),

//           expedidoCi:
//             textoOpcional(
//               req.body
//                 .expedidoCi,
//             ),

//           fechaNacimiento:
//             req.body
//               .fechaNacimiento ||
//             undefined,

//           sexo:
//             textoOpcional(
//               req.body.sexo,
//             ),

//           telefono:
//             textoRequerido(
//               req.body.telefono,
//               "teléfono",
//             ),

//           email,

//           fotoPerfil:
//             undefined,

//           tipoOrigen:
//             req.body
//               .tipoOrigen,

//           tipoFraterno:
//             req.body
//               .tipoFraterno,

//           registroUniversitario,

//           facultad:
//             textoOpcional(
//               req.body.facultad,
//             ),

//           carrera:
//             textoOpcional(
//               req.body.carrera,
//             ),

//           password,

//           estado:
//             "PENDIENTE",

//           emailVerificado:
//             false,

//           intentosFallidos:
//             0,

//           bloqueadoHasta:
//             null,

//           ultimoLogin:
//             null,

//           ultimoCambioPassword:
//             new Date(),

//           requiereCambioPassword:
//             false,

//           fechaCreado:
//             new Date(),

//           usuarioCreador:
//             req.usuario?._id ??
//             null,

//           fechaEdit:
//             null,

//           usuarioEdit:
//             null,

//           fechaEliminado:
//             null,

//           usuarioEliminador:
//             null,
//         });

//       await perfil.save({
//         session,
//       });

//       const perfilId =
//         perfil._id.toString();

//       /*
//        * Procesar foto de perfil.
//        *
//        * La imagen se convierte a WebP y se relaciona
//        * con el mismo usuario recién creado.
//        */
//       if (fotoPerfilArchivo) {
//         const carpetaFoto =
//           path.resolve(
//             process.cwd(),
//             "public",
//             "uploads",
//             "cuentas-perfil",
//           );

//         await fs.mkdir(
//           carpetaFoto,
//           {
//             recursive: true,
//           },
//         );

//         const nombreFoto =
//           `${perfilId}.webp`;

//         const rutaFoto =
//           path.join(
//             carpetaFoto,
//             nombreFoto,
//           );

//         await sharp(
//           fotoPerfilArchivo.path,
//         )
//           .rotate()
//           .resize({
//             width: 1000,
//             height: 1000,
//             fit: "inside",
//             withoutEnlargement:
//               true,
//           })
//           .webp({
//             quality: 80,
//             effort: 4,
//           })
//           .toFile(
//             rutaFoto,
//           );

//         rutasGeneradas.push(
//           rutaFoto,
//         );

//         perfil.fotoPerfil =
//           `/uploads/cuentas-perfil/${nombreFoto}`;

//         await perfil.save({
//           session,
//         });
//       }

//       /*
//        * Crear la carpeta física:
//        *
//        * storage/documentos/<perfilUsuarioId>/
//        */
//       carpetaDocumentos =
//         path.resolve(
//           process.cwd(),
//           "storage",
//           "documentos",
//           perfilId,
//         );

//       await fs.mkdir(
//         carpetaDocumentos,
//         {
//           recursive: true,
//         },
//       );

//       const complemento =
//         perfil.complementoCi
//           ? `_${limpiarNombreArchivo(
//               perfil.complementoCi,
//             )}`
//           : "";

//       const nombreCarnet =
//         `CI_${limpiarNombreArchivo(
//           ci,
//         )}${complemento}.pdf`;

//       const nombreRegistro =
//         `RU_${limpiarNombreArchivo(
//           registroUniversitario,
//         )}.pdf`;

//       const rutaCarnet =
//         path.join(
//           carpetaDocumentos,
//           nombreCarnet,
//         );

//       const rutaRegistro =
//         path.join(
//           carpetaDocumentos,
//           nombreRegistro,
//         );

//       /*
//        * Ghostscript genera los PDF optimizados.
//        * El servicio conserva el archivo más pequeño
//        * si la compresión produce un archivo mayor.
//        */
//       await comprimirPdfOptimizado({
//         rutaEntrada:
//           carnetIdentidadPdf.path,

//         rutaSalida:
//           rutaCarnet,
//       });

//       rutasGeneradas.push(
//         rutaCarnet,
//       );

//       await comprimirPdfOptimizado({
//         rutaEntrada:
//           registroUniversitarioPdf.path,

//         rutaSalida:
//           rutaRegistro,
//       });

//       rutasGeneradas.push(
//         rutaRegistro,
//       );

//       /*
//        * Los dos documentos quedan relacionados
//        * con el _id del PerfilUsuario recién creado.
//        */
//       await DocumentoUsuario.insertMany(
//         [
//           {
//             perfilUsuario:
//               perfil._id,

//             tipoDocumento:
//               "CARNET_IDENTIDAD",

//             ruta:
//               rutaRelativaStorage(
//                 rutaCarnet,
//               ),

//             estado:
//               "PENDIENTE",

//             observacion:
//               null,

//             fechaCreado:
//               new Date(),

//             usuarioCreador:
//               req.usuario?._id ??
//               perfil._id,

//             fechaEdit:
//               null,

//             usuarioEdit:
//               null,

//             fechaEliminado:
//               null,

//             usuarioEliminador:
//               null,
//           },
//           {
//             perfilUsuario:
//               perfil._id,

//             tipoDocumento:
//               "REGISTRO_UNIVERSITARIO",

//             ruta:
//               rutaRelativaStorage(
//                 rutaRegistro,
//               ),

//             estado:
//               "PENDIENTE",

//             observacion:
//               null,

//             fechaCreado:
//               new Date(),

//             usuarioCreador:
//               req.usuario?._id ??
//               perfil._id,

//             fechaEdit:
//               null,

//             usuarioEdit:
//               null,

//             fechaEliminado:
//               null,

//             usuarioEliminador:
//               null,
//           },
//         ],
//         {
//           session,
//         },
//       );

//       await session.commitTransaction();

//       /*
//        * Los archivos recibidos por Multer eran temporales.
//        * Ya pueden eliminarse porque existen las versiones finales.
//        */
//       await Promise.allSettled(
//         rutasTemporales.map(
//           eliminarRutaSiExiste,
//         ),
//       );

//       await perfil.populate(
//         populatePerfil,
//       );

//       const documentos =
//         await DocumentoUsuario.find({
//           perfilUsuario:
//             perfil._id,

//           fechaEliminado:
//             null,
//         }).sort({
//           tipoDocumento:
//             1,
//         });

//       const {
//         password:
//           _password,
//         ...perfilSeguro
//       } = perfil.toObject();

//       return res.status(201).json({
//         message:
//           "Cuenta y documentos registrados correctamente. La solicitud está pendiente de revisión.",

//         perfil:
//           perfilSeguro,

//         documentos,
//       });
//     } catch (error) {
//       if (
//         session.inTransaction()
//       ) {
//         await session.abortTransaction();
//       }

//       /*
//        * Si falla el usuario, un PDF o DocumentoUsuario,
//        * se eliminan tanto los temporales como los archivos
//        * finales para no dejar información huérfana.
//        */
//       await Promise.allSettled(
//         [
//           ...rutasTemporales,
//           ...rutasGeneradas,
//         ].map(
//           eliminarRutaSiExiste,
//         ),
//       );

//       if (carpetaDocumentos) {
//         await eliminarRutaSiExiste(
//           carpetaDocumentos,
//         );
//       }

//       return responderError(
//         res,
//         error,
//         "Error al registrar la cuenta y sus documentos",
//       );
//     } finally {
//       await session.endSession();
//     }
//   };

//   /* =========================================
//      INICIAR SESIÓN
//   ========================================= */

//   static login = async (req: Request, res: Response) => {
//     try {
//       const email = normalizarEmail(req.body.email);
//       const passwordIngresado = textoRequerido(
//         req.body.password,
//         "password",
//       );

//       const perfil = await PerfilUsuario.findOne({
//         email,
//         estado: { $ne: "ELIMINADO" },
//       })
//         .select("+password")
//         .populate(populatePerfil);

//       if (!perfil) {
//         return res.status(401).json({
//           error: "Correo o contraseña incorrectos",
//         });
//       }

//       if (perfil.estado === "PENDIENTE") {
//         return res.status(403).json({
//           error: "La cuenta todavía está pendiente de aprobación",
//         });
//       }

//       if (perfil.estado === "INACTIVO") {
//         return res.status(403).json({
//           error: "La cuenta se encuentra inactiva",
//         });
//       }

//       if (perfil.estado === "BLOQUEADO") {
//         return res.status(403).json({
//           error: "La cuenta se encuentra bloqueada",
//         });
//       }

//       const ahora = new Date();

//       if (perfil.bloqueadoHasta && perfil.bloqueadoHasta > ahora) {
//         return res.status(403).json({
//           error: "La cuenta está bloqueada temporalmente",
//           bloqueadoHasta: perfil.bloqueadoHasta,
//         });
//       }

//       const passwordCorrecto = await bcrypt.compare(
//         passwordIngresado,
//         perfil.password,
//       );

//       if (!passwordCorrecto) {
//         perfil.intentosFallidos += 1;

//         if (perfil.intentosFallidos >= 5) {
//           perfil.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
//         }

//         await perfil.save();

//         return res.status(401).json({
//           error: "Correo o contraseña incorrectos",
//         });
//       }

//       perfil.intentosFallidos = 0;
//       perfil.bloqueadoHasta = null;
//       perfil.ultimoLogin = ahora;

//       await perfil.save();
//       await perfil.populate(populatePerfil);

//       const tokenjwt = generateJWT({
//         id: perfil._id.toString(),
//         name: perfil.nombres,
//       });

//       const { password: _password, ...usuarioSeguro } = perfil.toObject();

//       return res.status(200).json({
//         message: "Login correcto",
//         tokenjwt,
//         usuario: usuarioSeguro,
//       });
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al iniciar sesión",
//       );
//     }
//   };

//   /* =========================================
//      ACTUALIZAR CONTRASEÑA
//   ========================================= */

//   static updatePassword = async (
//     req: Request,
//     res: Response,
//   ) => {
//     try {
//       const { id } = req.params;
//       validarIdParametro(id);

//       const passwordActual = textoRequerido(
//         req.body.passwordActual,
//         "contraseña actual",
//       );
//       const passwordNueva = textoRequerido(
//         req.body.passwordNueva,
//         "contraseña nueva",
//       );

//       const perfil = await PerfilUsuario.findOne({
//         _id: id,
//         estado: { $ne: "ELIMINADO" },
//       }).select("+password");

//       if (!perfil) {
//         return res.status(404).json({
//           error: "Usuario no encontrado",
//         });
//       }

//       const passwordCorrecto = await bcrypt.compare(
//         passwordActual,
//         perfil.password,
//       );

//       if (!passwordCorrecto) {
//         return res.status(400).json({
//           error: "Contraseña actual incorrecta",
//         });
//       }

//       perfil.password = await bcrypt.hash(passwordNueva, 10);
//       perfil.ultimoCambioPassword = new Date();
//       perfil.requiereCambioPassword = false;
//       perfil.usuarioEdit = req.usuario?._id ?? undefined;
//       perfil.fechaEdit = new Date();

//       await perfil.save();

//       return res.status(200).json({
//         message: "Contraseña actualizada correctamente",
//       });
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al actualizar la contraseña",
//       );
//     }
//   };

//   /* =========================================
//      OBTENER TODOS LOS USUARIOS NO ELIMINADOS
//   ========================================= */

//   static getAllPerfilUsuarios = async (
//     _req: Request,
//     res: Response,
//   ) => {
//     try {
//       const perfiles = await PerfilUsuario.find({
//         estado: { $ne: "ELIMINADO" },
//       })
//         .select("-password")
//         .populate(populatePerfil)
//         .sort({
//           apellidoPaterno: 1,
//           apellidoMaterno: 1,
//           nombres: 1,
//         });

//       return res.status(200).json({
//         total: perfiles.length,
//         perfiles,
//       });
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al obtener los perfiles",
//       );
//     }
//   };

//   /* =========================================
//      OBTENER USUARIO POR ID
//   ========================================= */

//   // static getPerfilUsuarioById = async (
//   //   req: Request,
//   //   res: Response,
//   // ) => {
//   //   try {
//   //     validarIdParametro(req.params.id);

//   //     const perfil = await PerfilUsuario.findOne({
//   //       _id: req.params.id,
//   //       estado: { $ne: "ELIMINADO" },
//   //     })
//   //       .select("-password")
//   //       .populate(populatePerfil);

//   //     if (!perfil) {
//   //       return res.status(404).json({
//   //         error: "Perfil usuario no encontrado",
//   //       });
//   //     }

//   //     return res.status(200).json(perfil);
//   //   } catch (error) {
//   //     return responderError(
//   //       res,
//   //       error,
//   //       "Error al obtener el perfil usuario",
//   //     );
//   //   }
//   // };
// static getPerfilUsuarioById = async (
//   req: Request,
//   res: Response,
// ) => {
//   try {
//     /*
//      * validarIdParametro devuelve siempre un string
//      * con un ObjectId válido.
//      */
//     const perfilUsuarioId =
//       validarIdParametro(
//         req.params.id,
//       );

//     /*
//      * Se obtiene el perfil y se cargan:
//      * - roles
//      * - gestiones
//      */
//     const perfil =
//       await PerfilUsuario.findOne({
//         _id:
//           perfilUsuarioId,

//         estado: {
//           $ne:
//             "ELIMINADO",
//         },

//         fechaEliminado:
//           null,
//       })
//         .select("-password")
//         .populate([
//           {
//             path:
//               "roles",

//             select:
//               "_id nombre codigo descripcion permisos estado",
//           },
//           {
//             path:
//               "gestion",

//             select:
//               "_id anio nombre descripcion fechaInicio fechaFin fechaInicioInscripcion fechaFinInscripcion cupoMaximoHombres cupoMaximoMujeres cupoMaximo estado",
//           },
//         ]);

//     if (!perfil) {
//       return res.status(404).json({
//         error:
//           "Perfil usuario no encontrado",
//       });
//     }

//     /*
//      * Se buscan todos los documentos activos
//      * que pertenecen al usuario.
//      */
//     const documentos =
//       await DocumentoUsuario.find({
//         perfilUsuario:
//           perfilUsuarioId,

//         estado: {
//           $ne:
//             "ELIMINADO",
//         },

//         fechaEliminado:
//           null,
//       })
//         .select(
//           "_id tipoDocumento ruta estado observacion fechaCreado fechaEdit",
//         )
//         .sort({
//           tipoDocumento:
//             1,
//         });

//     /*
//      * Se convierte el documento Mongoose
//      * en un objeto para agregar documentos.
//      */
//     const perfilCompleto = {
//       ...perfil.toObject(),

//       documentos,
//     };

//     return res.status(200).json({
//       message:
//         "Perfil usuario obtenido correctamente",

//       perfil:
//         perfilCompleto,
//     });
//   } catch (error) {
//     return responderError(
//       res,
//       error,
//       "Error al obtener el perfil usuario",
//     );
//   }
// };

//   /* =========================================
//      ACTUALIZAR PERFIL
//   ========================================= */

//   static updatePerfilUsuario = async (
//     req: Request,
//     res: Response,
//   ) => {
//     try {
//       validarIdParametro(req.params.id);

//       if (req.body.estado === "ELIMINADO") {
//         return res.status(400).json({
//           error:
//             "Para eliminar un usuario debe utilizar el endpoint de eliminación lógica",
//         });
//       }

//       const rolesEntrada = obtenerRolesEntrada(req.body);
//       const gestionEntrada = obtenerGestionEntrada(req.body);
//       const archivo = obtenerArchivo(req);

//       const datosActualizables: Record<string, unknown> = {
//         nombres:
//           req.body.nombres !== undefined
//             ? textoRequerido(req.body.nombres, "nombres")
//             : undefined,

//         apellidoPaterno:
//           req.body.apellidoPaterno !== undefined
//             ? textoRequerido(
//                 req.body.apellidoPaterno,
//                 "apellido paterno",
//               )
//             : undefined,

//         apellidoMaterno:
//           req.body.apellidoMaterno !== undefined
//             ? textoOpcional(req.body.apellidoMaterno)
//             : undefined,

//         ci:
//           req.body.ci !== undefined
//             ? textoRequerido(req.body.ci, "ci")
//             : undefined,

//         complementoCi:
//           req.body.complementoCi !== undefined
//             ? textoOpcional(req.body.complementoCi)
//             : undefined,

//         expedidoCi:
//           req.body.expedidoCi !== undefined
//             ? textoOpcional(req.body.expedidoCi)
//             : undefined,

//         fechaNacimiento: req.body.fechaNacimiento,

//         sexo:
//           req.body.sexo !== undefined
//             ? textoOpcional(req.body.sexo)
//             : undefined,

//         telefono:
//           req.body.telefono !== undefined
//             ? textoRequerido(req.body.telefono, "teléfono")
//             : undefined,

//         email:
//           req.body.email !== undefined
//             ? normalizarEmail(req.body.email)
//             : undefined,

//         fotoPerfil: archivo
//           ? `/uploads/cuentas-perfil/${archivo.filename}`
//           : req.body.fotoPerfil,

//         tipoOrigen: req.body.tipoOrigen,
//         tipoFraterno: req.body.tipoFraterno,

//         registroUniversitario:
//           req.body.registroUniversitario !== undefined
//             ? textoOpcional(req.body.registroUniversitario)
//             : undefined,

//         facultad:
//           req.body.facultad !== undefined
//             ? textoOpcional(req.body.facultad)
//             : undefined,

//         carrera:
//           req.body.carrera !== undefined
//             ? textoOpcional(req.body.carrera)
//             : undefined,

//         estado: req.body.estado,
//         emailVerificado: req.body.emailVerificado,
//         requiereCambioPassword: req.body.requiereCambioPassword,
//       };

//       if (rolesEntrada !== undefined) {
//         datosActualizables.roles = normalizarObjectIds(
//           rolesEntrada,
//           "rol",
//         );
//       }

//       if (gestionEntrada !== undefined) {
//         datosActualizables.gestion = normalizarObjectIds(
//           gestionEntrada,
//           "ID de gestión",
//         );
//       }

//       const datosLimpios = Object.fromEntries(
//         Object.entries(datosActualizables).filter(
//           ([, valor]) => valor !== undefined,
//         ),
//       );

//       if (Object.keys(datosLimpios).length === 0) {
//         return res.status(400).json({
//           error: "No se enviaron campos para actualizar",
//         });
//       }

//       const perfil = await PerfilUsuario.findOneAndUpdate(
//         {
//           _id: req.params.id,
//           estado: { $ne: "ELIMINADO" },
//         },
//         {
//           $set: {
//             ...datosLimpios,
//             usuarioEdit: req.usuario?._id ?? null,
//             fechaEdit: new Date(),
//           },
//         },
//         {
//           new: true,
//           runValidators: true,
//           context: "query",
//         },
//       )
//         .select("-password")
//         .populate(populatePerfil);

//       if (!perfil) {
//         return res.status(404).json({
//           error: "Perfil usuario no encontrado",
//         });
//       }

//       return res.status(200).json({
//         message: "Perfil usuario actualizado correctamente",
//         perfil,
//       });
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al actualizar el perfil usuario",
//       );
//     }
//   };

//   /* =========================================
//      ELIMINACIÓN LÓGICA
//      No elimina el documento de MongoDB.
//   ========================================= */

//   static deletePerfilUsuario = async (
//     req: Request,
//     res: Response,
//   ) => {
//     try {
//       validarIdParametro(req.params.id);

//       const perfil = await PerfilUsuario.findOneAndUpdate(
//         {
//           _id: req.params.id,
//           estado: { $ne: "ELIMINADO" },
//         },
//         {
//           $set: {
//             estado: "ELIMINADO",
//             fechaEliminado: new Date(),
//             usuarioEliminador: req.usuario?._id ?? null,
//           },
//         },
//         {
//           new: true,
//           runValidators: true,
//         },
//       ).select("_id estado fechaEliminado usuarioEliminador");

//       if (!perfil) {
//         return res.status(404).json({
//           error: "Perfil usuario no encontrado o ya fue eliminado",
//         });
//       }

//       return res.status(200).json({
//         message: "Perfil usuario eliminado lógicamente",
//         perfil,
//       });
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al eliminar el perfil usuario",
//       );
//     }
//   };

//   /* =========================================
//      OBTENER USUARIO AUTENTICADO
//   ========================================= */

//   static usuario = async (req: Request, res: Response) => {
//     try {
//       if (!req.usuario?._id) {
//         return res.status(401).json({
//           error: "Usuario no autenticado",
//         });
//       }

//       const perfil = await PerfilUsuario.findOne({
//         _id: req.usuario._id,
//         estado: { $ne: "ELIMINADO" },
//       })
//         .select("-password")
//         .populate(populatePerfil);

//       if (!perfil) {
//         return res.status(404).json({
//           error: "Usuario no encontrado",
//         });
//       }

//       return res.status(200).json(perfil);
//     } catch (error) {
//       return responderError(
//         res,
//         error,
//         "Error al obtener el usuario autenticado",
//       );
//     }
//   };
//   /* =========================================
//    OBTENER PERFIL COMPLETO POR ID
//    Incluye roles, gestiones y documentos
// ========================================= */


// }

import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import crypto from "node:crypto";

import PerfilUsuario from "../models/PerfilUsuario";
import DocumentoUsuario from "../models/DocumentoUsuario";
import {
  comprimirPdfOptimizado,
  verificarArchivoPdf,
} from "../services/pdfService";
import { generateJWT } from "../utils/jst";
import { crearPreregistroParaUsuario } from "./PreregistroController";
import { registrarAuditoria } from "../services/AuditoriaService";
import { consumirTokenRegistro } from "./TokenRegistroController";
import TokenRegistro from "../models/TokenRegistro";
import Cuota from "../models/Cuota";
import Rol from "../models/Rol";
import { subirArchivoProcesado } from "../services/AlmacenamientoService";

class SolicitudInvalidaError extends Error {}

const normalizarEmail = (valor: unknown): string => {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new SolicitudInvalidaError("El correo es obligatorio");
  }

  return valor.trim().toLowerCase();
};

const textoRequerido = (
  valor: unknown,
  nombreCampo: string,
): string => {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new SolicitudInvalidaError(
      `El campo ${nombreCampo} es obligatorio`,
    );
  }

  return valor.trim();
};

const textoOpcional = (valor: unknown): string | undefined => {
  if (valor === undefined || valor === null) {
    return undefined;
  }

  if (typeof valor !== "string") {
    throw new SolicitudInvalidaError(
      "Uno de los campos de texto tiene un formato inválido",
    );
  }

  const texto = valor.trim();
  return texto || undefined;
};

const obtenerArchivo = (
  req: Request,
): { filename: string; path: string; mimetype: string } | undefined =>
  (
    req as Request & {
      file?: {
        filename: string;
        path: string;
        mimetype: string;
      };
    }
  ).file;


type ArchivoRegistro = {
  fieldname: string;
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
};

const esArchivoPdfRegistro = (archivo?: ArchivoRegistro): boolean => Boolean(
  archivo && (archivo.mimetype === "application/pdf" || path.extname(archivo.filename).toLowerCase() === ".pdf"),
);

type ArchivosRegistroCuenta = {
  fotoPerfil?: ArchivoRegistro[];
  carnetIdentidadPdf?: ArchivoRegistro[];
  carnetIdentidadReverso?: ArchivoRegistro[];
  registroUniversitarioPdf?: ArchivoRegistro[];
};

const obtenerArchivosRegistro = (
  req: Request,
): ArchivosRegistroCuenta => {
  const archivos = (
    req as Request & {
      files?: ArchivosRegistroCuenta;
    }
  ).files;

  return archivos ?? {};
};

const obtenerPrimerArchivo = (
  archivos: ArchivosRegistroCuenta,
  campo: keyof ArchivosRegistroCuenta,
): ArchivoRegistro | undefined =>
  archivos[campo]?.[0];

const limpiarNombreArchivo = (
  valor: string,
): string =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const eliminarRutaSiExiste = async (
  ruta?: string,
): Promise<void> => {
  if (!ruta) {
    return;
  }

  try {
    await fs.rm(ruta, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.error(
      `No se pudo eliminar la ruta temporal ${ruta}:`,
      error,
    );
  }
};


/**
 * Acepta un solo ID o un arreglo de IDs y siempre devuelve ObjectId[].
 * También elimina IDs repetidos.
 */
const normalizarObjectIds = (
  valor: unknown,
  nombreCampo: string,
): mongoose.Types.ObjectId[] => {
  const valores = Array.isArray(valor)
    ? valor
    : valor !== undefined && valor !== null && valor !== ""
      ? [valor]
      : [];

  if (valores.length === 0) {
    throw new SolicitudInvalidaError(
      `Debe enviar al menos un ${nombreCampo}`,
    );
  }

  const idsComoTexto = valores.map((item) => String(item).trim());

  const idInvalido = idsComoTexto.find(
    (id) => !mongoose.isValidObjectId(id),
  );

  if (idInvalido) {
    throw new SolicitudInvalidaError(
      `El ID enviado en ${nombreCampo} no es válido`,
    );
  }

  return [...new Set(idsComoTexto)].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
};

const validarIdParametro = (
   valor: string | string[] | undefined,
): string => {
  const id = Array.isArray(valor)
    ? valor[0]
    : valor;

  if (
    typeof id !== "string" ||
    !id.trim() ||
    !mongoose.isValidObjectId(id.trim())
  ) {
    throw new SolicitudInvalidaError(
      "El ID del usuario no es válido",
    );
  }

  return id.trim();
};

const obtenerRolesEntrada = (body: Request["body"]): unknown =>
  body.roles ?? body.rolId ?? body.rol;

const obtenerGestionEntrada = (body: Request["body"]): unknown =>
  body.gestion ?? body.gestionId;

const responderError = (
  res: Response,
  error: unknown,
  mensajeInterno: string,
) => {
  console.error(mensajeInterno, error);

  if (error instanceof SolicitudInvalidaError) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (error instanceof Error && /token|cupo|gestión seleccionada/i.test(error.message)) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: "Uno de los identificadores enviados no es válido",
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const errores = Object.values(error.errors).map(
      (detalle) =>
        (detalle as { message?: string }).message ??
        "Error de validación",
    );

    return res.status(400).json({
      error: "Los datos enviados no son válidos",
      detalles: errores,
    });
  }

  const errorMongo = error as {
    code?: number;
    keyPattern?: Record<string, number>;
  };

  if (errorMongo?.code === 11000) {
    const campo = Object.keys(errorMongo.keyPattern ?? {})[0];

    const mensaje =
      campo === "email"
        ? "El correo ya está registrado"
        : campo === "ci"
          ? "El CI ya está registrado"
          : "Existe otro usuario con los mismos datos únicos";

    return res.status(409).json({
      error: mensaje,
    });
  }

  return res.status(500).json({
    error: mensajeInterno,
  });
};

const populatePerfil = [
  {
    path: "roles",
    select: "_id nombre codigo descripcion permisos estado",
  },
  {
    path: "gestion",
  },
];

export class PerfilUsuarioController {
  /* =========================================
     CREAR / REGISTRAR CUENTA
  ========================================= */

  static registrarCuenta = async (
    req: Request,
    res: Response,
  ) => {
    const session =
      await mongoose.startSession();

    const rutasTemporales:
      string[] = [];

    const rutasGeneradas:
      string[] = [];

    let carpetaPerfil:
      string | undefined;

    try {
      const archivos =
        obtenerArchivosRegistro(
          req,
        );

      const fotoPerfilArchivo =
        obtenerPrimerArchivo(
          archivos,
          "fotoPerfil",
        );

      const carnetIdentidadPdf =
        obtenerPrimerArchivo(
          archivos,
          "carnetIdentidadPdf",
        );
      const carnetIdentidadReverso = obtenerPrimerArchivo(archivos, "carnetIdentidadReverso");

      const registroUniversitarioPdf =
        obtenerPrimerArchivo(
          archivos,
          "registroUniversitarioPdf",
        );

      for (
        const archivo of [
          fotoPerfilArchivo,
          carnetIdentidadPdf,
          carnetIdentidadReverso,
          registroUniversitarioPdf,
        ]
      ) {
        if (archivo?.path) {
          rutasTemporales.push(
            archivo.path,
          );
        }
      }

      if (!carnetIdentidadPdf) {
        throw new SolicitudInvalidaError(
          "Debe adjuntar el carnet de identidad como PDF o imagen",
        );
      }
      if (!fotoPerfilArchivo) throw new SolicitudInvalidaError("La foto de perfil es obligatoria");
      if (!esArchivoPdfRegistro(carnetIdentidadPdf) && !carnetIdentidadReverso) throw new SolicitudInvalidaError("Debe adjuntar anverso y reverso del carnet cuando utiliza imágenes");
      if (esArchivoPdfRegistro(carnetIdentidadReverso)) throw new SolicitudInvalidaError("El reverso del carnet debe ser una imagen");

      if (
        esArchivoPdfRegistro(carnetIdentidadPdf) &&
        !(await verificarArchivoPdf(carnetIdentidadPdf.path))
      ) {
        throw new SolicitudInvalidaError(
          "El archivo del carnet de identidad no es un PDF válido",
        );
      }

      if (
        esArchivoPdfRegistro(registroUniversitarioPdf) &&
        !(await verificarArchivoPdf(registroUniversitarioPdf.path))
      ) {
        throw new SolicitudInvalidaError(
          "El archivo del registro universitario no es un PDF válido",
        );
      }

      const email =
        normalizarEmail(
          req.body.email,
        );

      const ci =
        textoRequerido(
          req.body.ci,
          "ci",
        );

      const registroUniversitario =
        textoOpcional(
          req.body
            .registroUniversitario,
        );

      const perteneceUmsa = ["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(String(req.body.tipoOrigen));
      if (perteneceUmsa && !registroUniversitario) {
        throw new SolicitudInvalidaError("Debe ingresar su número de registro universitario por pertenecer a la UMSA");
      }
      if (perteneceUmsa && !registroUniversitarioPdf) {
        throw new SolicitudInvalidaError("Debe adjuntar una imagen o PDF de su registro universitario por pertenecer a la UMSA");
      }
      const carreraRegistro = textoOpcional(req.body.carrera);
      if (perteneceUmsa && !carreraRegistro) {
        throw new SolicitudInvalidaError("Debe ingresar su carrera por pertenecer a la UMSA");
      }
      const esOtraFacultadUmsa = String(req.body.tipoOrigen) === "EXTERNO_UMSA";
      const facultadRegistro = esOtraFacultadUmsa
        ? textoOpcional(req.body.facultad)
        : perteneceUmsa
          ? "FACULTAD DE CIENCIAS PURAS Y NATURALES"
          : undefined;
      if (esOtraFacultadUmsa && !facultadRegistro) {
        throw new SolicitudInvalidaError("Debe ingresar su facultad cuando pertenece a otra facultad de la UMSA");
      }

      const passwordPlano =
        textoRequerido(
          req.body.password,
          "password",
        );

      let roles =
        normalizarObjectIds(
          obtenerRolesEntrada(
            req.body,
          ),
          "rol",
        );

      // Quien se registra con invitación todavía es postulante. El rol
      // FRATERNO se añade únicamente al verificar su primer pago.
      if (req.body.tokenRegistro) {
        const rolPostulante = await Rol.findOne({ codigo: "POSTULANTE", estado: true, fechaEliminado: null }).select("_id");
        if (rolPostulante) roles = [rolPostulante._id];
      }

      const gestion =
        normalizarObjectIds(
          obtenerGestionEntrada(
            req.body,
          ),
          "ID de gestión",
        );

      const password =
        await bcrypt.hash(
          passwordPlano,
          10,
        );

      session.startTransaction();

      const cuentaExistente =
        await PerfilUsuario.findOne({
          $or: [
            { email },
            { ci },
          ],
        })
          .select(
            "email ci estado",
          )
          .session(
            session,
          );

      if (cuentaExistente) {
        const mensaje =
          cuentaExistente.email ===
          email
            ? "El correo ya está registrado"
            : "El CI ya está registrado";

        throw new SolicitudInvalidaError(
          mensaje,
        );
      }

      /*
       * Primero se crea el documento de PerfilUsuario.
       * MongoDB genera aquí el _id que se utilizará
       * para relacionar y organizar sus documentos.
       */
      const apellidoPaterno = textoOpcional(req.body.apellidoPaterno);
      const apellidoMaterno = textoOpcional(req.body.apellidoMaterno);
      if (!apellidoPaterno && !apellidoMaterno) {
        throw new SolicitudInvalidaError("Debe ingresar al menos un apellido");
      }

      const perfil =
        new PerfilUsuario({
          roles,
          gestion,

          nombres:
            textoRequerido(
              req.body.nombres,
              "nombres",
            ),

          apellidoPaterno:
            apellidoPaterno || "",

          apellidoMaterno:
            apellidoMaterno,

          ci,

          complementoCi:
            textoOpcional(
              req.body
                .complementoCi,
            ),

          expedidoCi:
            textoOpcional(
              req.body
                .expedidoCi,
            ),

          fechaNacimiento:
            req.body
              .fechaNacimiento ||
            undefined,

          sexo:
            textoOpcional(
              req.body.sexo,
            ),

          telefono:
            textoRequerido(
              req.body.telefono,
              "teléfono",
            ),

          email,

          fotoPerfil:
            undefined,

          tipoOrigen:
            req.body
              .tipoOrigen,

          tipoFraterno:
            req.body
              .tipoFraterno,

          registroUniversitario,

          facultad:
            facultadRegistro,

          carrera:
            carreraRegistro,

          password,

          estado:
            "PENDIENTE",

          emailVerificado:
            false,

          intentosFallidos:
            0,

          bloqueadoHasta:
            null,

          ultimoLogin:
            null,

          ultimoCambioPassword:
            new Date(),

          requiereCambioPassword:
            false,

          fechaCreado:
            new Date(),

          usuarioCreador:
            req.usuario?._id ??
            null,

          fechaEdit:
            null,

          usuarioEdit:
            null,

          fechaEliminado:
            null,

          usuarioEliminador:
            null,
        });

      await perfil.save({
        session,
      });

      const resultadoToken = await consumirTokenRegistro(
        req.body.tokenRegistro,
        perfil,
        session,
      );

      /*
       * Todos los archivos definitivos del usuario se organizan
       * dentro de una sola carpeta identificada por su CI:
       *
       * public/uploads/cuentas-perfil/<CI>/
       *
       * Ejemplo:
       * public/uploads/cuentas-perfil/8990/
       * ├── FOTO_8990.webp
       * ├── CI_8990.pdf
       * └── RU_8990.pdf
       */
      const ciSeguro =
        limpiarNombreArchivo(
          ci,
        );

      if (!ciSeguro) {
        throw new SolicitudInvalidaError(
          "El CI no permite generar un nombre de carpeta válido",
        );
      }

      const complemento =
        perfil.complementoCi
          ? `_${limpiarNombreArchivo(
              perfil.complementoCi,
            )}`
          : "";

      const nombreBaseCi =
        `${ciSeguro}${complemento}`;

      carpetaPerfil =
        path.resolve(
          process.cwd(),
          "public",
          "uploads",
          "cuentas-perfil",
          ciSeguro,
        );

      await fs.mkdir(
        carpetaPerfil,
        {
          recursive: true,
        },
      );

      const rutaPublicaCarpeta =
        `/uploads/cuentas-perfil/${ciSeguro}`;

      /*
       * Procesar fotografía de perfil.
       */
      if (fotoPerfilArchivo) {
        const nombreFoto =
          `FOTO_${nombreBaseCi}.webp`;

        const rutaFoto =
          path.join(
            carpetaPerfil,
            nombreFoto,
          );

        try {
          await sharp(
            fotoPerfilArchivo.path,
          )
            .rotate()
            .resize({
              width: 1000,
              height: 1000,
              fit: "inside",
              withoutEnlargement:
                true,
            })
            .webp({
              quality: 80,
              effort: 4,
            })
            .toFile(
              rutaFoto,
            );
        } catch {
          throw new SolicitudInvalidaError(
            "La fotografía de perfil está incompleta o dañada. Vuelve a tomarla o selecciona otra imagen.",
          );
        }

        rutasGeneradas.push(
          rutaFoto,
        );

        perfil.fotoPerfil =
          `${rutaPublicaCarpeta}/${nombreFoto}`;

        await subirArchivoProcesado(
          perfil.fotoPerfil,
          rutaFoto,
          "image/webp",
        );

        await perfil.save({
          session,
        });
      }

      const procesarDocumento = async (
        archivo: ArchivoRegistro,
        prefijo: "CI" | "CI_REVERSO" | "RU",
      ): Promise<string> => {
        const esPdf = esArchivoPdfRegistro(archivo);
        const nombre = `${prefijo}_${nombreBaseCi}.${esPdf ? "pdf" : "webp"}`;
        const rutaSalida = path.join(carpetaPerfil!, nombre);

        try {
          if (esPdf) {
            await comprimirPdfOptimizado({
              rutaEntrada: archivo.path,
              rutaSalida,
            });
          } else {
            await sharp(archivo.path)
              .rotate()
              .resize({
                width: 1800,
                height: 1800,
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp({ quality: 78, effort: 4 })
              .toFile(rutaSalida);
          }
        } catch {
          const nombreDocumento = prefijo === "CI"
            ? "carnet de identidad (anverso)"
            : prefijo === "CI_REVERSO"
              ? "carnet de identidad (reverso)"
              : "registro universitario";
          throw new SolicitudInvalidaError(
            `El archivo del ${nombreDocumento} está incompleto, dañado o no es una imagen/PDF válido. Vuelve a tomarlo o selecciona otro archivo.`,
          );
        }

        rutasGeneradas.push(rutaSalida);
        await subirArchivoProcesado(
          `${rutaPublicaCarpeta}/${nombre}`,
          rutaSalida,
          esPdf ? "application/pdf" : "image/webp",
        );
        return nombre;
      };

      const nombreCarnet = carnetIdentidadPdf
        ? await procesarDocumento(carnetIdentidadPdf, "CI")
        : undefined;
      const nombreCarnetReverso = carnetIdentidadReverso
        ? await procesarDocumento(carnetIdentidadReverso, "CI_REVERSO")
        : undefined;

      const nombreRegistro = registroUniversitarioPdf
        ? await procesarDocumento(registroUniversitarioPdf, "RU")
        : undefined;

      /*
       * Los dos documentos quedan relacionados
       * con el _id del PerfilUsuario recién creado.
       */
      const documentosNuevos = [
        nombreCarnet
          ? {
            perfilUsuario:
              perfil._id,

            tipoDocumento:
              "CARNET_IDENTIDAD",

            ruta:
              `${rutaPublicaCarpeta}/${nombreCarnet}`,

            estado:
              "PENDIENTE",

            observacion:
              null,

            fechaCreado:
              new Date(),

            usuarioCreador:
              req.usuario?._id ??
              perfil._id,

            fechaEdit:
              null,

            usuarioEdit:
              null,

            fechaEliminado:
              null,

            usuarioEliminador:
              null,
          }
          : null,
        nombreRegistro
          ? {
            perfilUsuario:
              perfil._id,

            tipoDocumento:
              "REGISTRO_UNIVERSITARIO",

            ruta:
              `${rutaPublicaCarpeta}/${nombreRegistro}`,

            estado:
              "PENDIENTE",

            observacion:
              null,

            fechaCreado:
              new Date(),

            usuarioCreador:
              req.usuario?._id ??
              perfil._id,

            fechaEdit:
              null,

            usuarioEdit:
              null,

            fechaEliminado:
              null,

            usuarioEliminador:
              null,
          }
          : null,
        nombreCarnetReverso ? {
          perfilUsuario: perfil._id,
          tipoDocumento: "CARNET_IDENTIDAD_REVERSO",
          ruta: `${rutaPublicaCarpeta}/${nombreCarnetReverso}`,
          estado: "PENDIENTE",
          observacion: null,
          fechaCreado: new Date(),
          usuarioCreador: req.usuario?._id ?? perfil._id,
          fechaEdit: null, usuarioEdit: null, fechaEliminado: null, usuarioEliminador: null,
        } : null,
      ].filter((documento): documento is NonNullable<typeof documento> => documento !== null);

      if (documentosNuevos.length > 0) {
        await DocumentoUsuario.insertMany(
          documentosNuevos,
          { session },
        );
      }

      await session.commitTransaction();

      /*
       * Los archivos recibidos por Multer eran temporales.
       * Ya pueden eliminarse porque existen las versiones finales.
       */
      await Promise.allSettled(
        rutasTemporales.map(
          eliminarRutaSiExiste,
        ),
      );

      await perfil.populate(
        populatePerfil,
      );

      const documentos =
        await DocumentoUsuario.find({
          perfilUsuario:
            perfil._id,

          fechaEliminado:
            null,
        }).sort({
          tipoDocumento:
            1,
        });

      const {
        password:
          _password,
        ...perfilSeguro
      } = perfil.toObject();

      return res.status(201).json({
        message:
          "Solicitud registrada correctamente. Administración debe dar de alta tu cuenta antes de que puedas ingresar.",

        perfil:
          perfilSeguro,

        documentos,
        fechaLimitePago: resultadoToken.fechaVencimiento,
      });
    } catch (error) {
      if (
        session.inTransaction()
      ) {
        await session.abortTransaction();
      }

      /*
       * Si falla el usuario, un PDF o DocumentoUsuario,
       * se eliminan tanto los temporales como los archivos
       * finales para no dejar información huérfana.
       */
      await Promise.allSettled(
        [
          ...rutasTemporales,
          ...rutasGeneradas,
        ].map(
          eliminarRutaSiExiste,
        ),
      );

      if (carpetaPerfil) {
        await eliminarRutaSiExiste(
          carpetaPerfil,
        );
      }

      return responderError(
        res,
        error,
        "Error al registrar la cuenta y sus documentos",
      );
    } finally {
      await session.endSession();
    }
  };

  /* =========================================
     INICIAR SESIÓN
  ========================================= */

  static login = async (req: Request, res: Response) => {
    try {
      const email = normalizarEmail(req.body.email);
      const passwordIngresado = textoRequerido(
        req.body.password,
        "password",
      );

      const perfil = await PerfilUsuario.findOne({
        email,
        estado: { $ne: "ELIMINADO" },
      })
        .select("+password")
        .populate(populatePerfil);

      if (!perfil) {
        return res.status(401).json({
          error: "Correo o contraseña incorrectos",
        });
      }

      if (perfil.estado === "PENDIENTE") {
        return res.status(403).json({
          error: "La cuenta todavía está pendiente de aprobación",
        });
      }

      if (perfil.estado === "INACTIVO") {
        return res.status(403).json({
          error: "La cuenta se encuentra inactiva",
        });
      }

      if (perfil.estado === "BLOQUEADO") {
        return res.status(403).json({
          error: "La cuenta se encuentra bloqueada",
        });
      }

      const ahora = new Date();

      if (perfil.bloqueadoHasta && perfil.bloqueadoHasta > ahora) {
        return res.status(403).json({
          error: "La cuenta está bloqueada temporalmente",
          bloqueadoHasta: perfil.bloqueadoHasta,
        });
      }

      const passwordCorrecto = await bcrypt.compare(
        passwordIngresado,
        perfil.password,
      );

      if (!passwordCorrecto) {
        perfil.intentosFallidos += 1;

        if (perfil.intentosFallidos >= 5) {
          perfil.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
        }

        await perfil.save();

        return res.status(401).json({
          error: "Correo o contraseña incorrectos",
        });
      }

      perfil.intentosFallidos = 0;
      perfil.bloqueadoHasta = null;
      perfil.ultimoLogin = ahora;

      await perfil.save();
      await perfil.populate(populatePerfil);

      const tokenjwt = generateJWT({
        id: perfil._id.toString(),
        name: perfil.nombres,
      });

      const { password: _password, ...usuarioSeguro } = perfil.toObject();

      await registrarAuditoria(req, {
        usuarioId: perfil._id,
        accion: "INICIAR_SESION",
        modulo: "AUTENTICACION",
        entidad: "PerfilUsuario",
        entidadId: perfil._id,
        descripcion: "El usuario inició sesión",
      });

      return res.status(200).json({
        message: "Login correcto",
        tokenjwt,
        usuario: usuarioSeguro,
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al iniciar sesión",
      );
    }
  };

  /* =========================================
     ACTUALIZAR CONTRASEÑA
  ========================================= */

  static updatePassword = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      validarIdParametro(id);
      if (String(req.usuario?._id) !== String(id)) return res.status(403).json({ error: "Solo puede cambiar su propia contraseña" });

      const passwordActual = textoRequerido(
        req.body.passwordActual,
        "contraseña actual",
      );
      const passwordNueva = textoRequerido(
        req.body.passwordNueva,
        "contraseña nueva",
      );

      const perfil = await PerfilUsuario.findOne({
        _id: id,
        estado: { $ne: "ELIMINADO" },
      }).select("+password");

      if (!perfil) {
        return res.status(404).json({
          error: "Usuario no encontrado",
        });
      }

      const passwordCorrecto = await bcrypt.compare(
        passwordActual,
        perfil.password,
      );

      if (!passwordCorrecto) {
        return res.status(400).json({
          error: "Contraseña actual incorrecta",
        });
      }

      perfil.password = await bcrypt.hash(passwordNueva, 10);
      perfil.ultimoCambioPassword = new Date();
      perfil.requiereCambioPassword = false;
      perfil.usuarioEdit = req.usuario?._id ?? undefined;
      perfil.fechaEdit = new Date();

      await perfil.save();

      return res.status(200).json({
        message: "Contraseña actualizada correctamente",
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al actualizar la contraseña",
      );
    }
  };

  static generarPasswordTemporal = async (req: Request, res: Response) => {
    try {
      const id = validarIdParametro(req.params.id);
      const passwordTemporal = `${crypto.randomBytes(8).toString("base64url")}Aa1!`;
      const perfil = await PerfilUsuario.findOne({ _id: id, estado: { $ne: "ELIMINADO" } }).select("+password nombres apellidoPaterno email");
      if (!perfil) return res.status(404).json({ error: "Usuario no encontrado" });
      perfil.password = await bcrypt.hash(passwordTemporal, 10);
      perfil.requiereCambioPassword = true;
      perfil.ultimoCambioPassword = new Date();
      perfil.usuarioEdit = req.usuario?._id ?? undefined;
      perfil.fechaEdit = new Date();
      await perfil.save();
      await registrarAuditoria(req, { usuarioId: req.usuario?._id, accion: "RESTABLECER_PASSWORD", modulo: "AUTENTICACION", entidad: "PerfilUsuario", entidadId: perfil._id, descripcion: `El administrador generó una contraseña temporal para ${perfil.email}` });
      return res.json({ message: "Contraseña temporal generada", passwordTemporal, usuario: `${perfil.nombres} ${perfil.apellidoPaterno}`.trim() });
    } catch (error) { return responderError(res, error, "No se pudo generar la contraseña temporal"); }
  };

  /* =========================================
     OBTENER TODOS LOS USUARIOS NO ELIMINADOS
  ========================================= */

  static getAllPerfilUsuarios = async (
    _req: Request,
    res: Response,
  ) => {
    try {
      const perfiles = await PerfilUsuario.find({
        estado: { $ne: "ELIMINADO" },
      })
        .select("-password")
        .populate(populatePerfil)
        .sort({
          apellidoPaterno: 1,
          apellidoMaterno: 1,
          nombres: 1,
        });

      return res.status(200).json({
        total: perfiles.length,
        perfiles,
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al obtener los perfiles",
      );
    }
  };

  /* =========================================
     OBTENER USUARIO POR ID
  ========================================= */

  // static getPerfilUsuarioById = async (
  //   req: Request,
  //   res: Response,
  // ) => {
  //   try {
  //     validarIdParametro(req.params.id);

  //     const perfil = await PerfilUsuario.findOne({
  //       _id: req.params.id,
  //       estado: { $ne: "ELIMINADO" },
  //     })
  //       .select("-password")
  //       .populate(populatePerfil);

  //     if (!perfil) {
  //       return res.status(404).json({
  //         error: "Perfil usuario no encontrado",
  //       });
  //     }

  //     return res.status(200).json(perfil);
  //   } catch (error) {
  //     return responderError(
  //       res,
  //       error,
  //       "Error al obtener el perfil usuario",
  //     );
  //   }
  // };
static getPerfilUsuarioById = async (
  req: Request,
  res: Response,
) => {
  try {
    /*
     * validarIdParametro devuelve siempre un string
     * con un ObjectId válido.
     */
    const perfilUsuarioId =
      validarIdParametro(
        req.params.id,
      );

    /*
     * Se obtiene el perfil y se cargan:
     * - roles
     * - gestiones
     */
    const perfil =
      await PerfilUsuario.findOne({
        _id:
          perfilUsuarioId,

        estado: {
          $ne:
            "ELIMINADO",
        },

        fechaEliminado:
          null,
      })
        .select("-password")
        .populate([
          {
            path:
              "roles",

            select:
              "_id nombre codigo descripcion permisos estado",
          },
          {
            path:
              "gestion",

            select:
              "_id anio nombre descripcion fechaInicio fechaFin fechaInicioInscripcion fechaFinInscripcion cupoMaximoHombres cupoMaximoMujeres cupoMaximo estado",
          },
        ]);

    if (!perfil) {
      return res.status(404).json({
        error:
          "Perfil usuario no encontrado",
      });
    }

    /*
     * Se buscan todos los documentos activos
     * que pertenecen al usuario.
     */
    const documentos =
      await DocumentoUsuario.find({
        perfilUsuario:
          perfilUsuarioId,

        estado: {
          $ne:
            "ELIMINADO",
        },

        fechaEliminado:
          null,
      })
        .select(
          "_id tipoDocumento ruta estado observacion fechaCreado fechaEdit",
        )
        .sort({
          tipoDocumento:
            1,
        });

    /*
     * Se convierte el documento Mongoose
     * en un objeto para agregar documentos.
     */
    const perfilCompleto = {
      ...perfil.toObject(),

      documentos,
    };

    return res.status(200).json({
      message:
        "Perfil usuario obtenido correctamente",

      perfil:
        perfilCompleto,
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "Error al obtener el perfil usuario",
    );
  }
};

  /* =========================================
     ACTUALIZAR PERFIL
  ========================================= */

  static updatePerfilUsuario = async (
    req: Request,
    res: Response,
  ) => {
    try {
      validarIdParametro(req.params.id);

      const perfilAnterior = await PerfilUsuario.findById(req.params.id).select(
        "estado ci apellidoPaterno apellidoMaterno",
      );
      if (!perfilAnterior) return res.status(404).json({ error: "Perfil no encontrado" });

      if (req.body.estado === "ELIMINADO") {
        return res.status(400).json({
          error:
            "Para eliminar un usuario debe utilizar el endpoint de eliminación lógica",
        });
      }

      const rolesEntrada = obtenerRolesEntrada(req.body);
      const gestionEntrada = obtenerGestionEntrada(req.body);
      const archivo = obtenerArchivo(req);
      let rutaFotoNueva: string | undefined;
      if (archivo) {
        const ciFoto = limpiarNombreArchivo(String(req.body.ci || perfilAnterior.ci));
        const carpetaFoto = path.resolve(process.cwd(), "public", "uploads", "cuentas-perfil", ciFoto);
        await fs.mkdir(carpetaFoto, { recursive: true });
        const nombreFoto = `FOTO_${ciFoto}.webp`;
        const salidaFoto = path.join(carpetaFoto, nombreFoto);
        await sharp(archivo.path).rotate().resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(salidaFoto);
        await eliminarRutaSiExiste(archivo.path);
        rutaFotoNueva = `/uploads/cuentas-perfil/${ciFoto}/${nombreFoto}`;
        await subirArchivoProcesado(rutaFotoNueva, salidaFoto, "image/webp");
      }

      const actualizaApellidos =
        req.body.apellidoPaterno !== undefined ||
        req.body.apellidoMaterno !== undefined;
      const apellidoPaternoActualizado = req.body.apellidoPaterno !== undefined
        ? textoOpcional(req.body.apellidoPaterno)
        : perfilAnterior.apellidoPaterno;
      const apellidoMaternoActualizado = req.body.apellidoMaterno !== undefined
        ? textoOpcional(req.body.apellidoMaterno)
        : perfilAnterior.apellidoMaterno;
      if (
        actualizaApellidos &&
        !apellidoPaternoActualizado &&
        !apellidoMaternoActualizado
      ) {
        throw new SolicitudInvalidaError("Debe ingresar al menos un apellido");
      }

      const datosActualizables: Record<string, unknown> = {
        nombres:
          req.body.nombres !== undefined
            ? textoRequerido(req.body.nombres, "nombres")
            : undefined,

        apellidoPaterno:
          req.body.apellidoPaterno !== undefined
            ? apellidoPaternoActualizado || ""
            : undefined,

        apellidoMaterno:
          req.body.apellidoMaterno !== undefined
            ? textoOpcional(req.body.apellidoMaterno)
            : undefined,

        ci:
          req.body.ci !== undefined
            ? textoRequerido(req.body.ci, "ci")
            : undefined,

        complementoCi:
          req.body.complementoCi !== undefined
            ? textoOpcional(req.body.complementoCi)
            : undefined,

        expedidoCi:
          req.body.expedidoCi !== undefined
            ? textoOpcional(req.body.expedidoCi)
            : undefined,

        fechaNacimiento: req.body.fechaNacimiento,

        sexo:
          req.body.sexo !== undefined
            ? textoOpcional(req.body.sexo)
            : undefined,

        telefono:
          req.body.telefono !== undefined
            ? textoRequerido(req.body.telefono, "teléfono")
            : undefined,

        email:
          req.body.email !== undefined
            ? normalizarEmail(req.body.email)
            : undefined,

        fotoPerfil: rutaFotoNueva
          ? rutaFotoNueva
          : req.body.fotoPerfil,

        tipoOrigen: req.body.tipoOrigen,
        tipoFraterno: req.body.tipoFraterno,

        registroUniversitario:
          req.body.registroUniversitario !== undefined
            ? textoOpcional(req.body.registroUniversitario)
            : undefined,

        facultad:
          req.body.facultad !== undefined
            ? textoOpcional(req.body.facultad)
            : undefined,

        carrera:
          req.body.carrera !== undefined
            ? textoOpcional(req.body.carrera)
            : undefined,

        estado: req.body.estado,
        emailVerificado: req.body.emailVerificado,
        requiereCambioPassword: req.body.requiereCambioPassword,
      };

      if (rolesEntrada !== undefined) {
        datosActualizables.roles = normalizarObjectIds(
          rolesEntrada,
          "rol",
        );
      }

      if (gestionEntrada !== undefined) {
        datosActualizables.gestion = normalizarObjectIds(
          gestionEntrada,
          "ID de gestión",
        );
      }

      const datosLimpios = Object.fromEntries(
        Object.entries(datosActualizables).filter(
          ([, valor]) => valor !== undefined,
        ),
      );

      if (Object.keys(datosLimpios).length === 0) {
        return res.status(400).json({
          error: "No se enviaron campos para actualizar",
        });
      }

      const perfil = await PerfilUsuario.findOneAndUpdate(
        {
          _id: req.params.id,
          estado: { $ne: "ELIMINADO" },
        },
        {
          $set: {
            ...datosLimpios,
            usuarioEdit: req.usuario?._id ?? null,
            fechaEdit: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          context: "query",
        },
      )
        .select("-password")
        .populate(populatePerfil);

      if (!perfil) {
        return res.status(404).json({
          error: "Perfil usuario no encontrado",
        });
      }

      /*
       * Al activar un postulante se genera su preregistro en la gestión
       * disponible. El helper es idempotente y no duplica usuario/gestión.
       */
      if (req.body.estado === "ACTIVO" && perfilAnterior?.estado !== "ACTIVO") {
        const esPostulante = perfil.roles.some((rol) => {
          if (!rol || typeof rol !== "object") return false;
          const datosRol = rol as unknown as { codigo?: string; nombre?: string };
          return [datosRol.codigo, datosRol.nombre]
            .some((valor) => String(valor ?? "").trim().toUpperCase() === "POSTULANTE");
        });

        if (esPostulante) {
          try {
            await crearPreregistroParaUsuario({
              usuarioId: perfil._id,
              creadorId: req.usuario?._id,
            });
          } catch (causa) {
            await PerfilUsuario.updateOne(
              { _id: perfil._id },
              { $set: { estado: perfilAnterior.estado } },
            );
            return res.status(409).json({
              error: causa instanceof Error
                ? `No se pudo activar el perfil: ${causa.message}`
                : "No se pudo crear el preregistro del postulante",
            });
          }
        }

        // En las cuentas creadas mediante invitación, el plazo de pago
        // empieza exactamente cuando administración da de alta al usuario.
        const invitacion = await TokenRegistro.findOne({
          utilizadoPor: perfil._id,
          estado: "UTILIZADO",
        }).sort({ fechaUtilizado: -1 });

        if (invitacion?.cuotaId) {
          const cuotaInvitacion = await Cuota.findById(invitacion.cuotaId);
          if (cuotaInvitacion && !cuotaInvitacion.fechaVencimiento) {
            const horas = invitacion.plazoPagoHoras || 72;
            cuotaInvitacion.fechaVencimiento = new Date(Date.now() + horas * 60 * 60 * 1000);
            cuotaInvitacion.observacion = `${cuotaInvitacion.observacion ?? ""} Cuenta dada de alta; plazo de pago iniciado.`.trim();
            cuotaInvitacion.usuarioEditor = req.usuario?._id;
            cuotaInvitacion.fechaEditado = new Date();
            await cuotaInvitacion.save();
          }
        }
      }

      return res.status(200).json({
        message: req.body.estado === "ACTIVO"
          ? "Perfil dado de alta correctamente. El usuario ya puede ingresar y comenzó su plazo de pago"
          : "Perfil usuario actualizado correctamente",
        perfil,
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al actualizar el perfil usuario",
      );
    }
  };

  /* =========================================
     ELIMINACIÓN LÓGICA
     No elimina el documento de MongoDB.
  ========================================= */

  static deletePerfilUsuario = async (
    req: Request,
    res: Response,
  ) => {
    try {
      validarIdParametro(req.params.id);

      const perfil = await PerfilUsuario.findOneAndUpdate(
        {
          _id: req.params.id,
          estado: { $ne: "ELIMINADO" },
        },
        {
          $set: {
            estado: "ELIMINADO",
            fechaEliminado: new Date(),
            usuarioEliminador: req.usuario?._id ?? null,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      ).select("_id estado fechaEliminado usuarioEliminador");

      if (!perfil) {
        return res.status(404).json({
          error: "Perfil usuario no encontrado o ya fue eliminado",
        });
      }

      return res.status(200).json({
        message: "Perfil usuario eliminado lógicamente",
        perfil,
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al eliminar el perfil usuario",
      );
    }
  };

  /* =========================================
     OBTENER USUARIO AUTENTICADO
  ========================================= */

  static usuario = async (req: Request, res: Response) => {
    try {
      if (!req.usuario?._id) {
        return res.status(401).json({
          error: "Usuario no autenticado",
        });
      }

      const perfil = await PerfilUsuario.findOne({
        _id: req.usuario._id,
        estado: { $ne: "ELIMINADO" },
      })
        .select("-password")
        .populate(populatePerfil);

      if (!perfil) {
        return res.status(404).json({
          error: "Usuario no encontrado",
        });
      }

      const documentos = await DocumentoUsuario.find({
        perfilUsuario: perfil._id,
        estado: { $ne: "ELIMINADO" },
        fechaEliminado: null,
      })
        .select("_id tipoDocumento ruta estado observacion fechaCreado fechaEdit")
        .sort({ tipoDocumento: 1 });

      return res.status(200).json({
        ...perfil.toObject(),
        documentos,
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error al obtener el usuario autenticado",
      );
    }
  };
  /* =========================================
   OBTENER PERFIL COMPLETO POR ID
   Incluye roles, gestiones y documentos
========================================= */


}
