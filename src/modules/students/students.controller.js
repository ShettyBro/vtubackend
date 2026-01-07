import { uploadStudentDocument } from "../../utils/blobUpload.util.js";
import { createStudent, saveStudentDocument } from "./students.service.js";
import { success } from "../../utils/response.util.js";

export async function uploadDocument(req, res, next) {
  try {
    const { docType } = req.body;
    const student = req.user; // from JWT

    if (!req.file) {
      return res.status(400).json({ message: "File missing" });
    }

    if (!["id_proof", "bonafide", "photo"].includes(docType)) {
      return res.status(400).json({ message: "Invalid document type" });
    }

    const filename = `${docType}.${req.file.originalname.split(".").pop()}`;

    const url = await uploadStudentDocument({
      collegeCode: student.college_code,
      usn: student.usn,
      file: req.file,
      filename
    });

    await saveStudentDocument({
      studentId: student.student_id,
      docType,
      url
    });

    return success(res, "Document uploaded successfully", { url });
  } catch (err) {
    next(err);
  }
}

export async function registerStudent(req, res, next) {
  try {
    const student = await createStudent(req.body);
    return success(res, "Student registered successfully", student);
  } catch (err) {
    next(err);
  }
}

import { signToken } from "../../utils/jwt.util.js";
import { verifyStudentLogin } from "./students.service.js";

export async function loginStudent(req, res, next) {
  try {
    const { usn, password } = req.body;
    const result = await verifyStudentLogin(usn, password);

    const token = signToken({
      userId: result.student_id,
      role: "STUDENT",
      collegeId: result.college_id
    });

    res.json({
      token,
      student: {
        usn: result.usn,
        fullName: result.full_name
      }
    });
  } catch (err) {
    next(err);
  }
}
