# ============================================================
#  MÓDULO DE NOTIFICACIONES — WhatsApp (CallMeBot) + Gmail SMTP
#  Cooperativa Central Shushufindi
#
#  Dos flujos:
#    1. notificar_despachado_con_alerta(datos)  → envío inmediato
#    2. notificar_pendiente(datos)              → registro + timer 24h
#       └─ proceso_pendientes()               → ejecutado por el scheduler
#
#  Variables de entorno requeridas (en el .env del proyecto):
#    GMAIL_USER         correo Gmail de la cooperativa
#    GMAIL_APP_PASSWORD contraseña de aplicación de 16 dígitos
#    SUPABASE_URL       URL del proyecto Supabase
#    SUPABASE_SERVICE_KEY  service_role key (no anon) para escribir sin RLS
# ============================================================

import os
import smtplib
import urllib.request
import urllib.parse
import logging
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
#  Configuración desde variables de entorno
# ──────────────────────────────────────────────
GMAIL_USER         = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SUPABASE_URL       = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY       = os.environ.get("SUPABASE_SERVICE_KEY", "")


# ══════════════════════════════════════════════
#  1. CANAL: WhatsApp vía CallMeBot
# ══════════════════════════════════════════════
def enviar_whatsapp(telefono: str, mensaje: str) -> dict:
    """
    Envía un mensaje de WhatsApp usando la API gratuita de CallMeBot.

    PRE-REQUISITO (una sola vez por transportista):
      El dueño del vehículo debe enviar el mensaje:
        "I allow callmebot to send me messages"
      al número de WhatsApp +34 644 44 44 60 para activar su número.
      Tras eso recibirá su apikey personal.

    Nota: el campo `tra_telefono` debe guardarse como "NUMERO+APIKEY"
    separados por "|", ej: "+593987654321|abc123"
    Para simplificar la demo, también acepta solo el número
    (en ese caso usa la APIKEY de .env como fallback).

    Args:
        telefono: formato "+593987654321|apikey" o "+593987654321"
        mensaje: texto plano del mensaje
    Returns:
        dict con 'ok' (bool) y 'detalle' (str)
    """
    if not telefono:
        return {"ok": False, "detalle": "Sin número de teléfono registrado"}

    # Separar número y apikey
    if "|" in telefono:
        numero, apikey = telefono.split("|", 1)
    else:
        numero = telefono
        apikey = os.environ.get("CALLMEBOT_APIKEY_FALLBACK", "")

    if not apikey:
        return {"ok": False, "detalle": "Sin CallMeBot apikey configurada"}

    numero  = numero.strip().lstrip("+")
    mensaje_enc = urllib.parse.quote(mensaje)
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={numero}&text={mensaje_enc}&apikey={apikey}"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "coop-shushufindi"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode(errors="replace")
        ok = resp.status == 200 and "Message queued" in body
        return {"ok": ok, "detalle": body[:200]}
    except Exception as e:
        logger.error("WhatsApp error: %s", e)
        return {"ok": False, "detalle": str(e)}


# ══════════════════════════════════════════════
#  2. CANAL: Correo vía Gmail SMTP
# ══════════════════════════════════════════════
def _html_alerta(nombre: str, placa: str, nivel: str,
                 tipo: str, numero_ticket: str, hora_despacho: str,
                 aviso: str) -> str:
    """Genera el cuerpo HTML del correo de alerta."""
    color = "#dc2626" if nivel.upper() == "ALTO" else "#d97706"
    icono = "🚨" if nivel.upper() == "ALTO" else "⚠️"
    if tipo == "despachado_con_alerta":
        titulo   = f"{icono} Alerta: Su vehículo fue despachado con riesgo {nivel}"
        subtitulo = (
            f"El vehículo <strong>{placa}</strong> correspondiente al ticket "
            f"<strong>{numero_ticket}</strong> fue despachado a las "
            f"<strong>{hora_despacho}</strong> a pesar de la alerta de riesgo."
        )
        nota = "Si tiene dudas o desea reportar un incidente, contacte a la cooperativa."
    else:
        titulo   = f"⏸️ Viaje Pospuesto por Seguridad"
        subtitulo = (
            f"El viaje programado para el vehículo <strong>{placa}</strong> "
            f"ha sido <strong>pospuesto preventivamente</strong> "
            f"debido a la alerta de riesgo {nivel}. <br><br>"
            f"Por protocolos de seguridad, <strong>el despacho se realizará en 24 horas</strong> "
            f"o una vez que las condiciones de la ruta mejoren."
        )
        nota = "Para mayor información sobre la nueva asignación, contacte a la cooperativa."

    RECOMENDACIONES = {
        "ALTO": [
            "Evaluar suspensión temporal: Posponer el despacho hasta que las condiciones mejoren.",
            "Inspección técnica rigurosa: Verificar tracción del vehículo y presión de neumáticos.",
            "Alerta de terreno: Riesgo inminente de atascamiento en mina por humedad reciente.",
            "Escalamiento inmediato: Notificar al supervisor de turno y registrar alerta en bitácora.",
            "Asignación estratégica: Garantizar vehículo con alta capacidad de tracción si se procede."
        ],
        "MEDIO": [
            "Control preventivo: Revisar estado de neumáticos, fluidos y reducir velocidad.",
            "Precaución de terreno: Posibilidad de terreno blando por humedad reciente en mina.",
            "Validación del operador: Confirmar que el conductor esté capacitado para estas condiciones.",
            "Monitoreo constante: Mantener comunicación activa y extremar cuidados en zona no asfaltada."
        ]
    }

    recoms_html = ""
    lista = RECOMENDACIONES.get(nivel.upper(), [])
    if lista:
        items = "".join([f"<li style='margin-bottom:6px;'>{item}</li>" for item in lista])
        recoms_html = f"""
              <p style="margin:16px 0 8px;color:#92400e;font-size:13px;font-weight:700;">
                📋 Recomendaciones de la IA:
              </p>
              <ul style="margin:0;padding-left:16px;color:#78350f;font-size:13px;line-height:1.5;">
                {items}
              </ul>
        """

    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Alerta Cooperativa</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Cabecera -->
        <tr>
          <td style="background:{color};padding:28px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:2px;
                      text-transform:uppercase;font-weight:600;">
              Cooperativa Central Shushufindi
            </p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">
              {titulo}
            </h1>
          </td>
        </tr>
        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              Estimado/a <strong>{nombre}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.7;">
              {subtitulo}
            </p>
            <!-- Caja de aviso IA -->
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;
                        padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">
                ⚡ Aviso del sistema IA:
              </p>
              <p style="margin:6px 0 0;color:#78350f;font-size:13px;line-height:1.6;">
                {aviso}
              </p>
              {recoms_html}
            </div>
            <!-- Detalles del ticket -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;
                          margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td style="padding:10px 16px;font-size:12px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;letter-spacing:1px;
                           width:40%;border-bottom:1px solid #e5e7eb;">
                  Ticket N°
                </td>
                <td style="padding:10px 16px;font-size:14px;font-weight:700;
                           color:#111827;border-bottom:1px solid #e5e7eb;">
                  {numero_ticket}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;letter-spacing:1px;
                           border-bottom:1px solid #e5e7eb;">
                  Vehículo (Placa)
                </td>
                <td style="padding:10px 16px;font-size:14px;font-weight:600;
                           color:#111827;font-family:monospace;border-bottom:1px solid #e5e7eb;">
                  {placa}
                </td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:10px 16px;font-size:12px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                  Nivel de Riesgo IA
                </td>
                <td style="padding:10px 16px;">
                  <span style="display:inline-block;background:{color};color:#fff;
                               font-size:12px;font-weight:700;padding:3px 10px;
                               border-radius:6px;text-transform:uppercase;">
                    {nivel}
                  </span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;color:#6b7280;font-size:13px;line-height:1.6;">
              {nota}
            </p>
          </td>
        </tr>
        <!-- Pie -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Este es un correo automático del sistema de gestión de flota.<br/>
              Cooperativa Central Shushufindi — {datetime.now().strftime('%d/%m/%Y %H:%M')}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def enviar_email(correo: str, nombre: str, asunto: str,
                 placa: str, nivel: str, tipo: str,
                 numero_ticket: str, hora_despacho: str, aviso: str) -> dict:
    """
    Envía un correo HTML usando Gmail SMTP con contraseña de aplicación.

    Requiere en .env:
      GMAIL_USER         ej: cooperativa.shushufindi@gmail.com
      GMAIL_APP_PASSWORD ej: abcd efgh ijkl mnop  (sin espacios)
    """
    if not correo:
        return {"ok": False, "detalle": "Sin correo registrado"}
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        return {"ok": False, "detalle": "Gmail no configurado (GMAIL_USER / GMAIL_APP_PASSWORD)"}

    html = _html_alerta(nombre, placa, nivel, tipo,
                        numero_ticket, hora_despacho, aviso)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"]    = f"Cooperativa Shushufindi <{GMAIL_USER}>"
    msg["To"]      = correo
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD.replace(" ", ""))
            server.sendmail(GMAIL_USER, correo, msg.as_string())
        return {"ok": True, "detalle": "Correo enviado correctamente"}
    except Exception as e:
        logger.error("Gmail error: %s", e)
        return {"ok": False, "detalle": str(e)}


# ══════════════════════════════════════════════
#  3. REGISTRO en Supabase
# ══════════════════════════════════════════════
def _supabase_insert(payload: dict) -> None:
    """Inserta un registro en notificacion_alerta vía REST (sin SDK)."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_KEY no configuradas; sin registro DB.")
        return
    url   = f"{SUPABASE_URL}/rest/v1/notificacion_alerta"
    data  = str.encode(__import__("json").dumps(payload))
    req   = urllib.request.Request(url, data=data, method="POST")
    req.add_header("apikey",        SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type",  "application/json")
    req.add_header("Prefer",        "return=minimal")
    try:
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        logger.error("Supabase insert error: %s", e)


def _supabase_update_estado(tic_id: int, tipo: str, estado: str,
                            error: Optional[str] = None) -> None:
    """Actualiza el estado de la notificación pendiente a enviada/fallida."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    import json
    patch = {"nal_estado": estado, "nal_enviada_en": datetime.now(timezone.utc).isoformat()}
    if error:
        patch["nal_error"] = error
    url  = (f"{SUPABASE_URL}/rest/v1/notificacion_alerta"
            f"?tic_id=eq.{tic_id}&nal_tipo=eq.{tipo}&nal_estado=eq.pendiente")
    data = str.encode(json.dumps(patch))
    req  = urllib.request.Request(url, data=data, method="PATCH")
    req.add_header("apikey",        SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type",  "application/json")
    try:
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        logger.error("Supabase update error: %s", e)


# ══════════════════════════════════════════════
#  4. FLUJOS DE NEGOCIO
# ══════════════════════════════════════════════

def _construir_mensajes(datos: dict, tipo: str) -> tuple[str, str, str]:
    """Devuelve (msg_whatsapp, asunto_email, aviso)."""
    nombre   = datos.get("tra_nombre_completo", "Propietario")
    placa    = datos.get("veh_placa", "—")
    nivel    = datos.get("nivel_riesgo", "Alto")
    ticket   = datos.get("tic_numero", "—")
    despacho = datos.get("tic_hora_despacho", "—")
    aviso    = datos.get("aviso_ia", "Revise el estado del vehículo.")

    if tipo == "despachado_con_alerta":
        msg_wa = (
            f"⚠️ ALERTA — Cooperativa Shushufindi\n"
            f"Estimado/a {nombre},\n"
            f"Su vehículo *{placa}* (Ticket {ticket}) fue despachado a las {despacho} "
            f"con nivel de riesgo *{nivel}*.\n"
            f"_{aviso}_\n"
            f"Contacte a la cooperativa ante cualquier novedad."
        )
        asunto = f"[ALERTA {nivel.upper()}] Vehículo {placa} despachado — Ticket {ticket}"
    else:
        msg_wa = (
            f"⏸️ VIAJE POSPUESTO — Cooperativa Shushufindi\n"
            f"Estimado/a {nombre},\n"
            f"El viaje del vehículo *{placa}* ha sido *pospuesto preventivamente* "
            f"por alerta de riesgo *{nivel}*.\n"
            f"Por protocolos de seguridad, el despacho se realizará en 24 horas "
            f"o cuando mejoren las condiciones."
        )
        asunto = f"[VIAJE POSPUESTO 24H] Vehículo {placa}"

    return msg_wa, asunto, aviso


def notificar_despachado_con_alerta(datos: dict) -> dict:
    """
    FLUJO 1: El ticket fue despachado a pesar de la alerta.
    Envía notificación inmediata por WhatsApp + Gmail.

    Args:
        datos: {
            tra_nombre_completo, tra_telefono, tra_correo,
            veh_placa, nivel_riesgo, tic_id, tic_numero,
            tic_hora_despacho, aviso_ia
        }
    """
    tipo      = "despachado_con_alerta"
    nombre    = datos.get("tra_nombre_completo", "Propietario")
    telefono  = datos.get("tra_telefono", "")
    correo    = datos.get("tra_correo",   "")
    placa     = datos.get("veh_placa", "—")
    nivel     = datos.get("nivel_riesgo", "Alto")
    ticket    = datos.get("tic_numero", "—")
    despacho  = datos.get("tic_hora_despacho", "—")
    tic_id    = datos.get("tic_id", 0)
    aviso     = datos.get("aviso_ia", "")

    msg_wa, asunto, aviso_html = _construir_mensajes(datos, tipo)

    res_wa    = enviar_whatsapp(telefono, msg_wa)
    res_email = enviar_email(correo, nombre, asunto, placa, nivel,
                             tipo, ticket, despacho, aviso_html)

    ok_total  = res_wa["ok"] or res_email["ok"]
    estado_db = "enviada" if ok_total else "fallida"
    error_db  = None if ok_total else f"WA:{res_wa['detalle']} / Email:{res_email['detalle']}"

    # Registrar en DB
    _supabase_insert({
        "tic_id":                    tic_id,
        "nal_tipo":                  tipo,
        "nal_nivel_riesgo":          nivel,
        "nal_estado":                estado_db,
        "nal_canal":                 "ambos",
        "nal_destinatario_nombre":   nombre,
        "nal_destinatario_telefono": telefono,
        "nal_destinatario_correo":   correo,
        "nal_placa":                 placa,
        "nal_mensaje":               msg_wa,
        "nal_programada_para":       None,
        "nal_enviada_en":            datetime.now(timezone.utc).isoformat(),
        "nal_error":                 error_db,
    })

    logger.info("Notificación flujo 1 [%s] — WA:%s Email:%s",
                tipo, res_wa["ok"], res_email["ok"])
    return {
        "ok":        ok_total,
        "whatsapp":  res_wa,
        "email":     res_email,
    }


def _ejecutar_despues(segundos: int, fn, *args):
    """Ejecuta fn(*args) en un hilo separado después de `segundos` segundos."""
    def _run():
        import time
        time.sleep(segundos)
        fn(*args)
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return t


def _enviar_notificacion_pendiente(datos: dict) -> None:
    """Callback del timer: envía la notificación de 'despacho no realizado'."""
    tipo      = "pendiente_expiracion"
    nombre    = datos.get("tra_nombre_completo", "Propietario")
    telefono  = datos.get("tra_telefono", "")
    correo    = datos.get("tra_correo",   "")
    placa     = datos.get("veh_placa", "—")
    nivel     = datos.get("nivel_riesgo", "Alto")
    ticket    = datos.get("tic_numero", "—")
    despacho  = datos.get("tic_hora_despacho", "—")
    tic_id    = datos.get("tic_id", 0)

    msg_wa, asunto, aviso_html = _construir_mensajes(datos, tipo)

    res_wa    = enviar_whatsapp(telefono, msg_wa)
    res_email = enviar_email(correo, nombre, asunto, placa, nivel,
                             tipo, ticket, despacho, aviso_html)

    ok_total  = res_wa["ok"] or res_email["ok"]
    estado_db = "enviada" if ok_total else "fallida"
    error_db  = None if ok_total else f"WA:{res_wa['detalle']} / Email:{res_email['detalle']}"

    _supabase_update_estado(tic_id, tipo, estado_db, error_db)
    logger.info("Notificación flujo 2 (timer 24h) [%s] — WA:%s Email:%s",
                tipo, res_wa["ok"], res_email["ok"])


def notificar_pendiente(datos: dict, horas: int = 24) -> dict:
    """
    FLUJO 2: El ticket se marcó como pendiente por la alerta.
    Envía inmediatamente la notificación informando que el VIAJE queda pospuesto por 24h.
    """
    tipo   = "viaje_pospuesto"
    nombre = datos.get("tra_nombre_completo", "Propietario")
    telefono = datos.get("tra_telefono", "")
    correo = datos.get("tra_correo", "")
    placa  = datos.get("veh_placa", "—")
    nivel  = datos.get("nivel_riesgo", "Alto")
    ticket = datos.get("tic_numero", "—")
    despacho = datos.get("tic_hora_despacho", "—")
    tic_id = datos.get("tic_id", 0)

    msg_wa, asunto, aviso_html = _construir_mensajes(datos, tipo)

    res_wa    = enviar_whatsapp(telefono, msg_wa)
    res_email = enviar_email(correo, nombre, asunto, placa, nivel,
                             tipo, ticket, despacho, aviso_html)

    ok_total  = res_wa["ok"] or res_email["ok"]
    estado_db = "enviada" if ok_total else "fallida"
    error_db  = None if ok_total else f"WA:{res_wa['detalle']} / Email:{res_email['detalle']}"

    # Registrar en DB
    _supabase_insert({
        "tic_id":                    tic_id if tic_id else None,
        "nal_tipo":                  tipo,
        "nal_nivel_riesgo":          nivel,
        "nal_estado":                estado_db,
        "nal_canal":                 "ambos",
        "nal_destinatario_nombre":   nombre,
        "nal_destinatario_telefono": telefono,
        "nal_destinatario_correo":   correo,
        "nal_placa":                 placa,
        "nal_mensaje":               msg_wa,
        "nal_programada_para":       None,
        "nal_enviada_en":            datetime.now(timezone.utc).isoformat(),
        "nal_error":                 error_db,
    })

    logger.info("Notificación viaje pospuesto enviada inmediatamente — WA:%s Email:%s",
                res_wa["ok"], res_email["ok"])
    
    return {
        "ok":               ok_total,
        "whatsapp":         res_wa,
        "email":            res_email,
        "mensaje":          f"Notificación de viaje pospuesto enviada correctamente.",
    }
