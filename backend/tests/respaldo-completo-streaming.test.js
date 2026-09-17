const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Readable } = require("node:stream");
const unzipper = require("unzipper");
const ExcelJS = require("exceljs");
const { generarRespaldoCompletoTemporal } = require("../dist/services/RespaldoCompletoService");

function dbFalsa(datos) {
  const nombres = Object.keys(datos);
  return {
    databaseName: "tinkus_prueba",
    listCollections(filtro = {}) {
      const seleccion = filtro.name ? nombres.filter((nombre) => nombre === filtro.name) : nombres;
      return {
        toArray: async () => seleccion.map((name) => ({ name })),
        hasNext: async () => seleccion.length > 0,
      };
    },
    collection(nombre) {
      const coleccion = datos[nombre] ?? [];
      return {
        find() {
          const cursor = {
            batchSize() { return cursor; },
            toArray: async () => coleccion.map((item) => ({ ...item })),
            async *[Symbol.asyncIterator]() { for (const item of coleccion) yield { ...item }; },
          };
          return cursor;
        },
        indexes: async () => [{ name: "_id_", key: { _id: 1 } }],
      };
    },
  };
}

async function ejecutar(datos, archivos = [], abrirArchivo = async (key) => ({ stream: Readable.from(`contenido-${key}`), contentType: "text/plain" })) {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), "test-respaldo-"));
  const progreso = [];
  const respaldo = await generarRespaldoCompletoTemporal((estado) => progreso.push(estado), {
    db: dbFalsa(datos), raizTemporal: raiz,
    listarArchivos: async () => archivos,
    abrirArchivo,
  });
  return { raiz, respaldo, progreso, zip: await unzipper.Open.file(respaldo.ruta) };
}

test("respaldo pequeño incluye JSON, índices, documento y las hojas Excel requeridas", async () => {
  const usuario = { _id: "u1", nombres: "Ana", apellidoPaterno: "Pérez", ci: "123", telefono: "700", email: "ana@example.test", roles: ["r1"], estado: "ACTIVO" };
  const resultado = await ejecutar({ perfil_usuarios: [usuario], roles: [{ _id: "r1", codigo: "ADMINISTRADOR" }] }, [{ key: "uploads/123/foto.webp", size: 10 }]);
  try {
    const rutas = resultado.zip.files.map((archivo) => archivo.path);
    assert.ok(rutas.includes("LEEME-manifiesto.json"));
    assert.ok(rutas.includes("base-de-datos/colecciones/perfil_usuarios.json"));
    assert.ok(rutas.includes("base-de-datos/indices/perfil_usuarios.json"));
    assert.ok(rutas.includes("documentos/123/foto.webp"));
    assert.ok(rutas.includes("reportes/reporte-general.xlsx"));
    const entradaExcel = resultado.zip.files.find((archivo) => archivo.path === "reportes/reporte-general.xlsx");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await entradaExcel.buffer());
    for (const hoja of ["Usuarios", "Fraternos", "Postulantes", "Guias", "Bloques", "Relaciones fraterno-bloque", "Pagos", "Tallas", "Entregas", "Asistencias", "Usuarios sin bloque", "Usuarios sin pago", "Pagos incompletos"]) {
      assert.ok(libro.getWorksheet(hoja), `Falta la hoja ${hoja}`);
    }
    assert.equal(libro.getWorksheet("Usuarios").rowCount, 2);
    assert.equal(resultado.progreso.at(-1).etapa, "COMPLETADO");
  } finally {
    await resultado.respaldo.limpiar();
    await fs.rm(resultado.raiz, { recursive: true, force: true });
  }
});

test("respaldo conserva todos los registros recorriendo colecciones completas", async () => {
  const usuarios = Array.from({ length: 300 }, (_, i) => ({ _id: `u${i}`, nombres: `Usuario ${i}`, ci: String(1000 + i), telefono: "70000000", email: `u${i}@example.test`, roles: [], estado: "ACTIVO" }));
  const pagos = Array.from({ length: 450 }, (_, i) => ({ _id: `p${i}`, cuotaId: `c${i}`, numeroPago: 1, monto: 100, estadoRevision: "VERIFICADO" }));
  const resultado = await ejecutar({ perfil_usuarios: usuarios, detalle_cuotas: pagos });
  try {
    assert.equal(resultado.respaldo.colecciones, 2);
    assert.equal(resultado.respaldo.documentos, 750);
    const entrada = resultado.zip.files.find((archivo) => archivo.path === "base-de-datos/colecciones/detalle_cuotas.json");
    const restaurable = JSON.parse((await entrada.buffer()).toString("utf8"));
    assert.equal(restaurable.length, 450);
  } finally {
    await resultado.respaldo.limpiar();
    await fs.rm(resultado.raiz, { recursive: true, force: true });
  }
});

test("archivo grande se incorpora por fragmentos sin construir un Buffer total", async () => {
  const megabytes = 24;
  let fragmentos = 0;
  const abrirGrande = async () => ({
    contentType: "application/octet-stream",
    size: megabytes * 1024 * 1024,
    stream: Readable.from((async function* () {
      for (let i = 0; i < megabytes * 16; i += 1) {
        fragmentos += 1;
        yield Buffer.alloc(64 * 1024, i % 251);
      }
    })()),
  });
  const resultado = await ejecutar({ perfil_usuarios: [] }, [{ key: "uploads/prueba/archivo-grande.bin", size: megabytes * 1024 * 1024 }], abrirGrande);
  try {
    const entrada = resultado.zip.files.find((archivo) => archivo.path === "documentos/prueba/archivo-grande.bin");
    assert.equal(Number(entrada.uncompressedSize), megabytes * 1024 * 1024);
    assert.equal(fragmentos, megabytes * 16);
    assert.equal(resultado.respaldo.archivos, 1);
  } finally {
    await resultado.respaldo.limpiar();
    await fs.rm(resultado.raiz, { recursive: true, force: true });
  }
});

test("frontend y backend usan trabajo con progreso, ZIP temporal y rutas protegidas", () => {
  const raiz = path.resolve(__dirname, "../..");
  const rutas = require("node:fs").readFileSync(path.join(raiz, "backend/src/routes/RespaldoRoutes.ts"), "utf8");
  const servicio = require("node:fs").readFileSync(path.join(raiz, "backend/src/services/RespaldoCompletoService.ts"), "utf8");
  const api = require("node:fs").readFileSync(path.join(raiz, "frontend/src/api/RespaldoApi.ts"), "utf8");
  assert.ok(rutas.indexOf("router.use(authenticate, soloPropietarioRespaldo)") < rutas.indexOf('router.post("/exportar/preparar"'));
  assert.match(rutas, /multer\(\{[\s\S]*dest: tmpdir\(\)/);
  assert.match(servicio, /mkdtemp/);
  assert.match(servicio, /\.find\(\{\}\)\.batchSize\(100\)/);
  assert.match(servicio, /abrirStreamArchivoAlmacenado/);
  assert.doesNotMatch(servicio, /contenidoBase64|gzipSync/);
  assert.match(api, /\/respaldo\/exportar\/preparar/);
  assert.match(api, /\/respaldo\/exportar\/estado/);
  assert.match(api, /\/respaldo\/exportar\/descargar/);
  assert.match(api, /trabajo\.error\?\.tabla/);
});

test("un fallo informa etapa, archivo y mensaje real", async () => {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), "test-respaldo-error-"));
  try {
    await assert.rejects(
      () => generarRespaldoCompletoTemporal(() => undefined, {
        db: dbFalsa({ perfil_usuarios: [] }),
        raizTemporal: raiz,
        listarArchivos: async () => [{ key: "uploads/123/documento.pdf", size: 100 }],
        abrirArchivo: async () => { throw new Error("R2 no respondió"); },
      }),
      (error) => error.etapa === "ARCHIVOS" && error.tabla === "uploads/123/documento.pdf" && error.message === "R2 no respondió",
    );
  } finally {
    await fs.rm(raiz, { recursive: true, force: true });
  }
});
