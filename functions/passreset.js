const bcrypt = require('bcryptjs');
const sql = require('mssql');

exports.resetPassword = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  const { token, email, newPassword } = JSON.parse(event.body);

  if (!token || !email || !newPassword) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Token, email, and new password are required' }) };
  }

  try {
    // Verify JWT Token
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.email !== email) {
      return { statusCode: 403, headers, body: JSON.stringify({ message: 'Invalid token or email mismatch' }) };
    }

    let pool = await sql.connect(dbConfig);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await pool.request()
      .input('email', sql.NVarChar, email)
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .query(`
        UPDATE Users 
        SET password = @hashedPassword 
        WHERE email = @email
      `);

    // Delete OTP after successful password reset
    await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`DELETE FROM PasswordResetOTPs WHERE email = @email`);

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Password reset successful!' }) };

  } catch (error) {
    console.error('Error resetting password:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
};
