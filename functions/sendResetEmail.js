const sql = require('mssql');
const fetch = require('node-fetch');
const crypto = require('crypto');
const dbConfig = require('../dbConfig');
require('dotenv').config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};


// send otp
exports.forgotPassword = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  const { email } = JSON.parse(event.body);
  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Email is required' }) };
  }

  // Generate a 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration 

  try {
      // Store OTP in the database
      let pool = await sql.connect(dbConfig);
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('otp', sql.NVarChar, otp)
        .input('expiresAt', sql.DateTime, expiresAt)
        .query(`
          INSERT INTO PasswordResetOTPs (email, otp, expires_at) 
          VALUES (@email, @otp, @expiresAt)
        `);

  // Send OTP via email
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Filmyadda <support@sudeepbro.me>',
      to: email,
      subject: 'Your Password Reset OTP',
      html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Static Template</title>

    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body
    style="
      margin: 0;
      font-family: 'Poppins', sans-serif;
      background: #ffffff;
      font-size: 14px;
    "
  >
    <div
      style="
        max-width: 680px;
        margin: 0 auto;
        padding: 45px 30px 60px;
        background: #f4f7ff;
        background-image: url(https://drive.google.com/uc?export=view&id=1KjykWV8X8MSjtP05RshfZkh0Lw6mWTl5
);
        background-repeat: no-repeat;
        background-size: 800px 452px;
        background-position: top center;
        background-size: cover;
        font-size: 14px;
        color: #434343;
      "
    >
      <header>
        <table style="width: 100%;">
          <tbody>
            <tr style="height: 0;">
              <td style="text-align: center;">
                <img
                  alt=""
                  src="https://drive.google.com/uc?export=view&id=1IGUcJpeEk-yIhxOasiwAXrtFBXhy3m_2"
                  height="50px" onclick="window.location.href='https://filmyadda.sudeepbro.me/index.html'"
                  style="cursor: pointer; width: 100%; max-width: 150px;"
                />
              </td>
              <td style="text-align: right;">
                <span
                  style="font-size: 16px; line-height: 30px; color: #ffffff;"
                  ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      <main>
        <div
          style="
            margin: 0;
            margin-top: 70px;
            padding: 92px 30px 115px;
            background:rgb(246, 240, 240);
            border-radius: 30px;
            text-align: center;
          "
        >
          <div style="width: 100%; max-width: 489px; margin: 0 auto;">
            <h1
              style="
                margin: 0;
                font-size: 24px;
                font-weight: 500;
                color:rgb(188, 248, 9);
              "
            >
              Your Password Reset OTP
            </h1>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-size: 16px;
                font-weight: 500;
              "
            >
          
            </p>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-weight: 500;
                letter-spacing: 0.56px;
                color: #1f1f1f;
              "
            >
              Hi,Use the following OTP
              to complete the procedure to change your Password. OTP is
              valid for
              <span style="font-weight: 600; color: #1f1f1f;">10 minutes</span>.
              Do not share this code with others!
            </p>
            <p
              style="
                margin: 0;
                margin-top: 60px;
                font-size: 40px;
                font-weight: 600;
                letter-spacing: 25px;
                color:rgb(0, 0, 0);
              "
            >
              ${otp}
            </p>
          </div>
        </div>
       <p style="margin: 0; margin-top: 16px; color: gold; text-align: center;">
  © 2024 Filmyadda. All rights reserved.
        </p>
        
        </main>
    </div>
  </body>
</html>`
    })
  });
 
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'OTP sent successfully!',
      otp,
      expiresAt
    })
  };
  
} catch (error) {
  console.error('Database error:', error);
  return { statusCode: 500, headers, body: JSON.stringify({ message: 'Internal Server Error' }) };
}
};



// Netlify Handler Export
exports.handler = async (event) => {
  const { action } = event.queryStringParameters || {};

  if (action === 'forgotPassword') {
    return exports.forgotPassword(event);
  } else if (action === 'resetPassword') {
    return exports.resetPassword(event);
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Not Found' })
    };
  }
};

