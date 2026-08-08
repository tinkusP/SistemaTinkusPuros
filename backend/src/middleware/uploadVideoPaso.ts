import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import multer from "multer";
const carpeta=path.resolve(process.cwd(),"storage","temp","videos-pasos"); fs.mkdirSync(carpeta,{recursive:true});
const storage=multer.diskStorage({destination:(_r,_f,cb)=>cb(null,carpeta),filename:(_r,f,cb)=>cb(null,`${Date.now()}_${crypto.randomUUID()}${path.extname(f.originalname)||".video"}`)});
export const uploadVideoPaso=multer({storage,limits:{fileSize:500*1024*1024},fileFilter:(_r,f,cb)=>(f.mimetype.startsWith("video/")||f.mimetype.startsWith("audio/"))?cb(null,true):cb(new Error("Debe seleccionar un archivo de audio o video"))});
