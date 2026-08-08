import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import Gestion, {
  type EstadoGestion,
} from "../models/Gestion";

type GestionParams = {
  gestionId: string;
};

type GestionBody = {
  anio?: number | string;
  nombre?: string;
  descripcion?: string | null;

  fechaInicio?: string | Date;
  fechaFin?: string | Date;

  fechaInicioInscripcion?:
    | string
    | Date
    | null;

  fechaFinInscripcion?:
    | string
    | Date
    | null;

  cupoMaximoHombres?:
    | number
    | string;

  cupoMaximoMujeres?:
    | number
    | string;

  /*
   * Puede llegar desde el frontend,
   * pero el controlador lo ignora.
   * El total se calcula en el backend.
   */
  cupoMaximo?:
    | number
    | string;

  estado?: EstadoGestion;
};

const ESTADOS_PERMITIDOS: EstadoGestion[] = [
  "PLANIFICACION",
  "INSCRIPCIONES",
  "ACTIVA",
  "CERRADA",
];

/*
|--------------------------------------------------------------------------
| Obtener ID del usuario autenticado
|--------------------------------------------------------------------------
*/

const obtenerUsuarioAutenticado = (
  req: Request,
): mongoose.Types.ObjectId | null => {
  const requestAutenticado =
    req as Request & {
      usuario?: {
        _id?: unknown;
        id?: unknown;
      };

      perfilUsuario?: {
        _id?: unknown;
        id?: unknown;
      };

      user?: {
        _id?: unknown;
        id?: unknown;
      };
    };

  const usuarioId =
    requestAutenticado.usuario?._id ??
    requestAutenticado.usuario?.id ??
    requestAutenticado.perfilUsuario?._id ??
    requestAutenticado.perfilUsuario?.id ??
    requestAutenticado.user?._id ??
    requestAutenticado.user?.id;

  if (
    !usuarioId ||
    !mongoose.isValidObjectId(
      usuarioId,
    )
  ) {
    return null;
  }

  return new mongoose.Types.ObjectId(
    String(usuarioId),
  );
};

/*
|--------------------------------------------------------------------------
| Validaciones auxiliares
|--------------------------------------------------------------------------
*/

const convertirEntero = (
  valor: unknown,
): number | null => {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(valor);

  if (
    !Number.isInteger(numero)
  ) {
    return null;
  }

  return numero;
};

const validarCupos = (
  cupoMaximoHombres: number,
  cupoMaximoMujeres: number,
): string | null => {
  if (
    cupoMaximoHombres < 0
  ) {
    return "El cupo máximo de hombres no puede ser negativo";
  }

  if (
    cupoMaximoMujeres < 0
  ) {
    return "El cupo máximo de mujeres no puede ser negativo";
  }

  if (
    cupoMaximoHombres +
      cupoMaximoMujeres <=
    0
  ) {
    return "La suma de los cupos de hombres y mujeres debe ser mayor a cero";
  }

  return null;
};

const tieneFecha = (
  valor:
    | string
    | Date
    | null
    | undefined,
): boolean =>
  valor !== undefined &&
  valor !== null &&
  valor !== "";

const validarFechas = ({
  fechaInicio,
  fechaFin,
  fechaInicioInscripcion,
  fechaFinInscripcion,
}: {
  fechaInicio?:
    | string
    | Date;

  fechaFin?:
    | string
    | Date;

  fechaInicioInscripcion?:
    | string
    | Date
    | null;

  fechaFinInscripcion?:
    | string
    | Date
    | null;
}): string | null => {
  if (
    !fechaInicio ||
    !fechaFin
  ) {
    return "La fecha de inicio y la fecha de finalización son obligatorias";
  }

  const inicio =
    new Date(fechaInicio);

  const fin =
    new Date(fechaFin);

  if (
    Number.isNaN(
      inicio.getTime(),
    ) ||
    Number.isNaN(
      fin.getTime(),
    )
  ) {
    return "Las fechas de inicio y finalización no son válidas";
  }

  if (
    inicio >= fin
  ) {
    return "La fecha de inicio debe ser anterior a la fecha de finalización";
  }

  const tieneInicioInscripcion =
    tieneFecha(
      fechaInicioInscripcion,
    );

  const tieneFinInscripcion =
    tieneFecha(
      fechaFinInscripcion,
    );

  if (
    tieneInicioInscripcion !==
    tieneFinInscripcion
  ) {
    return "Debe registrar tanto la fecha de inicio como la fecha de finalización de inscripciones";
  }

  if (
    tieneInicioInscripcion &&
    tieneFinInscripcion
  ) {
    const inicioInscripcion =
      new Date(
        fechaInicioInscripcion as
          | string
          | Date,
      );

    const finInscripcion =
      new Date(
        fechaFinInscripcion as
          | string
          | Date,
      );

    if (
      Number.isNaN(
        inicioInscripcion.getTime(),
      ) ||
      Number.isNaN(
        finInscripcion.getTime(),
      )
    ) {
      return "Las fechas de inscripción no son válidas";
    }

    if (
      inicioInscripcion >=
      finInscripcion
    ) {
      return "La fecha de inicio de inscripción debe ser anterior a la fecha de finalización";
    }
  }

  return null;
};

const responderError = (
  error: unknown,
  res: Response,
  mensajeInterno: string,
): void => {
  if (
    error instanceof
      mongoose.Error.ValidationError
  ) {
    res.status(400).json({
      message:
        "Error de validación",

      errors:
        Object.values(
          error.errors,
        ).map(
          (
            validationError,
          ) =>
            validationError.message,
        ),
    });

    return;
  }

  const mongoError =
    error as {
      code?: number;

      keyValue?: Record<
        string,
        unknown
      >;
    };

  if (
    mongoError.code ===
    11000
  ) {
    res.status(409).json({
      message:
        "Ya existe una gestión registrada con ese año",

      campo:
        mongoError.keyValue,
    });

    return;
  }

  console.error(
    mensajeInterno,
    error,
  );

  res.status(500).json({
    message:
      "Ocurrió un error interno al procesar la gestión",
  });
};

/*
|--------------------------------------------------------------------------
| Crear gestión
|--------------------------------------------------------------------------
| POST /api/gestiones
*/

export const crearGestion =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        anio,
        nombre,
        descripcion,
        fechaInicio,
        fechaFin,
        fechaInicioInscripcion,
        fechaFinInscripcion,
        cupoMaximoHombres,
        cupoMaximoMujeres,
        estado,
      } = req.body as GestionBody;

      if (
        anio === undefined ||
        typeof nombre !==
          "string" ||
        !nombre.trim() ||
        !fechaInicio ||
        !fechaFin ||
        cupoMaximoHombres ===
          undefined ||
        cupoMaximoMujeres ===
          undefined
      ) {
        res.status(400).json({
          message:
            "El año, nombre, fechas y los cupos máximos de hombres y mujeres son obligatorios",
        });

        return;
      }

      const anioNumero =
        convertirEntero(anio);

      if (
        anioNumero === null ||
        anioNumero < 2020 ||
        anioNumero > 2100
      ) {
        res.status(400).json({
          message:
            "El año de la gestión no es válido",
        });

        return;
      }

      const cupoHombres =
        convertirEntero(
          cupoMaximoHombres,
        );

      const cupoMujeres =
        convertirEntero(
          cupoMaximoMujeres,
        );

      if (
        cupoHombres === null ||
        cupoMujeres === null
      ) {
        res.status(400).json({
          message:
            "Los cupos máximos deben ser números enteros",
        });

        return;
      }

      const errorCupos =
        validarCupos(
          cupoHombres,
          cupoMujeres,
        );

      if (errorCupos) {
        res.status(400).json({
          message:
            errorCupos,
        });

        return;
      }

      const cupoMaximo =
        cupoHombres +
        cupoMujeres;

      const errorFechas =
        validarFechas({
          fechaInicio,
          fechaFin,
          fechaInicioInscripcion,
          fechaFinInscripcion,
        });

      if (errorFechas) {
        res.status(400).json({
          message:
            errorFechas,
        });

        return;
      }

      const estadoGestion =
        estado ??
        "PLANIFICACION";

      if (
        !ESTADOS_PERMITIDOS.includes(
          estadoGestion,
        )
      ) {
        res.status(400).json({
          message:
            "El estado enviado no es válido",

          estadosPermitidos:
            ESTADOS_PERMITIDOS,
        });

        return;
      }

      const gestionExistente =
        await Gestion.findOne({
          anio:
            anioNumero,

          fechaEliminado:
            null,
        }).select(
          "_id anio nombre",
        );

      if (
        gestionExistente
      ) {
        res.status(409).json({
          message: `Ya existe una gestión registrada para el año ${anioNumero}`,
        });

        return;
      }

      /*
       * Solo puede existir una gestión activa.
       */
      if (
        estadoGestion ===
        "ACTIVA"
      ) {
        const gestionActiva =
          await Gestion.findOne({
            estado:
              "ACTIVA",

            fechaEliminado:
              null,
          }).select(
            "_id nombre anio",
          );

        if (
          gestionActiva
        ) {
          res.status(409).json({
            message: `Ya existe una gestión activa: ${gestionActiva.nombre}`,
          });

          return;
        }
      }

      const gestion =
        await Gestion.create({
          anio:
            anioNumero,

          nombre:
            nombre.trim(),

          descripcion:
            typeof descripcion ===
              "string" &&
            descripcion.trim()
              ? descripcion.trim()
              : null,

          fechaInicio:
            new Date(
              fechaInicio,
            ),

          fechaFin:
            new Date(
              fechaFin,
            ),

          fechaInicioInscripcion:
            tieneFecha(
              fechaInicioInscripcion,
            )
              ? new Date(
                  fechaInicioInscripcion as
                    | string
                    | Date,
                )
              : null,

          fechaFinInscripcion:
            tieneFecha(
              fechaFinInscripcion,
            )
              ? new Date(
                  fechaFinInscripcion as
                    | string
                    | Date,
                )
              : null,

          cupoMaximoHombres:
            cupoHombres,

          cupoMaximoMujeres:
            cupoMujeres,

          /*
           * Nunca se toma este valor del frontend.
           */
          cupoMaximo,

          estado:
            estadoGestion,

          fechaCreado:
            new Date(),

          usuarioCreador:
            obtenerUsuarioAutenticado(
              req,
            ),
        });

      await gestion.populate(
        "usuarioCreador",
        "nombres apellidoPaterno apellidoMaterno email",
      );

      res.status(201).json({
        message:
          "Gestión creada correctamente",

        gestion,
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al crear gestión:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Obtener todas las gestiones
|--------------------------------------------------------------------------
| GET /api/gestiones
*/

export const obtenerGestiones =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        estado,
        anio,
        buscar,
        pagina = "1",
        limite = "10",
      } = req.query;

      const numeroPagina =
        Math.max(
          Number(
            Array.isArray(
              pagina,
            )
              ? pagina[0]
              : pagina,
          ) || 1,
          1,
        );

      const numeroLimite =
        Math.min(
          Math.max(
            Number(
              Array.isArray(
                limite,
              )
                ? limite[0]
                : limite,
            ) || 10,
            1,
          ),
          100,
        );

      const filtro: Record<
        string,
        unknown
      > = {
        fechaEliminado:
          null,
      };

      const estadoFiltro =
        Array.isArray(estado)
          ? estado[0]
          : estado;

      if (
        typeof estadoFiltro ===
          "string" &&
        estadoFiltro
      ) {
        if (
          !ESTADOS_PERMITIDOS.includes(
            estadoFiltro as EstadoGestion,
          )
        ) {
          res.status(400).json({
            message:
              "El estado utilizado como filtro no es válido",

            estadosPermitidos:
              ESTADOS_PERMITIDOS,
          });

          return;
        }

        filtro.estado =
          estadoFiltro;
      }

      const anioFiltro =
        Array.isArray(anio)
          ? anio[0]
          : anio;

      if (
        typeof anioFiltro ===
          "string" &&
        anioFiltro
      ) {
        const anioNumero =
          convertirEntero(
            anioFiltro,
          );

        if (
          anioNumero === null
        ) {
          res.status(400).json({
            message:
              "El año utilizado como filtro no es válido",
          });

          return;
        }

        filtro.anio =
          anioNumero;
      }

      const buscarFiltro =
        Array.isArray(buscar)
          ? buscar[0]
          : buscar;

      if (
        typeof buscarFiltro ===
          "string" &&
        buscarFiltro.trim()
      ) {
        const textoBusqueda =
          buscarFiltro.trim();

        filtro.$or = [
          {
            nombre: {
              $regex:
                textoBusqueda,

              $options:
                "i",
            },
          },
          {
            descripcion: {
              $regex:
                textoBusqueda,

              $options:
                "i",
            },
          },
        ];
      }

      const [
        gestiones,
        total,
      ] =
        await Promise.all([
          Gestion.find(
            filtro,
          )
            .populate(
              "usuarioCreador",
              "nombres apellidoPaterno apellidoMaterno email",
            )
            .populate(
              "usuarioEdit",
              "nombres apellidoPaterno apellidoMaterno email",
            )
            .sort({
              anio: -1,
            })
            .skip(
              (numeroPagina -
                1) *
                numeroLimite,
            )
            .limit(
              numeroLimite,
            ),

          Gestion.countDocuments(
            filtro,
          ),
        ]);

      res.status(200).json({
        gestiones,

        paginacion: {
          pagina:
            numeroPagina,

          limite:
            numeroLimite,

          total,

          totalPaginas:
            Math.ceil(
              total /
                numeroLimite,
            ),
        },
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al obtener gestiones:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Obtener gestión por ID
|--------------------------------------------------------------------------
| GET /api/gestiones/:gestionId
*/

export const obtenerGestionPorId =
  async (
    req: Request<GestionParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        gestionId,
      } = req.params;

      if (
        !mongoose.isValidObjectId(
          gestionId,
        )
      ) {
        res.status(400).json({
          message:
            "El identificador de la gestión no es válido",
        });

        return;
      }

      const gestion =
        await Gestion.findOne({
          _id:
            gestionId,

          fechaEliminado:
            null,
        })
          .populate(
            "usuarioCreador",
            "nombres apellidoPaterno apellidoMaterno email",
          )
          .populate(
            "usuarioEdit",
            "nombres apellidoPaterno apellidoMaterno email",
          )
          .populate(
            "usuarioEliminador",
            "nombres apellidoPaterno apellidoMaterno email",
          );

      if (!gestion) {
        res.status(404).json({
          message:
            "Gestión no encontrada",
        });

        return;
      }

      res.status(200).json({
        gestion,
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al obtener gestión:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Obtener gestión activa
|--------------------------------------------------------------------------
| GET /api/gestiones/activa
*/

export const obtenerGestionActiva =
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const gestion =
        await Gestion.findOne({
          estado:
            "ACTIVA",

          fechaEliminado:
            null,
        })
          .populate(
            "usuarioCreador",
            "nombres apellidoPaterno apellidoMaterno email",
          )
          .populate(
            "usuarioEdit",
            "nombres apellidoPaterno apellidoMaterno email",
          )
          .sort({
            anio: -1,
          });

      if (!gestion) {
        res.status(404).json({
          message:
            "No existe una gestión activa",
        });

        return;
      }

      res.status(200).json({
        gestion,
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al obtener gestión activa:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Actualizar gestión
|--------------------------------------------------------------------------
| PUT /api/gestiones/:gestionId
*/

export const actualizarGestion =
  async (
    req: Request<GestionParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        gestionId,
      } = req.params;

      if (
        !mongoose.isValidObjectId(
          gestionId,
        )
      ) {
        res.status(400).json({
          message:
            "El identificador de la gestión no es válido",
        });

        return;
      }

      const gestion =
        await Gestion.findOne({
          _id:
            gestionId,

          fechaEliminado:
            null,
        });

      if (!gestion) {
        res.status(404).json({
          message:
            "Gestión no encontrada",
        });

        return;
      }

      const {
        anio,
        nombre,
        descripcion,
        fechaInicio,
        fechaFin,
        fechaInicioInscripcion,
        fechaFinInscripcion,
        cupoMaximoHombres,
        cupoMaximoMujeres,
        estado,
      } = req.body as GestionBody;

      const fechaInicioFinal =
        fechaInicio !==
        undefined
          ? fechaInicio
          : gestion.fechaInicio;

      const fechaFinFinal =
        fechaFin !==
        undefined
          ? fechaFin
          : gestion.fechaFin;

      const fechaInicioInscripcionFinal =
        fechaInicioInscripcion !==
        undefined
          ? fechaInicioInscripcion
          : gestion
              .fechaInicioInscripcion;

      const fechaFinInscripcionFinal =
        fechaFinInscripcion !==
        undefined
          ? fechaFinInscripcion
          : gestion
              .fechaFinInscripcion;

      const errorFechas =
        validarFechas({
          fechaInicio:
            fechaInicioFinal,

          fechaFin:
            fechaFinFinal,

          fechaInicioInscripcion:
            fechaInicioInscripcionFinal,

          fechaFinInscripcion:
            fechaFinInscripcionFinal,
        });

      if (errorFechas) {
        res.status(400).json({
          message:
            errorFechas,
        });

        return;
      }

      if (
        anio !== undefined
      ) {
        const anioNumero =
          convertirEntero(
            anio,
          );

        if (
          anioNumero === null ||
          anioNumero < 2020 ||
          anioNumero > 2100
        ) {
          res.status(400).json({
            message:
              "El año de la gestión no es válido",
          });

          return;
        }

        const anioExistente =
          await Gestion.findOne({
            _id: {
              $ne:
                gestionId,
            },

            anio:
              anioNumero,

            fechaEliminado:
              null,
          }).select(
            "_id anio nombre",
          );

        if (
          anioExistente
        ) {
          res.status(409).json({
            message: `Ya existe otra gestión para el año ${anioNumero}`,
          });

          return;
        }

        gestion.anio =
          anioNumero;
      }

      if (
        estado !== undefined
      ) {
        if (
          !ESTADOS_PERMITIDOS.includes(
            estado,
          )
        ) {
          res.status(400).json({
            message:
              "El estado enviado no es válido",

            estadosPermitidos:
              ESTADOS_PERMITIDOS,
          });

          return;
        }

        if (
          estado ===
            "ACTIVA" &&
          gestion.estado !==
            "ACTIVA"
        ) {
          const gestionActiva =
            await Gestion.findOne({
              _id: {
                $ne:
                  gestionId,
              },

              estado:
                "ACTIVA",

              fechaEliminado:
                null,
            }).select(
              "_id nombre anio",
            );

          if (
            gestionActiva
          ) {
            res.status(409).json({
              message: `Ya existe una gestión activa: ${gestionActiva.nombre}`,
            });

            return;
          }
        }
      }

      const cupoHombresFinal =
        cupoMaximoHombres !==
        undefined
          ? convertirEntero(
              cupoMaximoHombres,
            )
          : gestion
              .cupoMaximoHombres;

      const cupoMujeresFinal =
        cupoMaximoMujeres !==
        undefined
          ? convertirEntero(
              cupoMaximoMujeres,
            )
          : gestion
              .cupoMaximoMujeres;

      if (
        cupoHombresFinal ===
          null ||
        cupoMujeresFinal ===
          null
      ) {
        res.status(400).json({
          message:
            "Los cupos máximos deben ser números enteros",
        });

        return;
      }

      const errorCupos =
        validarCupos(
          cupoHombresFinal,
          cupoMujeresFinal,
        );

      if (errorCupos) {
        res.status(400).json({
          message:
            errorCupos,
        });

        return;
      }

      if (
        nombre !== undefined
      ) {
        if (
          typeof nombre !==
            "string" ||
          !nombre.trim()
        ) {
          res.status(400).json({
            message:
              "El nombre de la gestión no puede estar vacío",
          });

          return;
        }

        gestion.nombre =
          nombre.trim();
      }

      if (
        descripcion !==
        undefined
      ) {
        gestion.descripcion =
          typeof descripcion ===
            "string" &&
          descripcion.trim()
            ? descripcion.trim()
            : null;
      }

      if (
        fechaInicio !==
        undefined
      ) {
        gestion.fechaInicio =
          new Date(
            fechaInicio,
          );
      }

      if (
        fechaFin !==
        undefined
      ) {
        gestion.fechaFin =
          new Date(
            fechaFin,
          );
      }

      if (
        fechaInicioInscripcion !==
        undefined
      ) {
        gestion.fechaInicioInscripcion =
          tieneFecha(
            fechaInicioInscripcion,
          )
            ? new Date(
                fechaInicioInscripcion as
                  | string
                  | Date,
              )
            : null;
      }

      if (
        fechaFinInscripcion !==
        undefined
      ) {
        gestion.fechaFinInscripcion =
          tieneFecha(
            fechaFinInscripcion,
          )
            ? new Date(
                fechaFinInscripcion as
                  | string
                  | Date,
              )
            : null;
      }

      /*
       * Se actualizan los dos cupos y el total
       * se calcula exclusivamente en el backend.
       */
      gestion.cupoMaximoHombres =
        cupoHombresFinal;

      gestion.cupoMaximoMujeres =
        cupoMujeresFinal;

      gestion.cupoMaximo =
        cupoHombresFinal +
        cupoMujeresFinal;

      if (
        estado !== undefined
      ) {
        gestion.estado =
          estado;
      }

      gestion.fechaEdit =
        new Date();

      gestion.usuarioEdit =
        obtenerUsuarioAutenticado(
          req,
        );

      await gestion.save();

      await gestion.populate(
        "usuarioEdit",
        "nombres apellidoPaterno apellidoMaterno email",
      );

      res.status(200).json({
        message:
          "Gestión actualizada correctamente",

        gestion,
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al actualizar gestión:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Cambiar estado
|--------------------------------------------------------------------------
| PATCH /api/gestiones/:gestionId/estado
*/

export const cambiarEstadoGestion =
  async (
    req: Request<GestionParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        gestionId,
      } = req.params;

      const {
        estado,
      } = req.body as {
        estado?: EstadoGestion;
      };

      if (
        !mongoose.isValidObjectId(
          gestionId,
        )
      ) {
        res.status(400).json({
          message:
            "El identificador de la gestión no es válido",
        });

        return;
      }

      if (
        !estado ||
        !ESTADOS_PERMITIDOS.includes(
          estado,
        )
      ) {
        res.status(400).json({
          message:
            "El estado enviado no es válido",

          estadosPermitidos:
            ESTADOS_PERMITIDOS,
        });

        return;
      }

      const gestion =
        await Gestion.findOne({
          _id:
            gestionId,

          fechaEliminado:
            null,
        });

      if (!gestion) {
        res.status(404).json({
          message:
            "Gestión no encontrada",
        });

        return;
      }

      if (
        estado ===
        "ACTIVA"
      ) {
        const otraGestionActiva =
          await Gestion.findOne({
            _id: {
              $ne:
                gestionId,
            },

            estado:
              "ACTIVA",

            fechaEliminado:
              null,
          }).select(
            "_id nombre anio",
          );

        if (
          otraGestionActiva
        ) {
          res.status(409).json({
            message: `No se puede activar la gestión porque ${otraGestionActiva.nombre} ya se encuentra activa`,
          });

          return;
        }
      }

      gestion.estado =
        estado;

      gestion.fechaEdit =
        new Date();

      gestion.usuarioEdit =
        obtenerUsuarioAutenticado(
          req,
        );

      await gestion.save();

      await gestion.populate(
        "usuarioEdit",
        "nombres apellidoPaterno apellidoMaterno email",
      );

      res.status(200).json({
        message: `La gestión cambió al estado ${estado}`,

        gestion,
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al cambiar estado de gestión:",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Eliminación lógica
|--------------------------------------------------------------------------
| DELETE /api/gestiones/:gestionId
*/

export const eliminarGestion =
  async (
    req: Request<GestionParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        gestionId,
      } = req.params;

      if (
        !mongoose.isValidObjectId(
          gestionId,
        )
      ) {
        res.status(400).json({
          message:
            "El identificador de la gestión no es válido",
        });

        return;
      }

      const gestion =
        await Gestion.findOne({
          _id:
            gestionId,

          fechaEliminado:
            null,
        });

      if (!gestion) {
        res.status(404).json({
          message:
            "Gestión no encontrada",
        });

        return;
      }

      if (
        gestion.estado ===
        "ACTIVA"
      ) {
        res.status(409).json({
          message:
            "No se puede eliminar una gestión activa. Primero debe cerrarla",
        });

        return;
      }

      gestion.fechaEliminado =
        new Date();

      gestion.usuarioEliminador =
        obtenerUsuarioAutenticado(
          req,
        );

      await gestion.save();

      res.status(200).json({
        message:
          "Gestión eliminada lógicamente correctamente",
      });
    } catch (
      error: unknown
    ) {
      responderError(
        error,
        res,
        "Error al eliminar gestión:",
      );
    }
  };