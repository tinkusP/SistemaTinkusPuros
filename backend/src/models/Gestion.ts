import mongoose, {
  Schema,
  Document,
  Query,
} from "mongoose";

export type EstadoGestion =
  | "PLANIFICACION"
  | "INSCRIPCIONES"
  | "ACTIVA"
  | "CERRADA";

export interface GestionType
  extends Document {
  anio: number;
  nombre: string;
  descripcion?: string | null;

  fechaInicio: Date;
  fechaFin: Date;

  fechaInicioInscripcion?: Date | null;
  fechaFinInscripcion?: Date | null;

  cupoMaximoHombres: number;
  cupoMaximoMujeres: number;

  /*
   * Este campo se calcula automáticamente:
   *
   * cupoMaximoHombres + cupoMaximoMujeres
   */
  cupoMaximo: number;

  estado: EstadoGestion;

  fechaCreado?: Date;
  usuarioCreador?:
  | mongoose.Types.ObjectId
  | null;

  fechaEdit?: Date | null;
  usuarioEdit?:
  | mongoose.Types.ObjectId
  | null;

  fechaEliminado?: Date | null;
  usuarioEliminador?:
  | mongoose.Types.ObjectId
  | null;
}

/*
|--------------------------------------------------------------------------
| Esquema
|--------------------------------------------------------------------------
*/

const GestionSchema: Schema<GestionType> =
  new Schema<GestionType>(
    {
      anio: {
        type: Number,
        required: [
          true,
          "El año de la gestión es obligatorio",
        ],
        min: [
          2020,
          "El año mínimo permitido es 2020",
        ],
        max: [
          2100,
          "El año máximo permitido es 2100",
        ],
        validate: {
          validator: Number.isInteger,
          message:
            "El año debe ser un número entero",
        },
      },

      nombre: {
        type: String,
        required: [
          true,
          "El nombre de la gestión es obligatorio",
        ],
        trim: true,
        minlength: [
          3,
          "El nombre debe tener al menos 3 caracteres",
        ],
        maxlength: [
          100,
          "El nombre no puede superar los 100 caracteres",
        ],
      },

      descripcion: {
        type: String,
        trim: true,
        maxlength: [
          500,
          "La descripción no puede superar los 500 caracteres",
        ],
        default: null,
      },

      fechaInicio: {
        type: Date,
        required: [
          true,
          "La fecha de inicio es obligatoria",
        ],
      },

      fechaFin: {
        type: Date,
        required: [
          true,
          "La fecha de finalización es obligatoria",
        ],
      },

      fechaInicioInscripcion: {
        type: Date,
        default: null,
      },

      fechaFinInscripcion: {
        type: Date,
        default: null,
      },

      /*
      |--------------------------------------------------------------------------
      | Cupos por sexo
      |--------------------------------------------------------------------------
      */

      cupoMaximoHombres: {
        type: Number,
        required: [
          true,
          "El cupo máximo de hombres es obligatorio",
        ],
        min: [
          0,
          "El cupo máximo de hombres no puede ser negativo",
        ],
        default: 150,
        validate: {
          validator: Number.isInteger,
          message:
            "El cupo máximo de hombres debe ser un número entero",
        },
      },

      cupoMaximoMujeres: {
        type: Number,
        required: [
          true,
          "El cupo máximo de mujeres es obligatorio",
        ],
        min: [
          0,
          "El cupo máximo de mujeres no puede ser negativo",
        ],
        default: 150,
        validate: {
          validator: Number.isInteger,
          message:
            "El cupo máximo de mujeres debe ser un número entero",
        },
      },

      /*
       * No se debe introducir manualmente.
       * Se calcula antes de validar y guardar.
       */
      cupoMaximo: {
        type: Number,
        required: true,
        min: [
          1,
          "El cupo máximo total debe ser mayor a cero",
        ],
        default: 300,
      },

      estado: {
        type: String,
        enum: {
          values: [
            "PLANIFICACION",
            "INSCRIPCIONES",
            "ACTIVA",
            "CERRADA",
          ],
          message:
            "El estado de la gestión no es válido",
        },
        default: "PLANIFICACION",
      },

      /*
      |--------------------------------------------------------------------------
      | Auditoría
      |--------------------------------------------------------------------------
      */

      fechaCreado: {
        type: Date,
        default: Date.now,
        immutable: true,
      },

      usuarioCreador: {
        type: Schema.Types.ObjectId,
        ref: "PerfilUsuario",
        default: null,
      },

      fechaEdit: {
        type: Date,
        default: null,
      },

      usuarioEdit: {
        type: Schema.Types.ObjectId,
        ref: "PerfilUsuario",
        default: null,
      },

      fechaEliminado: {
        type: Date,
        default: null,
      },

      usuarioEliminador: {
        type: Schema.Types.ObjectId,
        ref: "PerfilUsuario",
        default: null,
      },
    },
    {
      versionKey: false,
      collection: "gestiones",

      /*
       * Incluye propiedades virtuales cuando
       * se convierte a JSON u objeto.
       */
      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    },
  );

/*
|--------------------------------------------------------------------------
| Validaciones antes de crear o guardar
|--------------------------------------------------------------------------
*/

GestionSchema.pre(
  "validate",
  function () {
    /*
     * El cupo total se calcula siempre.
     * Aunque el frontend envíe otro valor,
     * este será reemplazado.
     */
    this.cupoMaximo =
      this.cupoMaximoHombres +
      this.cupoMaximoMujeres;

    if (this.cupoMaximo <= 0) {
      this.invalidate(
        "cupoMaximo",
        "La suma de los cupos de hombres y mujeres debe ser mayor a cero",
      );
    }

    /*
     * La fecha de finalización debe ser
     * posterior a la fecha de inicio.
     */
    if (
      this.fechaInicio &&
      this.fechaFin &&
      this.fechaFin <= this.fechaInicio
    ) {
      this.invalidate(
        "fechaFin",
        "La fecha de finalización debe ser posterior a la fecha de inicio",
      );
    }

    const tieneInicioInscripcion =
      this.fechaInicioInscripcion != null;

    const tieneFinInscripcion =
      this.fechaFinInscripcion != null;

    /*
     * Si se registra una fecha de inscripción,
     * se deben registrar ambas.
     */
    if (
      tieneInicioInscripcion !==
      tieneFinInscripcion
    ) {
      this.invalidate(
        "fechaInicioInscripcion",
        "Debe registrar la fecha de inicio y la fecha de finalización de inscripciones",
      );
    }

    if (
      this.fechaInicioInscripcion &&
      this.fechaFinInscripcion &&
      this.fechaFinInscripcion <=
      this.fechaInicioInscripcion
    ) {
      this.invalidate(
        "fechaFinInscripcion",
        "La fecha de finalización de inscripciones debe ser posterior a la fecha de inicio",
      );
    }
  },
);

/*
|--------------------------------------------------------------------------
| Recalcular cupo total al actualizar
|--------------------------------------------------------------------------
|
| Los middlewares de documento no se ejecutan automáticamente cuando
| utilizamos findOneAndUpdate() o updateOne(). Por eso calculamos nuevamente
| el total en estas operaciones.
|
*/

type GestionActualizacion = {
  cupoMaximoHombres?: number | string;
  cupoMaximoMujeres?: number | string;
  cupoMaximo?: number | string;

  $set?: {
    cupoMaximoHombres?:
    | number
    | string;

    cupoMaximoMujeres?:
    | number
    | string;

    cupoMaximo?:
    | number
    | string;

    [key: string]: unknown;
  };

  $unset?: {
    cupoMaximoHombres?: unknown;
    cupoMaximoMujeres?: unknown;
    [key: string]: unknown;
  };

  $inc?: {
    cupoMaximoHombres?: number;
    cupoMaximoMujeres?: number;
    [key: string]: unknown;
  };

  [key: string]: unknown;
};

const recalcularCupoActualizacion =
  async function (
    this: Query<
      unknown,
      GestionType
    >,
  ): Promise<void> {
    const actualizacion =
      this.getUpdate() as
      | GestionActualizacion
      | GestionActualizacion[]
      | null;

    if (!actualizacion) {
      return;
    }

    /*
     * No permitimos actualizaciones mediante
     * pipeline porque dificultan garantizar
     * la consistencia del cupo.
     */
    if (Array.isArray(actualizacion)) {
      throw new Error(
        "No se permiten actualizaciones por pipeline para la gestión",
      );
    }

    /*
     * No se permite eliminar los campos
     * que forman el cupo.
     */
    if (
      actualizacion.$unset
        ?.cupoMaximoHombres ||
      actualizacion.$unset
        ?.cupoMaximoMujeres
    ) {
      throw new Error(
        "No se pueden eliminar los cupos máximos de hombres o mujeres",
      );
    }

    /*
     * Los cupos deben establecerse directamente.
     * No permitimos $inc porque el total debe
     * calcularse de forma controlada.
     */
    if (
      actualizacion.$inc
        ?.cupoMaximoHombres !==
      undefined ||
      actualizacion.$inc
        ?.cupoMaximoMujeres !==
      undefined
    ) {
      throw new Error(
        "Los cupos máximos no pueden modificarse utilizando $inc",
      );
    }

    const cambios =
      actualizacion.$set ??
      actualizacion;

    /*
     * cupoMaximo nunca puede modificarse directamente.
     */
    delete cambios.cupoMaximo;

    const cambiaCupoHombres =
      Object.prototype.hasOwnProperty.call(
        cambios,
        "cupoMaximoHombres",
      );

    const cambiaCupoMujeres =
      Object.prototype.hasOwnProperty.call(
        cambios,
        "cupoMaximoMujeres",
      );

    /*
     * Si no se modificó ningún cupo,
     * no es necesario recalcular.
     */
    if (
      !cambiaCupoHombres &&
      !cambiaCupoMujeres
    ) {
      return;
    }
    const modeloGestion =
      this.model as mongoose.Model<GestionType>;

    const gestionActual =
      await modeloGestion
        .findOne(this.getFilter())
        .select(
          "cupoMaximoHombres cupoMaximoMujeres",
        )
        .exec();

    if (!gestionActual) {
      return;
    }

    const cupoHombres =
      cambiaCupoHombres
        ? Number(
          cambios.cupoMaximoHombres,
        )
        : Number(
          gestionActual
            .cupoMaximoHombres,
        );

    const cupoMujeres =
      cambiaCupoMujeres
        ? Number(
          cambios.cupoMaximoMujeres,
        )
        : Number(
          gestionActual
            .cupoMaximoMujeres,
        );

    if (
      !Number.isInteger(cupoHombres) ||
      cupoHombres < 0
    ) {
      throw new Error(
        "El cupo máximo de hombres debe ser un número entero mayor o igual a cero",
      );
    }

    if (
      !Number.isInteger(cupoMujeres) ||
      cupoMujeres < 0
    ) {
      throw new Error(
        "El cupo máximo de mujeres debe ser un número entero mayor o igual a cero",
      );
    }

    const cupoTotal =
      cupoHombres + cupoMujeres;

    if (cupoTotal <= 0) {
      throw new Error(
        "La suma de los cupos debe ser mayor a cero",
      );
    }

    /*
     * Se fuerza el resultado calculado.
     */
    cambios.cupoMaximo =
      cupoTotal;

    if (actualizacion.$set) {
      actualizacion.$set =
        cambios;
    }

    this.setUpdate(
      actualizacion,
    );
  };

GestionSchema.pre(
  "findOneAndUpdate",
  recalcularCupoActualizacion,
);

GestionSchema.pre(
  "updateOne",
  recalcularCupoActualizacion,
);

/*
|--------------------------------------------------------------------------
| Índices
|--------------------------------------------------------------------------
*/

/*
 * Solo puede existir una gestión no eliminada
 * para cada año.
 *
 * Al eliminar lógicamente una gestión, podrá
 * crearse nuevamente otra del mismo año.
 */
GestionSchema.index(
  {
    anio: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      fechaEliminado: null,
    },
  },
);

GestionSchema.index({
  estado: 1,
  fechaEliminado: 1,
});

GestionSchema.index({
  fechaInicio: 1,
  fechaFin: 1,
});

/*
|--------------------------------------------------------------------------
| Modelo
|--------------------------------------------------------------------------
*/

const Gestion =
  (
    mongoose.models
      .Gestion as mongoose.Model<GestionType>
  ) ||
  mongoose.model<GestionType>(
    "Gestion",
    GestionSchema,
  );

export default Gestion;