const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { processImage } = require("../helpers/media");

const MEDIA_ROOT = path.join(__dirname, "../../uploads");

const getUploader = (folder, field = null, maxCount = 1) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  let multerMiddleware;
  if (Array.isArray(field)) {
    // multiple fields
    multerMiddleware = upload.fields(field);
  } else if (field) {
    // multiple images for one field
    multerMiddleware = upload.array(field, maxCount);
  } else {
    // single image
    multerMiddleware = upload.single("image");
  }

  return async (req, res, next) => {
    multerMiddleware(req, res, async (err) => {
      if (err) return next(err);

      req.folder = folder;
      const uploadPath = path.join(MEDIA_ROOT, folder);

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      try {
        if (req.file) {
          req.file = await processImage(req.file, uploadPath);
        } else if (req.files) {
          for (const key in req.files) {
            const processed = [];
            for (const file of req.files[key]) {
              processed.push(await processImage(file, uploadPath));
            }
            req.files[key] = processed;
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    });
  };
};

module.exports = getUploader;

/*
router.post("/", getUploader("brands"), createBrand);
router.post("/", getUploader("products", "images", 5), createProduct);
router.post("/", getUploader("products", [
  { name: "thumbnail", maxCount: 1 },
  { name: "gallery", maxCount: 5 },
]), createProduct);
 */
