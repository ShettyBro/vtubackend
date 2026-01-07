import jwt from "jsonwebtoken";
import env from "../config/env.js";

export function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: `${env.jwt.expiryHours}h`
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}
