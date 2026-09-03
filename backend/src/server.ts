
// import  express  from "express";
// import dotenv from 'dotenv'
// import cors from 'cors'
// import morgan from 'morgan'
// import { corsConfig } from "./config/cors";
// import { connectDB } from "./config/db";

// import rolRoutes from './routes/rolRoutes'
// import perfilusuarioRoutes from './routes/perfilUsuarioRoutes'
// import gestionRoutes from './routes/GestionRoutes'
// import inscripcionRoutes from './routes/InscripcionRoutes'

// import swaggerUi from "swagger-ui-express";
// import swaggerSpec from "./config/swagger";
// import path from "path";
// dotenv.config()

// connectDB()

// const app = express()

// app.use(cors(corsConfig))

// // logging 
// app.use(morgan('dev'))

// // leer datos de formularios
// app.use(express.json())

// // ruta principal para Render
// app.get('/', (req, res) => {
//   res.status(200).json({
//     message: 'API Discoteca funcionando correctamente',
//     status: 'OK'
//   })
// })

// // routes

// app.use('/api/rol', rolRoutes)
// app.use('/api/perfilusuario', perfilusuarioRoutes)
// app.use('/api/gestiones', gestionRoutes)
// app.use('/api/inscripciones', inscripcionRoutes)
// // documentacion
// app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


// app.use(
//   "/uploads",
//   express.static(
//     path.resolve(
//       process.cwd(),
//       "public",
//       "uploads",
//     ),
//   ),
// );
// export default app
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "node:fs";
import compression from "compression";
import multer from "multer";

import {
  corsConfig,
} from "./config/cors";

import {
  connectDB,
} from "./config/db";

import rolRoutes from "./routes/rolRoutes";
import perfilusuarioRoutes from "./routes/perfilUsuarioRoutes";
import gestionRoutes from "./routes/GestionRoutes";
import preregistroRoutes from "./routes/PreregistroRoutes";
import postulanteGuiaRoutes from "./routes/PostulanteGuiaRoutes";
import comunicacionRoutes from "./routes/ComunicacionRoutes";
import { auditarActividad } from "./middleware/auditarActividad";
import cuotaRoutes from "./routes/CuotaRoutes";
import fraternoRoutes from "./routes/FraternoRoutes";
import traspasoRoutes from "./routes/TraspasoRoutes";
import asistenciaRoutes from "./routes/AsistenciaRoutes";
import indumentariaRoutes from "./routes/IndumentariaRoutes";
import guiaRoutes from "./routes/GuiaRoutes";
import asistenciaPostulanteGuiaRoutes from "./routes/AsistenciaPostulanteGuiaRoutes";
import facultadRoutes from "./routes/FacultadRoutes";
import pasoVideoRoutes from "./routes/PasoVideoRoutes";
import configuracionPagoRoutes from "./routes/ConfiguracionPagoRoutes";
import credencialQrRoutes from "./routes/CredencialQrRoutes";
import reporteRoutes from "./routes/ReporteRoutes";
import tokenRegistroRoutes from "./routes/TokenRegistroRoutes";
import respaldoRoutes from "./routes/RespaldoRoutes";
import capacitacionRoutes from "./routes/CapacitacionRoutes";
import { servirArchivoR2 } from "./services/AlmacenamientoService";


import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

dotenv.config();

connectDB();

const app =
  express();

app.use(
  cors(
    corsConfig,
  ),
);

// logging
app.use(
  morgan("dev"),
);
app.use(compression());

// leer datos de formularios
app.use(
  express.json(),
);

/*
|--------------------------------------------------------------------------
| Archivos públicos
|--------------------------------------------------------------------------
|
| La URL:
| /uploads/cuentas-perfil/98657676/FOTO_98657676.webp
|
| buscará el archivo en:
| public/uploads/cuentas-perfil/98657676/FOTO_98657676.webp
|
*/

app.use(
  "/uploads",
  servirArchivoR2,
  express.static(
    path.resolve(
      process.cwd(),
      "public",
      "uploads",
    ), { maxAge: "7d", etag: true },
  ),
);

// ruta principal para Render
app.get(
  "/",
  (_req, res) => {
    res.status(200).json({
      message:
        "API Sistema Tinkus Puros funcionando correctamente",

      status:
        "OK",
    });
  },
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// routes
app.use(auditarActividad);
app.use(
  "/api/rol",
  rolRoutes,
);

app.use(
  "/api/perfilusuario",
  perfilusuarioRoutes,
);

app.use(
  "/api/gestiones",
  gestionRoutes,
);

app.use(
  "/api/preregistros",
  preregistroRoutes,
);
app.use("/api/postulantes-guia", postulanteGuiaRoutes);
app.use("/api/comunicacion", comunicacionRoutes);
app.use("/api/cuotas", cuotaRoutes);
app.use("/api/fraternos", fraternoRoutes);
app.use("/api/traspasos", traspasoRoutes);
app.use("/api/asistencias", asistenciaRoutes);
app.use("/api/asistencias-postulantes-guia", asistenciaPostulanteGuiaRoutes);
app.use("/api/facultades", facultadRoutes);
app.use("/api/pasos-videos", pasoVideoRoutes);
app.use("/api/configuracion-pagos", configuracionPagoRoutes);
app.use("/api/credenciales-qr", credencialQrRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/tokens-registro", tokenRegistroRoutes);
app.use("/api/respaldo", respaldoRoutes);
app.use("/api/indumentaria", indumentariaRoutes);
app.use("/api/guias", guiaRoutes);
app.use("/api/capacitacion", capacitacionRoutes);

// Multer falla antes de entrar al controlador. Convertimos esos fallos en
// respuestas claras para que el formulario indique qué archivo debe cambiar.
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const nombresArchivo: Record<string, string> = {
    fotoPerfil: "Foto de perfil",
    carnetIdentidadPdf: "Carnet de identidad (anverso)",
    carnetIdentidadReverso: "Carnet de identidad (reverso)",
    registroUniversitarioPdf: "Registro universitario",
    respaldo: "Archivo de respaldo",
  };
  if (error instanceof multer.MulterError) {
    const campo = typeof error.field === "string" ? error.field : undefined;
    const archivo = campo ? nombresArchivo[campo] ?? campo : "Archivo seleccionado";
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `${archivo}: supera el tamaño máximo permitido`, tipo: "ARCHIVO", campo, archivo, accion: "Reduce su tamaño o selecciona otro archivo" });
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ error: `${archivo}: se enviaron demasiados archivos o el campo no está permitido`, tipo: "ARCHIVO", campo, archivo, accion: "Elimina el archivo repetido y vuelve a intentarlo" });
    return res.status(400).json({ error: `${archivo}: ${error.message}`, tipo: "ARCHIVO", campo, archivo, accion: "Reemplaza este archivo y vuelve a intentarlo" });
  }
  if (error instanceof Error && /foto|imagen|archivo|carnet|universitario|pdf/i.test(error.message)) {
    const detalle = error as Error & { campoArchivo?: string; tipoError?: string };
    const campo = detalle.campoArchivo;
    return res.status(400).json({ error: error.message, tipo: detalle.tipoError ?? "ARCHIVO", campo, archivo: campo ? nombresArchivo[campo] ?? campo : undefined, accion: "Reemplaza el archivo indicado y vuelve a intentarlo" });
  }
  next(error);
});

// En modo local de producción Express sirve el frontend compilado. Así todos
// los celulares utilizan un solo puerto y no dependen del servidor de Vite.
const frontendDist=path.resolve(process.cwd(),"..","frontend","dist");
if(fs.existsSync(frontendDist)){
  app.use(express.static(frontendDist,{maxAge:"1h",etag:true}));
  app.get(/^(?!\/api|\/uploads|\/docs).*/,(_req,res)=>res.sendFile(path.join(frontendDist,"index.html")));
}



// documentación
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(
    swaggerSpec,
  ),
);

export default app;
