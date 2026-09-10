import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const TALLAS = new Set(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]);
const ADMIN = new Set(["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"]);
const id = (valor: any) => String(valor?._id ?? valor ?? "");
const fecha = (valor: any) => valor ? new Date(valor).toISOString() : "";
const activo = (doc: any) => !doc?.fechaEliminado;
const nombre = (u: any) => [u?.nombres, u?.apellidoPaterno, u?.apellidoMaterno].filter(Boolean).join(" ").trim();
const valorTalla = (valor: any) => String(valor ?? "").trim().toUpperCase();
const tallaPresente = (valor: any) => TALLAS.has(valorTalla(valor));
const tallaAusente = (valor: any) => !valorTalla(valor) || valorTalla(valor) === "SIN DEFINIR";
const lista = <T>(mapa: Map<string, T[]>, clave: string) => mapa.get(clave) ?? [];
const agrupar = <T>(items: T[], clave: (item: T) => string) => { const mapa = new Map<string, T[]>(); for (const item of items) mapa.set(clave(item), [...(mapa.get(clave(item)) ?? []), item]); return mapa; };
const csv = (valor: any) => `"${String(valor ?? "").replaceAll('"', '""')}"`;

type Fila = Record<string, any>;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada");
  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false, autoCreate: false, maxPoolSize: 2, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db!;
  const gestion = await db.collection("gestiones").find({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).limit(1).next();
  if (!gestion) throw new Error("No existe gestión ACTIVA o en INSCRIPCIONES");

  const [usuarios, roles, preregistros, todosPreregistros, fraternos, postulantes, guias, bloques, detalles, cuotas, pagos, tallas] = await Promise.all([
    db.collection("perfil_usuarios").find({ estado: { $ne: "ELIMINADO" }, fechaEliminado: null }).toArray(),
    db.collection("roles").find({ fechaEliminado: null }).toArray(),
    db.collection("preregistros").find({ gestionId: gestion._id, fechaEliminado: null }).toArray(),
    db.collection("preregistros").find({ fechaEliminado: null }).project({ _id: 1 }).toArray(),
    db.collection("fraternos").find({ gestionId: gestion._id, fechaEliminado: null }).toArray(),
    db.collection("postulantes_guia").find({ fechaEliminado: null }).toArray(),
    db.collection("guias").find({ gestionId: gestion._id }).toArray(),
    db.collection("bloques").find({ gestionId: gestion._id }).toArray(),
    db.collection("detalle_bloques").find({}).toArray(),
    db.collection("cuotas").find({ fechaEliminado: null }).toArray(),
    db.collection("detalle_cuotas").find({ fechaEliminado: null }).toArray(),
    db.collection("tallas_fraterno").find({}).toArray(),
  ]);

  const rolPorId = new Map(roles.map((r) => [id(r), r]));
  const prePorUsuario = new Map(preregistros.map((p) => [id(p.usuarioId), p]));
  const prePorId = new Map(preregistros.map((p) => [id(p), p]));
  const todosPreIds = new Set(todosPreregistros.map(id));
  const fratPorUsuario = new Map(fraternos.map((f) => [id(f.usuarioId), f]));
  const fratPorId = new Map(fraternos.map((f) => [id(f), f]));
  const postulantesPorPre = agrupar(postulantes, (p) => id(p.preregistroId));
  const guiaPorUsuario = new Map(guias.map((g) => [id(g.usuarioId), g]));
  const bloquePorId = new Map(bloques.map((b) => [id(b), b]));
  const detallesPorFraterno = agrupar(detalles, (d) => id(d.fraternoId));
  const cuotaPorPre = new Map(cuotas.map((c) => [id(c.preregistroId), c]));
  const pagosPorCuota = agrupar(pagos, (p) => id(p.cuotaId));
  const tallasPorUsuario = agrupar(tallas.filter((t) => t.usuarioId), (t) => id(t.usuarioId));
  const tallasPorFraterno = agrupar(tallas.filter((t) => t.fraternoId), (t) => id(t.fraternoId));
  const inconsistenciasGlobales: string[] = [];

  for (const detalle of detalles.filter((d) => d.estado !== "INACTIVO" && !d.fechaEliminado)) {
    const bloque = bloquePorId.get(id(detalle.bloqueId));
    if (!bloque) inconsistenciasGlobales.push(`DetalleBloque ${id(detalle)} activo apunta a bloque inexistente/fuera de gestión`);
    else if (bloque.estado !== "ACTIVO") inconsistenciasGlobales.push(`DetalleBloque ${id(detalle)} activo apunta al bloque no activo ${bloque.nombre}`);
  }
  for (const pago of pagos) if (!cuotas.some((c) => id(c) === id(pago.cuotaId))) inconsistenciasGlobales.push(`DetalleCuota ${id(pago)} sin Cuota válida`);
  for (const cuota of cuotas) if (!todosPreIds.has(id(cuota.preregistroId))) inconsistenciasGlobales.push(`Cuota ${id(cuota)} sin Preregistro válido`);

  const filas: Fila[] = [];
  for (const usuario of usuarios) {
    const uid = id(usuario); const pre = prePorUsuario.get(uid); const fraterno = fratPorUsuario.get(uid); const guia = guiaPorUsuario.get(uid);
    const rolesUsuario = (usuario.roles ?? []).map((rid: any) => rolPorId.get(id(rid))).filter(Boolean);
    const codigos = rolesUsuario.map((r: any) => String(r.codigo ?? r.nombre).trim().toUpperCase());
    const esAdmin = codigos.some((r: string) => ADMIN.has(r.replace(/[\s_-]/g, "")));
    const rolGuia = codigos.some((r: string) => r.replace(/[\s_-]/g, "") === "GUIA");
    const historialPostulante = pre ? lista(postulantesPorPre, id(pre)) : [];
    const postulante = historialPostulante.at(-1);
    const detallesPersona = fraterno ? lista(detallesPorFraterno, id(fraterno)) : [];
    const asignacionesVigentes = detallesPersona.filter((d) => d.estado !== "INACTIVO" && !d.fechaEliminado);
    const asignacionesValidas = asignacionesVigentes.filter((d) => bloquePorId.get(id(d.bloqueId))?.estado === "ACTIVO");
    const bloque = asignacionesValidas.length === 1 ? bloquePorId.get(id(asignacionesValidas[0].bloqueId)) : null;
    if (bloque) continue;

    const inc: string[] = [];
    if (asignacionesVigentes.length && !asignacionesValidas.length) inc.push("DetalleBloque vigente apunta a bloque eliminado, cerrado o fuera de gestión");
    if (asignacionesValidas.length > 1) inc.push("Más de una asignación activa válida");
    const bloquesGuia = bloques.filter((b) => [b.guiaId, ...(b.guiasIds ?? [])].some((gid: any) => id(gid) === id(guia)));
    if (guia?.estado === "ACTIVO" && !rolGuia) inc.push("Guía activo sin rol GUIA");
    if (rolGuia && (!guia || guia.estado !== "ACTIVO")) inc.push("Rol GUIA sin documento Guia activo");
    if (bloquesGuia.length > 1) inc.push("Guía asociado a dos o más bloques");

    const tallaUsuario = lista(tallasPorUsuario, uid); const tallaFraterno = fraterno ? lista(tallasPorFraterno, id(fraterno)) : [];
    if (tallaUsuario.length > 1 || tallaFraterno.length > 1) inc.push("Usuario con registros TallaFraterno duplicados");
    const tu = tallaUsuario.at(-1); const tf = tallaFraterno.at(-1);
    if (tu && tf && (valorTalla(tu.tallaPolera) !== valorTalla(tf.tallaPolera) || valorTalla(tu.tallaChamarra) !== valorTalla(tf.tallaChamarra))) inc.push("Talla por usuario y por fraterno diferentes");
    const talla = tf ?? tu; if (talla && !fraterno) inc.push("Persona sin Fraterno pero con talla");
    const polera = talla?.tallaPolera ?? ""; const chamarra = talla?.tallaChamarra ?? "";
    const poleraValida = tallaPresente(polera); const chamarraValida = tallaPresente(chamarra);
    const tallaInvalida = (!tallaAusente(polera) && !poleraValida) || (!tallaAusente(chamarra) && !chamarraValida);
    const estadoTalla = tallaInvalida ? "TALLA_INVALIDA" : poleraValida && chamarraValida ? "AMBAS_TALLAS" : poleraValida ? "SOLO_POLERA" : chamarraValida ? "SOLO_CHAMARRA" : "SIN_TALLAS";

    const cuota = pre ? cuotaPorPre.get(id(pre)) : undefined; if (cuota && !fraterno) inc.push("Persona sin Fraterno pero con Cuota");
    const movimientos = cuota ? lista(pagosPorCuota, id(cuota)).sort((a, b) => Number(a.numeroPago) - Number(b.numeroPago)) : [];
    const pagoN = (n: number) => movimientos.find((p) => Number(p.numeroPago) === n);
    const primera = pagoN(1), segunda = pagoN(2), tercera = pagoN(3);
    const verificados = movimientos.filter((p) => p.estadoRevision === "VERIFICADO");
    const pendientes = movimientos.filter((p) => p.estadoRevision === "PENDIENTE");
    const observados = movimientos.filter((p) => p.estadoRevision === "OBSERVADO");
    const rechazados = movimientos.filter((p) => p.estadoRevision === "RECHAZADO");
    const primeraVerificada = primera?.estadoRevision === "VERIFICADO";
    const totalVerificado = verificados.reduce((s, p) => s + Number(p.monto ?? 0), 0);
    if (primeraVerificada && cuota && ((cuota.estado === "PENDIENTE" && totalVerificado > 0) || (cuota.estado === "PAGADA" && Number(cuota.saldo) > 0))) inc.push("Primera cuota verificada con estado general de Cuota incompatible");
    const algunaTalla = poleraValida || chamarraValida; const ambasTallas = poleraValida && chamarraValida;
    let situacion = primeraVerificada ? ambasTallas ? "CUOTA_Y_AMBAS_TALLAS" : algunaTalla ? "CUOTA_Y_ALGUNA_TALLA" : "CUOTA_PERO_SIN_TALLAS" : algunaTalla ? "TALLAS_PERO_SIN_CUOTA" : "SIN_CUOTA_SIN_TALLAS";
    if (!primeraVerificada && algunaTalla && pendientes.length) situacion = "PAGO_PENDIENTE_CON_TALLAS";
    else if (!primeraVerificada && algunaTalla && observados.length) situacion = "PAGO_OBSERVADO_CON_TALLAS";
    else if (!primeraVerificada && algunaTalla && rechazados.length) situacion = "PAGO_RECHAZADO_CON_TALLAS";

    filas.push({
      Nombre: usuario.nombres ?? "", Apellidos: [usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" "), CI: usuario.ci ?? "", Telefono: usuario.telefono ?? "", Sexo: usuario.sexo ?? "SIN REGISTRO", Gestion: `${gestion.nombre} (${gestion.anio})`, Roles: codigos.join(" + ") || "SIN ROL", Es_administrador: esAdmin ? "SI" : "NO", Es_guia: guia?.estado === "ACTIVO" ? "SI" : "NO", Estado_guia: guia?.estado ?? "SIN REGISTRO", Bloques_como_guia: bloquesGuia.map((b) => b.nombre).join(" + ") || "SIN BLOQUE COMO GUIA", Es_postulante: postulante ? "SI" : "NO", Estado_postulante: postulante?.estado ?? "NUNCA POSTULO", Historial_postulante: historialPostulante.map((p) => p.estado).join(" > ") || "SIN REGISTRO", Es_fraterno: fraterno ? "SI" : "NO", Numero_fraterno: fraterno?.numeroFraterno ?? "", Solo_perfil_o_preregistro: !fraterno && !guia ? "SI" : "NO", Bloque: "SIN BLOQUE", Talla_polera: polera || "SIN REGISTRO", Talla_chamarra: chamarra || "SIN REGISTRO", Tiene_polera: poleraValida ? "SI" : "NO", Tiene_chamarra: chamarraValida ? "SI" : "NO", Tiene_alguna_talla: algunaTalla ? "SI" : "NO", Tiene_ambas_tallas: ambasTallas ? "SI" : "NO", Estado_talla: estadoTalla, Tiene_cuota: cuota ? "SI" : "NO", Estado_cuota: cuota?.estado ?? "SIN REGISTRO", Plan_pagos: cuota?.numeroCuotasElegidas ? `${cuota.numeroCuotasElegidas} CUOTA(S)` : "SIN PLAN", Primera_cuota_estado: primera?.estadoRevision ?? "SIN REGISTRO", Primera_cuota_fecha_pago: fecha(primera?.fechaPago), Primera_cuota_fecha_verificacion: fecha(primera?.fechaRevision), Primera_cuota_monto: primera?.monto ?? "", Primera_cuota_metodo: primera?.metodoPago ?? "", Segunda_cuota_estado: segunda?.estadoRevision ?? "SIN REGISTRO", Segunda_cuota_fecha: fecha(segunda?.fechaPago), Tercera_cuota_estado: tercera?.estadoRevision ?? "SIN REGISTRO", Tercera_cuota_fecha: fecha(tercera?.fechaPago), Pagos_verificados: verificados.length, Pagos_pendientes: pendientes.length, Pagos_observados: observados.length, Pagos_rechazados: rechazados.length, Total_pagado_verificado: totalVerificado.toFixed(2), Saldo: cuota?.saldo ?? "", Situacion: situacion, Pago_pendiente_con_tallas: !primeraVerificada && algunaTalla && pendientes.length ? "SI" : "NO", Pago_observado_con_tallas: !primeraVerificada && algunaTalla && observados.length ? "SI" : "NO", Pago_rechazado_con_tallas: !primeraVerificada && algunaTalla && rechazados.length ? "SI" : "NO", Observaciones_Inconsistencias: inc.join(" | "), _primeraFecha: primera?.fechaPago ? new Date(primera.fechaPago).getTime() : Infinity, _nombre: nombre(usuario), _esAdmin: esAdmin, _esGuia: guia?.estado === "ACTIVO", _esPostulante: Boolean(postulante), _esFraterno: Boolean(fraterno), _inc: inc.length,
    });
  }

  const prioridad: Record<string, number> = { CUOTA_Y_AMBAS_TALLAS: 1, CUOTA_Y_ALGUNA_TALLA: 2, CUOTA_PERO_SIN_TALLAS: 3, PAGO_PENDIENTE_CON_TALLAS: 4, PAGO_OBSERVADO_CON_TALLAS: 5, PAGO_RECHAZADO_CON_TALLAS: 6, TALLAS_PERO_SIN_CUOTA: 6, SIN_CUOTA_SIN_TALLAS: 7 };
  filas.sort((a, b) => (prioridad[a.Situacion] ?? 99) - (prioridad[b.Situacion] ?? 99) || a._primeraFecha - b._primeraFecha || a._nombre.localeCompare(b._nombre, "es"));
  const cuenta = (pred: (f: Fila) => boolean) => filas.filter(pred).length;
  const listas: Record<string, Fila[]> = {
    LISTOS_PARA_ASIGNACION: filas.filter((f) => f.Situacion === "CUOTA_Y_AMBAS_TALLAS"), PAGARON_PERO_NO_TIENE_TALLAS: filas.filter((f) => f.Situacion === "CUOTA_PERO_SIN_TALLAS"), PAGARON_Y_SOLO_TIENE_POLERA: filas.filter((f) => f.Primera_cuota_estado === "VERIFICADO" && f.Estado_talla === "SOLO_POLERA"), PAGARON_Y_SOLO_TIENE_CHAMARRA: filas.filter((f) => f.Primera_cuota_estado === "VERIFICADO" && f.Estado_talla === "SOLO_CHAMARRA"), TIENE_TALLAS_PERO_NO_PAGO: filas.filter((f) => f.Tiene_alguna_talla === "SI" && f.Primera_cuota_estado !== "VERIFICADO"), SIN_PAGO_Y_SIN_TALLAS: filas.filter((f) => f.Primera_cuota_estado !== "VERIFICADO" && f.Estado_talla === "SIN_TALLAS"), PAGOS_PENDIENTES: filas.filter((f) => f.Pagos_pendientes > 0), PAGOS_OBSERVADOS: filas.filter((f) => f.Pagos_observados > 0), PAGOS_RECHAZADOS: filas.filter((f) => f.Pagos_rechazados > 0), GUIAS_SIN_BLOQUE: filas.filter((f) => f._esGuia), POSTULANTES_SIN_BLOQUE: filas.filter((f) => f._esPostulante), ADMINISTRADORES_SIN_BLOQUE: filas.filter((f) => f._esAdmin), FRATERNOS_SIN_BLOQUE: filas.filter((f) => f._esFraterno),
  };
  const resumen = { total: filas.length, primeraVerificada: cuenta((f) => f.Primera_cuota_estado === "VERIFICADO"), sinPrimeraVerificada: cuenta((f) => f.Primera_cuota_estado !== "VERIFICADO"), ambasTallas: cuenta((f) => f.Estado_talla === "AMBAS_TALLAS"), soloPolera: cuenta((f) => f.Estado_talla === "SOLO_POLERA"), soloChamarra: cuenta((f) => f.Estado_talla === "SOLO_CHAMARRA"), sinTallas: cuenta((f) => f.Estado_talla === "SIN_TALLAS"), tallaInvalida: cuenta((f) => f.Estado_talla === "TALLA_INVALIDA"), cuotaAmbas: cuenta((f) => f.Situacion === "CUOTA_Y_AMBAS_TALLAS"), cuotaUna: cuenta((f) => f.Situacion === "CUOTA_Y_ALGUNA_TALLA"), cuotaSinTallas: cuenta((f) => f.Situacion === "CUOTA_PERO_SIN_TALLAS"), tallasSinCuota: cuenta((f) => f.Tiene_alguna_talla === "SI" && f.Primera_cuota_estado !== "VERIFICADO"), sinCuotaSinTallas: cuenta((f) => f.Primera_cuota_estado !== "VERIFICADO" && f.Estado_talla === "SIN_TALLAS"), administradores: cuenta((f) => f._esAdmin), guias: cuenta((f) => f._esGuia), postulantes: cuenta((f) => f._esPostulante), fraternos: cuenta((f) => f._esFraterno), otros: cuenta((f) => !f._esAdmin && !f._esGuia && !f._esPostulante && !f._esFraterno), inconsistencias: filas.reduce((s, f) => s + f._inc, 0) + inconsistenciasGlobales.length };
  const columnas = Object.keys(filas[0] ?? {}).filter((k) => !k.startsWith("_"));
  const csvTexto = "\uFEFF" + columnas.map(csv).join(";") + "\r\n" + filas.map((f) => columnas.map((c) => csv(f[c])).join(";")).join("\r\n");
  const tabla = filas.map((f, i) => `${i + 1}. ${f.Nombre} ${f.Apellidos} | CI ${f.CI} | ${f.Sexo} | ${f.Roles} | ${f.Estado_talla} | 1RA ${f.Primera_cuota_estado} | ${f.Plan_pagos} | SALDO ${f.Saldo === "" ? "SIN REGISTRO" : f.Saldo} | ${f.Situacion}${f.Bloques_como_guia !== "SIN BLOQUE COMO GUIA" ? ` | RESPONSABLE DE: ${f.Bloques_como_guia}` : ""}${f.Observaciones_Inconsistencias ? ` | ALERTA: ${f.Observaciones_Inconsistencias}` : ""}`).join("\n");
  const listasTxt = Object.entries(listas).map(([n, items]) => `\n${n} (${items.length})\n${"-".repeat(n.length + String(items.length).length + 3)}\n${items.map((f) => `- ${f.Nombre} ${f.Apellidos} | CI ${f.CI} | ${f.Situacion}`).join("\n") || "SIN REGISTROS"}`).join("\n");
  const informe = `USUARIOS SIN BLOQUE - AUDITORÍA DE SOLO LECTURA\nGenerado: ${new Date().toISOString()}\nGestión activa: ${gestion.nombre} (${gestion.anio}) [${gestion._id}]\n\nRESUMEN ESTADÍSTICO\n${Object.entries(resumen).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nLISTADO PRINCIPAL ORDENADO\n${tabla || "SIN REGISTROS"}\n\nLISTAS TEMÁTICAS\n${listasTxt}\n\nINCONSISTENCIAS GLOBALES (${inconsistenciasGlobales.length})\n${inconsistenciasGlobales.map((x) => `- ${x}`).join("\n") || "NINGUNA"}\n\nINFORME TÉCNICO\n1. Colecciones consultadas: perfil_usuarios, roles, gestiones, preregistros, fraternos, postulantes_guia, guias, bloques, detalle_bloques, cuotas, detalle_cuotas y tallas_fraterno.\n2. SIN BLOQUE: ausencia de DetalleBloque no eliminado/no INACTIVO que apunte a un bloque ACTIVO de la gestión activa.\n3. Tallas: prioridad al registro por fraterno y fallback por usuario; válidas: ${[...TALLAS].join(", ")}. SIN DEFINIR/vacío se considera ausencia; otros valores, TALLA_INVALIDA.\n4. Primera cuota: DetalleCuota numeroPago=1; pagada únicamente cuando estadoRevision=VERIFICADO.\n5. Roles: referencias PerfilUsuario.roles resueltas contra roles vigentes.\n6. Guías: documento Guia de la gestión activa y contraste con rol y Bloque.guiaId/guiasIds.\n7. Postulantes: relación Preregistro -> PostulanteGuia, conservando estado real.\n8. Fraternos: relación usuario+gestión activa.\n9. Gestión: ${gestion.nombre} (${gestion.anio}); las entidades operativas se limitaron a esta gestión. Los perfiles y roles son globales.\n10. Inconsistencias: ${resumen.inconsistencias}. No se corrigió ninguna.\n11. Registros sin bloque: ${resumen.total}.\n12. Sin clasificar: 0.\n13. Toda persona recibió situación mediante reglas explícitas; las tallas no reconocidas se conservaron como TALLA_INVALIDA.\n\nGARANTÍA\nLa conexión se abrió con autoIndex=false y autoCreate=false. Solo se ejecutaron lecturas find; no se ejecutaron save, insert, update, delete, migraciones ni sincronización de índices.\n`;
  const salida = process.cwd(); await Promise.all([writeFile(path.join(salida, "USUARIOS_SIN_BLOQUE_COMPLETO.txt"), informe, "utf8"), writeFile(path.join(salida, "USUARIOS_SIN_BLOQUE_COMPLETO.csv"), csvTexto, "utf8")]);
  console.log(`========================================\nUSUARIOS SIN BLOQUE\n===================\nGestión: ${gestion.nombre} (${gestion.anio})\nTotal: ${resumen.total}\n\n✅ Cuota verificada + ambas tallas: ${resumen.cuotaAmbas}\n🟡 Cuota verificada + una talla: ${resumen.cuotaUna}\n🔴 Cuota verificada + sin tallas: ${resumen.cuotaSinTallas}\n🟠 Tallas pero sin cuota verificada: ${resumen.tallasSinCuota}\n⚪ Sin cuota y sin tallas: ${resumen.sinCuotaSinTallas}\n\nROLES:\nAdministradores: ${resumen.administradores}\nGuías: ${resumen.guias}\nPostulantes: ${resumen.postulantes}\nFraternos: ${resumen.fraternos}\n\nINCONSISTENCIAS: ${resumen.inconsistencias}\n\nArchivos generados:\n- USUARIOS_SIN_BLOQUE_COMPLETO.txt\n- USUARIOS_SIN_BLOQUE_COMPLETO.csv\n========================================`);
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error("AUDITORÍA FALLIDA:", error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
