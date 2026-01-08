import http from 'http';
import registerStudent from '../functions/student/registerStudent.js';
import loginStudent from '../functions/student/loginStudent.js';
import forgotPassword from '../functions/student/forgotPassword.js';
import resetPassword from '../functions/student/resetPassword.js';

const server = http.createServer(async (req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));

  req.on('end', async () => {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: body || null,
      path: req.url
    };

    let handler;

    if (req.url === '/student/register') handler = registerStudent;
    else if (req.url === '/student/login') handler = loginStudent;
    else if (req.url === '/student/forgot-password') handler = forgotPassword;
    else if (req.url === '/student/reset-password') handler = resetPassword;
    else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const response = await handler(event, { requestId: 'local-test' });

    res.writeHead(response.statusCode, response.headers || {});
    res.end(response.body);
  });
});

server.listen(process.env.PORT || 3000);
