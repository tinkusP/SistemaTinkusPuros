// src/services/ReporteService.ts

import mongoose, {
  PipelineStage,
  Types,
} from "mongoose";

export type ReporteFiltros = {
  fechaDesde?: string;
  fechaHasta?: string;

  idSucursal?: string;
  idCaja?: string;
  idPerfil?: string;
  idAlmacen?: string;
  idProducto?: string;

  estado?: string;
  metodoPago?: string;

  limite?: string | number;
};

type CampoFecha =
  | "fechaVenta"
  | "fechaEgreso"
  | "fecha"
  | "fechaCierre"
  | "fechaSolicitud"
  | "fechaCreacion";

export class ReporteService {

  /* =========================
      CONVERSIÓN OBJECT ID
  ========================= */

  static objectId(
    value?: string
  ): Types.ObjectId | undefined {

    if (
      !value ||
      !mongoose.isValidObjectId(
        value
      )
    ) {
      return undefined;
    }

    return new mongoose.Types.ObjectId(
      value
    );
  }

  /* =========================
      FECHA INICIAL

      Si recibe 2026-06-01:
      2026-06-01 00:00:00
  ========================= */

  static fechaInicial(
    value?: string
  ): Date | undefined {

    if (!value) {
      return undefined;
    }

    const fecha =
      value.length === 10
        ? new Date(
            `${value}T00:00:00-04:00`
          )
        : new Date(value);

    if (
      Number.isNaN(
        fecha.getTime()
      )
    ) {
      return undefined;
    }

    return fecha;
  }

  /* =========================
      FECHA FINAL

      Si recibe 2026-06-30:
      2026-06-30 23:59:59.999
  ========================= */

  static fechaFinal(
    value?: string
  ): Date | undefined {

    if (!value) {
      return undefined;
    }

    const fecha =
      value.length === 10
        ? new Date(
            `${value}T23:59:59.999-04:00`
          )
        : new Date(value);

    if (
      Number.isNaN(
        fecha.getTime()
      )
    ) {
      return undefined;
    }

    return fecha;
  }

  /* =========================
      RANGO DE FECHAS
  ========================= */

  static rangoFecha(
    fechaDesde?: string,
    fechaHasta?: string
  ): {
    $gte?: Date;
    $lte?: Date;
  } | undefined {

    const desde =
      this.fechaInicial(
        fechaDesde
      );

    const hasta =
      this.fechaFinal(
        fechaHasta
      );

    if (!desde && !hasta) {
      return undefined;
    }

    const rango: {
      $gte?: Date;
      $lte?: Date;
    } = {};

    if (desde) {
      rango.$gte = desde;
    }

    if (hasta) {
      rango.$lte = hasta;
    }

    return rango;
  }

  /* =========================
      MATCH COMÚN
  ========================= */

  static construirMatch(
    filtros: ReporteFiltros,
    campoFecha: CampoFecha
  ): Record<string, unknown> {

    const match:
      Record<string, unknown> = {};

    const rango =
      this.rangoFecha(
        filtros.fechaDesde,
        filtros.fechaHasta
      );

    if (rango) {
      match[campoFecha] =
        rango;
    }

    const idSucursal =
      this.objectId(
        filtros.idSucursal
      );

    const idCaja =
      this.objectId(
        filtros.idCaja
      );

    const idPerfil =
      this.objectId(
        filtros.idPerfil
      );

    const idAlmacen =
      this.objectId(
        filtros.idAlmacen
      );

    const idProducto =
      this.objectId(
        filtros.idProducto
      );

    if (idSucursal) {
      match.idSucursal =
        idSucursal;
    }

    if (idCaja) {
      match.idCaja =
        idCaja;
    }

    if (idPerfil) {
      match.idPerfil =
        idPerfil;
    }

    if (idAlmacen) {
      match.idAlmacen =
        idAlmacen;
    }

    if (idProducto) {
      match.idProducto =
        idProducto;
    }

    if (filtros.estado) {
      match.estado =
        filtros.estado;
    }

    if (filtros.metodoPago) {
      match.metodoPago =
        filtros.metodoPago;
    }

    return match;
  }

  /* =========================
      LÍMITE SEGURO
  ========================= */

  static limite(
    value?: string | number,
    predeterminado = 10,
    maximo = 100
  ): number {

    const numero =
      Number(value);

    if (
      !Number.isFinite(numero) ||
      numero <= 0
    ) {
      return predeterminado;
    }

    return Math.min(
      Math.floor(numero),
      maximo
    );
  }

  /* =========================
      LOOKUPS REUTILIZABLES
  ========================= */

  static lookupSucursal(
    localField = "idSucursal",
    as = "sucursal"
  ): PipelineStage[] {

    return [
      {
        $lookup: {
          from:
            "sucursals",
          localField,
          foreignField:
            "_id",
          as,
        },
      },
      {
        $unwind: {
          path:
            `$${as}`,
          preserveNullAndEmptyArrays:
            true,
        },
      },
    ];
  }

  static lookupCaja(
    localField = "idCaja",
    as = "caja"
  ): PipelineStage[] {

    return [
      {
        $lookup: {
          from:
            "cajas",
          localField,
          foreignField:
            "_id",
          as,
        },
      },
      {
        $unwind: {
          path:
            `$${as}`,
          preserveNullAndEmptyArrays:
            true,
        },
      },
    ];
  }

  static lookupPerfil(
    localField = "idPerfil",
    as = "perfil"
  ): PipelineStage[] {

    return [
      {
        $lookup: {
          from:
            "perfilusuarios",
          localField,
          foreignField:
            "_id",
          as,
        },
      },
      {
        $unwind: {
          path:
            `$${as}`,
          preserveNullAndEmptyArrays:
            true,
        },
      },
    ];
  }

  static lookupProducto(
    localField = "idProducto",
    as = "producto"
  ): PipelineStage[] {

    return [
      {
        $lookup: {
          from:
            "productos",
          localField,
          foreignField:
            "_id",
          as,
        },
      },
      {
        $unwind: {
          path:
            `$${as}`,
          preserveNullAndEmptyArrays:
            true,
        },
      },
    ];
  }

  static lookupAlmacen(
    localField = "idAlmacen",
    as = "almacen"
  ): PipelineStage[] {

    return [
      {
        $lookup: {
          from:
            "almacenes",
          localField,
          foreignField:
            "_id",
          as,
        },
      },
      {
        $unwind: {
          path:
            `$${as}`,
          preserveNullAndEmptyArrays:
            true,
        },
      },
    ];
  }

  /* =========================
      REDONDEO
  ========================= */

  static redondear(
    value: number,
    decimales = 2
  ): number {

    const factor =
      Math.pow(
        10,
        decimales
      );

    return (
      Math.round(
        (
          Number(value) +
          Number.EPSILON
        ) *
          factor
      ) / factor
    );
  }
}
