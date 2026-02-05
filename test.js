import bcrypt from "bcryptjs";

const password = "Test@1234";
const saltRounds = 10;

try {
  const hash = await bcrypt.hash(password, saltRounds);
  console.log("Password:", password);
  console.log("Bcrypt Hash:", hash);
} catch (err) {
  console.error("Hashing failed:", err);
}
