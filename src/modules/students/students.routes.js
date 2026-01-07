import express from "express";
import upload from "../../middleware/upload.middleware.js";
import auth from "../../middleware/auth.middleware.js";
import {
  registerStudent,
  uploadDocument
} from "./students.controller.js";
router.post("/login", loginStudent);


const router = express.Router();

router.post("/register", registerStudent);
router.post("/documents", auth, upload.single("file"), uploadDocument);

export default router;
