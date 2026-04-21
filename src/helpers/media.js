const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const processImage = async (file, uploadPath) => {
  const fileName = `${Date.now()}_${Math.round(Math.random() * 1e6)}.webp`;
  const filePath = path.join(uploadPath, fileName);

  await sharp(file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 60 })
    .toFile(filePath);

  file.filename = fileName;
  file.path = filePath;
  file.mimetype = "image/webp";

  return file;
};

module.exports = {
  deleteFile,
  processImage,
};
