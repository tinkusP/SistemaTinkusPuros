import ExcelJS from "exceljs";
import type { Db } from "mongodb";

type Documento = Record<string, any>;

const id = (valor: unknown) => valor == null ? "" : String(valor);
const texto = (valor: unknown) => valor == null ? "" : String(valor);
const nombreCompleto = (usuario?: Documento) => usuario
  ? [usuario.nombres, usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" ")
  : "SIN USUARIO";
const vigente = (documento?: Documento) => Boolean(documento && !documento.fechaEliminado);

async function documentos(db: Db, nombre: string): Promise<Documento[]> {
  const existe = await db.listCollections({ name: nombre }, { nameOnly: true }).hasNext();
  return existe ? db.collection(nombre).find({}).toArray() as Promise<Documento[]> : [];
}

function mapaPorId(documentosLista: Documento[]) {
  return new Map(documentosLista.map((documento) => [id(documento._id), documento]));
}

function ultimoPor<T extends Documento>(documentosLista: T[], clave: (documento: T) => string, fecha: (documento: T) => unknown) {
  const resultado = new Map<string, T>();
  for (const documento of documentosLista) {
    const llave = clave(documento);
    const anterior = resultado.get(llave);
    if (!anterior || new Date(fecha(documento) as any || 0).getTime() >= new Date(fecha(anterior) as any || 0).getTime()) {
      resultado.set(llave, documento);
    }
  }
  return resultado;
}

function agregarHoja(
  libro: ExcelJS.stream.xlsx.WorkbookWriter,
  nombre: string,
  columnas: Array<{ header: string; key: string; width?: number }>,
  filas: Array<Record<string, unknown>>,
) {
  const hoja = libro.addWorksheet(nombre);
  hoja.columns = columnas;
  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
  cabecera.commit();
  for (const fila of filas) hoja.addRow(fila).commit();
  hoja.commit();
}

/**
 * Genera un Excel administrativo sin contraseñas ni binarios. El escritor es
 * incremental: las filas se confirman una a una directamente al archivo.
 */
export async function generarExcelRespaldo(db: Db, rutaSalida: string): Promise<void> {
  const [
    usuarios, roles, preregistros, fraternos, postulantes, guias, bloques,
    relaciones, cuotas, pagos, tallas, prendas, entregas, asistencias,
  ] = await Promise.all([
    documentos(db, "perfil_usuarios"), documentos(db, "roles"), documentos(db, "preregistros"),
    documentos(db, "fraternos"), documentos(db, "postulantes_guia"), documentos(db, "guias"),
    documentos(db, "bloques"), documentos(db, "detalle_bloques"), documentos(db, "cuotas"),
    documentos(db, "detalle_cuotas"), documentos(db, "tallas_fraterno"),
    documentos(db, "prendas_indumentaria"), documentos(db, "entregas_indumentaria"),
    documentos(db, "asistencias"),
  ]);

  const usuarioPorId = mapaPorId(usuarios);
  const rolPorId = mapaPorId(roles);
  const preregistroPorId = mapaPorId(preregistros);
  const fraternoPorId = mapaPorId(fraternos);
  const guiaPorId = mapaPorId(guias);
  const bloquePorId = mapaPorId(bloques);
  const cuotaPorId = mapaPorId(cuotas);
  const prendaPorId = mapaPorId(prendas);
  const preregistroPorUsuario = ultimoPor(preregistros.filter(vigente), (p) => id(p.usuarioId), (p) => p.fechaRegistro ?? p.fechaCreado);
  const fraternoPorUsuario = ultimoPor(fraternos.filter(vigente), (f) => id(f.usuarioId), (f) => f.fechaIngreso ?? f.fechaCreado);
  const cuotaPorPreregistro = ultimoPor(cuotas.filter(vigente), (c) => id(c.preregistroId), (c) => c.fechaEditado ?? c.fechaCreado);
  const pagosPorCuota = new Map<string, Documento[]>();
  for (const pago of pagos.filter(vigente)) {
    const llave = id(pago.cuotaId);
    pagosPorCuota.set(llave, [...(pagosPorCuota.get(llave) ?? []), pago]);
  }

  const rolesUsuario = (usuario: Documento) => (usuario.roles ?? [])
    .map((rolId: unknown) => rolPorId.get(id(rolId)))
    .filter(Boolean)
    .map((rol: Documento) => rol.codigo ?? rol.nombre)
    .join(" / ") || "SIN ROL";
  const usuarioDesdePreregistro = (preregistroId: unknown) => usuarioPorId.get(id(preregistroPorId.get(id(preregistroId))?.usuarioId));
  const usuarioDesdeFraterno = (fraternoId: unknown) => usuarioPorId.get(id(fraternoPorId.get(id(fraternoId))?.usuarioId));

  const relacionActivaPorFraterno = new Map<string, Documento>();
  for (const relacion of relaciones) {
    const bloque = bloquePorId.get(id(relacion.bloqueId));
    if (relacion.estado === "ACTIVO" && !relacion.fechaEliminado && bloque?.estado === "ACTIVO") {
      relacionActivaPorFraterno.set(id(relacion.fraternoId), relacion);
    }
  }
  const bloqueGuiaPorUsuario = new Map<string, Documento>();
  for (const bloque of bloques.filter((item) => item.estado === "ACTIVO")) {
    const idsGuias = new Set([bloque.guiaId, ...(bloque.guiasIds ?? [])].filter(Boolean).map(id));
    for (const guiaId of idsGuias) {
      const guia = guiaPorId.get(guiaId);
      if (guia?.usuarioId) bloqueGuiaPorUsuario.set(id(guia.usuarioId), bloque);
    }
  }
  const bloqueUsuario = (usuario: Documento) => {
    const comoGuia = bloqueGuiaPorUsuario.get(id(usuario._id));
    if (comoGuia) return comoGuia.nombre;
    const fraterno = fraternoPorUsuario.get(id(usuario._id));
    const relacion = fraterno && relacionActivaPorFraterno.get(id(fraterno._id));
    return relacion ? bloquePorId.get(id(relacion.bloqueId))?.nombre ?? "SIN BLOQUE" : "SIN BLOQUE";
  };

  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: rutaSalida, useStyles: true, useSharedStrings: false });

  agregarHoja(libro, "Usuarios", [
    { header: "Nombre", key: "nombre", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Teléfono", key: "telefono", width: 18 }, { header: "Correo", key: "correo", width: 34 },
    { header: "Rol", key: "rol", width: 30 }, { header: "Estado", key: "estado", width: 16 },
  ], usuarios.map((u) => ({ nombre: nombreCompleto(u), ci: texto(u.ci), telefono: texto(u.telefono), correo: texto(u.email), rol: rolesUsuario(u), estado: u.fechaEliminado ? "ELIMINADO" : texto(u.estado) })));

  agregarHoja(libro, "Fraternos", [
    { header: "Número", key: "numero", width: 18 }, { header: "Nombre", key: "nombre", width: 38 },
    { header: "CI", key: "ci", width: 16 }, { header: "Estado", key: "estado", width: 18 },
    { header: "Bloque actual", key: "bloque", width: 24 }, { header: "Fecha ingreso", key: "fecha", width: 20 },
  ], fraternos.map((f) => { const u = usuarioPorId.get(id(f.usuarioId)); const r = relacionActivaPorFraterno.get(id(f._id)); return { numero: f.numeroFraterno, nombre: nombreCompleto(u), ci: texto(u?.ci), estado: f.fechaEliminado ? "ELIMINADO" : f.estado, bloque: r ? bloquePorId.get(id(r.bloqueId))?.nombre ?? "SIN BLOQUE" : "SIN BLOQUE", fecha: f.fechaIngreso }; }));

  agregarHoja(libro, "Postulantes", [
    { header: "Nombre", key: "nombre", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Estado", key: "estado", width: 20 }, { header: "Habilitado", key: "habilitado", width: 14 },
    { header: "Puntaje", key: "puntaje", width: 12 }, { header: "Fecha", key: "fecha", width: 20 },
  ], postulantes.map((p) => { const u = usuarioDesdePreregistro(p.preregistroId); return { nombre: nombreCompleto(u), ci: texto(u?.ci), estado: p.fechaEliminado ? "ELIMINADO" : p.estado, habilitado: p.habilitado ? "SI" : "NO", puntaje: p.puntajeTotal ?? 0, fecha: p.fechaHabilitacion }; }));

  agregarHoja(libro, "Guias", [
    { header: "Nombre", key: "nombre", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Sexo", key: "sexo", width: 14 }, { header: "Bloque", key: "bloque", width: 24 },
    { header: "Estado", key: "estado", width: 18 }, { header: "Fecha designación", key: "fecha", width: 20 },
  ], guias.map((g) => { const u = usuarioPorId.get(id(g.usuarioId)); return { nombre: nombreCompleto(u), ci: texto(u?.ci), sexo: texto(u?.sexo), bloque: bloqueGuiaPorUsuario.get(id(g.usuarioId))?.nombre ?? "SIN BLOQUE", estado: g.estado, fecha: g.fechaDesignacion }; }));

  agregarHoja(libro, "Bloques", [
    { header: "Nombre bloque", key: "nombre", width: 24 }, { header: "Guía hombre", key: "hombres", width: 42 },
    { header: "Guía mujer", key: "mujeres", width: 42 }, { header: "Cantidad asignada", key: "cantidad", width: 20 },
    { header: "Estado", key: "estado", width: 16 },
  ], bloques.map((b) => {
    const integrantes = [...relacionActivaPorFraterno.values()].filter((r) => id(r.bloqueId) === id(b._id)).length;
    const personasGuia = [...new Set([b.guiaId, ...(b.guiasIds ?? [])].filter(Boolean).map(id))].map((guiaId) => usuarioPorId.get(id(guiaPorId.get(guiaId)?.usuarioId))).filter(Boolean) as Documento[];
    return { nombre: b.nombre, hombres: personasGuia.filter((u) => u.sexo === "HOMBRE").map(nombreCompleto).join(" / "), mujeres: personasGuia.filter((u) => u.sexo === "MUJER").map(nombreCompleto).join(" / "), cantidad: integrantes, estado: b.estado };
  }));

  agregarHoja(libro, "Relaciones fraterno-bloque", [
    { header: "Fraterno", key: "fraterno", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Bloque", key: "bloque", width: 24 }, { header: "Estado", key: "estado", width: 16 },
    { header: "Asignación", key: "asignacion", width: 20 }, { header: "Retiro", key: "retiro", width: 20 },
  ], relaciones.map((r) => { const u = usuarioDesdeFraterno(r.fraternoId); return { fraterno: nombreCompleto(u), ci: texto(u?.ci), bloque: bloquePorId.get(id(r.bloqueId))?.nombre ?? "BLOQUE NO ENCONTRADO", estado: r.fechaEliminado ? "ELIMINADO" : r.estado, asignacion: r.fechaAsignacion, retiro: r.fechaRetiro ?? "" }; }));

  agregarHoja(libro, "Pagos", [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Cuota", key: "cuota", width: 12 }, { header: "Monto", key: "monto", width: 14 },
    { header: "Fecha", key: "fecha", width: 20 }, { header: "Estado", key: "estado", width: 18 },
    { header: "Método", key: "metodo", width: 14 }, { header: "Eliminado", key: "eliminado", width: 12 },
  ], pagos.map((p) => { const cuota = cuotaPorId.get(id(p.cuotaId)); const u = usuarioDesdePreregistro(cuota?.preregistroId); return { usuario: nombreCompleto(u), ci: texto(u?.ci), cuota: p.numeroPago, monto: p.monto, fecha: p.fechaPago, estado: p.estadoRevision, metodo: p.metodoPago, eliminado: p.fechaEliminado ? "SI" : "NO" }; }));

  agregarHoja(libro, "Tallas", [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Sexo", key: "sexo", width: 14 }, { header: "Polera", key: "polera", width: 14 },
    { header: "Chamarra", key: "chamarra", width: 14 }, { header: "Actualizado", key: "actualizado", width: 20 },
  ], tallas.map((t) => { const u = t.usuarioId ? usuarioPorId.get(id(t.usuarioId)) : usuarioDesdeFraterno(t.fraternoId); return { usuario: nombreCompleto(u), ci: texto(u?.ci), sexo: texto(u?.sexo), polera: texto(t.tallaPolera), chamarra: texto(t.tallaChamarra), actualizado: t.fechaActualizado }; }));

  const entregasActivas = entregas.filter((e) => e.estado === "ENTREGADO");
  agregarHoja(libro, "Entregas", [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Polera entregada", key: "polera", width: 20 }, { header: "Fecha polera", key: "fechaPolera", width: 20 },
    { header: "Chamarra entregada", key: "chamarra", width: 22 }, { header: "Fecha chamarra", key: "fechaChamarra", width: 20 },
  ], fraternos.map((f) => {
    const u = usuarioPorId.get(id(f.usuarioId));
    const delFraterno = entregasActivas.filter((e) => id(e.fraternoId) === id(f._id));
    const polera = delFraterno.find((e) => prendaPorId.get(id(e.prendaId))?.nombre === "POLERA");
    const chamarra = delFraterno.find((e) => prendaPorId.get(id(e.prendaId))?.nombre === "CHAMARRA");
    return { usuario: nombreCompleto(u), ci: texto(u?.ci), polera: polera ? "SI" : "NO", fechaPolera: polera?.fechaEntrega ?? "", chamarra: chamarra ? "SI" : "NO", fechaChamarra: chamarra?.fechaEntrega ?? "" };
  }));

  agregarHoja(libro, "Asistencias", [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Fecha", key: "fecha", width: 20 }, { header: "Entrada", key: "entrada", width: 20 },
    { header: "Salida", key: "salida", width: 20 }, { header: "Estado", key: "estado", width: 16 },
  ], asistencias.map((a) => { const u = usuarioPorId.get(id(a.usuarioId)); return { usuario: nombreCompleto(u), ci: texto(u?.ci), fecha: a.fecha, entrada: a.horaEntrada, salida: a.horaSalida ?? "", estado: a.estado }; }));

  const usuariosActivos = usuarios.filter((u) => vigente(u) && u.estado !== "ELIMINADO");
  agregarHoja(libro, "Usuarios sin bloque", [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Rol", key: "rol", width: 30 }, { header: "Estado", key: "estado", width: 16 },
  ], usuariosActivos.filter((u) => bloqueUsuario(u) === "SIN BLOQUE").map((u) => ({ usuario: nombreCompleto(u), ci: texto(u.ci), rol: rolesUsuario(u), estado: u.estado })));

  const pagoVigente = (cuota?: Documento) => cuota ? (pagosPorCuota.get(id(cuota._id)) ?? []) : [];
  const contextoPago = usuariosActivos.map((u) => {
    const preregistro = preregistroPorUsuario.get(id(u._id));
    const cuota = preregistro && cuotaPorPreregistro.get(id(preregistro._id));
    const movimientos = pagoVigente(cuota);
    const verificado = movimientos.filter((p) => p.estadoRevision === "VERIFICADO").reduce((total, p) => total + Number(p.monto || 0), 0);
    return { usuario: u, preregistro, cuota, movimientos, verificado };
  }).filter((item) => item.preregistro && item.cuota && item.cuota.estado !== "CANCELADA" && !item.cuota.exentoPago);

  const columnasEstadoPago = [
    { header: "Usuario", key: "usuario", width: 38 }, { header: "CI", key: "ci", width: 16 },
    { header: "Bloque", key: "bloque", width: 24 }, { header: "Esperado", key: "esperado", width: 14 },
    { header: "Verificado", key: "verificado", width: 14 }, { header: "Saldo", key: "saldo", width: 14 },
    { header: "Estado cuota", key: "estado", width: 18 },
  ];
  const filaPago = (item: typeof contextoPago[number]) => ({ usuario: nombreCompleto(item.usuario), ci: texto(item.usuario.ci), bloque: bloqueUsuario(item.usuario), esperado: item.cuota.montoTotal, verificado: item.verificado, saldo: Math.max(0, Number(item.cuota.montoTotal || 0) - item.verificado), estado: item.cuota.estado });
  agregarHoja(libro, "Usuarios sin pago", columnasEstadoPago, contextoPago.filter((item) => item.movimientos.length === 0).map(filaPago));
  agregarHoja(libro, "Pagos incompletos", columnasEstadoPago, contextoPago.filter((item) => item.movimientos.length > 0 && item.verificado < Number(item.cuota.montoTotal || 0)).map(filaPago));

  await libro.commit();
}
