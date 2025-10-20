import multer from "multer";
import path from "path";
import fs from "fs";

// Define the storage destination
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/affiliates/profile/";
    fs.mkdirSync(uploadPath, { recursive: true }); // create folder if it doesn't exist
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const fileName = `affiliate_${req.user.id}_${Date.now()}${ext}`;
    cb(null, fileName);
  },
});

// Filter to accept only image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, JPG, and PNG files are allowed"), false);
};

const uploadAffiliateImage = multer({ storage, fileFilter });

export default uploadAffiliateImage;
