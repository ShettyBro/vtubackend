import { verifyToken } from "../utils/jwt.util.js";

export default function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    req.user = decoded; // { userId, role, collegeId }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
