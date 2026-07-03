const http = require('http');

const data = JSON.stringify({
  origen: "MINA CONTRUCTORA CENTRAL",
  destino: "STOCK VICTORIA",
  material: "ARENA",
  empresa: "PROCOPET",
  placa: "UAA1038",
  cubicaje: 11,
  hora_despacho: "20:00"
});

const options = {
  hostname: '127.0.0.1',
  port: 8000,
  path: '/predecir',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => { body += d; });
  res.on('end', () => { console.log(body); });
});

req.on('error', error => { console.error(error); });
req.write(data);
req.end();
