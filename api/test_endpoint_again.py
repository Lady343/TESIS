import urllib.request
import json

payload = {
    "tipo": "despachado_con_alerta",
    "tic_id": 999,
    "tic_numero": "T-UI-TEST",
    "tic_hora_despacho": "12:00",
    "nivel_riesgo": "ALTO",
    "aviso_ia": "Riesgo detectado",
    "veh_placa": "UAA1038",
    "tra_nombre_completo": "Liliana Urrutia",
    "tra_telefono": "0990407131",
    "tra_correo": "ladyurrutiasanchez18@gmail.com",
    "horas_espera": 24
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/notificar",
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        print("RESPUESTA DEL SERVIDOR:", result)
except Exception as e:
    print("ERROR DE CONEXIÓN O DEL SERVIDOR:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
