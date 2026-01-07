import multer from "multer";

const upload = multer({
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  }
});

export default upload;
