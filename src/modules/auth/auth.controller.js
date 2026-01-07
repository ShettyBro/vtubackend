import { loginStudent } from "./auth.service.js";
import { success } from "../../utils/response.util.js";

export async function studentLogin(req, res, next) {
  try {
    const { usn, password } = req.body;

    if (!usn || !password) {
      return res.status(400).json({ message: "USN and password required" });
    }

    const result = await loginStudent({ usn, password });
    return success(res, "Login successful", result);
  } catch (err) {
    next(err);
  }
}
