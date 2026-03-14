const http = require('http');
http.createServer((req, res) => {
  res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
  res.end();
}).listen(80, () => {
  console.log('🔄 HTTP→HTTPS redirect running on port 80');
});
