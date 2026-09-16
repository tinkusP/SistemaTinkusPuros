const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const unzipper = require("unzipper");
const {
  clasificarOrigenNomina,
  rellenarPlantillaNomina,
  validarFilaNomina,
} = require("../dist/services/NominaMatriculasService");

const plantillaRuta = path.join(__dirname, "..", "templates", "Plantilla_Nomina_TINKUS_PUROS_Y_NATURALES.xlsx");

test("clasifica los orígenes sin inventar una categoría", () => {
  assert.equal(clasificarOrigenNomina("INTERNO_UMSA"), "INTERNO");
  assert.equal(clasificarOrigenNomina("EXTERNO_NO_UMSA"), "EXTERNO");
  assert.equal(clasificarOrigenNomina(undefined), "SIN CLASIFICAR");
});

test("valida únicamente los campos obligatorios de la plantilla", () => {
  assert.equal(validarFilaNomina({ nombres: "Ana", apellidoPaterno: "Pérez", apellidoMaterno: "", ci: "00123", telefono: "07123456", registroUniversitario: "00042" }).valida, true);
  const invalida = validarFilaNomina({ nombres: "", apellidoPaterno: "", apellidoMaterno: "", ci: "12-A", telefono: "", registroUniversitario: "" });
  assert.equal(invalida.valida, false);
  assert.equal(invalida.problemas.length, 5);
});

test("genera la nómina sobre la plantilla y conserva hojas y metadatos ocultos", async () => {
  const original = fs.readFileSync(plantillaRuta);
  const generado = await rellenarPlantillaNomina(original, [{
    nombres: "María & José", apellidoPaterno: "Quispe", apellidoMaterno: "", ci: "001234", telefono: "07123456", registroUniversitario: "000099",
  }]);
  assert.ok(generado.length > 0);
  const originalZip = await unzipper.Open.buffer(original);
  const generadoZip = await unzipper.Open.buffer(generado);
  const nombresOriginales = originalZip.files.map((archivo) => archivo.path).sort();
  const nombresGenerados = generadoZip.files.map((archivo) => archivo.path).sort();
  assert.deepEqual(nombresGenerados, nombresOriginales);
  const leer = async (zip, nombre) => (await zip.files.find((archivo) => archivo.path === nombre).buffer()).toString("utf8");
  assert.equal(await leer(generadoZip, "xl/worksheets/sheet1.xml"), await leer(originalZip, "xl/worksheets/sheet1.xml"));
  assert.equal(await leer(generadoZip, "docProps/core.xml"), await leer(originalZip, "docProps/core.xml"));
  const libro = await leer(generadoZip, "xl/workbook.xml");
  assert.match(libro, /<sheet[^>]*sheetId="1"[^>]*name="_EFU_META"[^>]*state="veryHidden"/);
  assert.match(libro, /<sheet[^>]*sheetId="2"[^>]*name="Nómina"[^>]*state="visible"/);
  assert.match(libro, /<sheet[^>]*sheetId="3"[^>]*name="Instrucciones"[^>]*state="visible"/);
  const nomina = await leer(generadoZip, "xl/worksheets/sheet2.xml");
  assert.match(nomina, /r="A7"[^>]*t="inlineStr"[^>]*><is><t xml:space="preserve">María &amp; José<\/t>/);
  assert.match(nomina, /r="D7"[^>]*t="inlineStr"[^>]*><is><t xml:space="preserve">001234<\/t>/);
  assert.match(nomina, /r="E7"[^>]*t="inlineStr"[^>]*><is><t xml:space="preserve">07123456<\/t>/);
  assert.match(nomina, /<sheetProtection/);
  assert.match(nomina, /<dataValidations count="2">/);
});

test("rutas de matrículas son exclusivas de administrador real", () => {
  const rutas = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "ReporteRoutes.ts"), "utf8");
  const lineas = rutas.split("\n").filter((linea) => linea.includes("nomina-matriculas"));
  assert.equal(lineas.length, 5);
  lineas.forEach((linea) => assert.match(linea, /soloAdministradorReal/));
});
