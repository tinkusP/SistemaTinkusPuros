import multer from "multer";

export const uploadAfiche = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("El afiche debe ser una imagen JPG, PNG o WebP"));
      return;
    }
    callback(null, true);
  },
});
