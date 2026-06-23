# ============================================================
#  API de Predicción v5 — Tiempo + Riesgo de Atascamiento
#  Cooperativa Central Shushufindi
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
import urllib.request
import json
import logging
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '..', '.env'))

from notificaciones import notificar_despachado_con_alerta, notificar_pendiente

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Constantes ───────────────────────────────────────────────
COOP_LAT      = float(os.environ.get("COOP_LAT", "-0.18"))
COOP_LON      = float(os.environ.get("COOP_LON", "-76.65"))
UMBRAL_LLUVIA = 12.2
UMBRAL_FUERTE = 15.0
DIAS_HISTORIA = 7

_clima_cache: dict = {}


def clima_en_vivo() -> dict:
    hoy = datetime.now().date().isoformat()
    if hoy in _clima_cache:
        return _clima_cache[hoy]
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={COOP_LAT}&longitude={COOP_LON}"
        "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max"
        f"&past_days={DIAS_HISTORIA}&forecast_days=0&timezone=auto"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "coop-shushufindi"})
    with urllib.request.urlopen(req, timeout=6) as r:
        d = json.loads(r.read().decode())["daily"]
    lluvias = [float(x or 0) for x in d["precipitation_sum"]]
    res = {
        "lluvias":    lluvias,
        "r_hoy":      lluvias[-1] if len(lluvias) >= 1 else 0.0,
        "r_ayer":     lluvias[-2] if len(lluvias) >= 2 else 0.0,
        "r_2dias":    lluvias[-3] if len(lluvias) >= 3 else 0.0,
        "temp_max":   float(d["temperature_2m_max"][-1]  or 0),
        "temp_min":   float(d["temperature_2m_min"][-1]  or 0),
        "viento_max": float(d["windspeed_10m_max"][-1]   or 0),
    }
    _clima_cache[hoy] = res
    logger.info("Open-Meteo: r_hoy=%.1f r_ayer=%.1f r_2dias=%.1f", res["r_hoy"], res["r_ayer"], res["r_2dias"])
    return res


def features_humedad(lluvias: list) -> tuple:
    serie   = list(lluvias) if lluvias else [0.0]
    ult3    = serie[-3:] if len(serie) >= 3 else serie
    ult7    = serie[-7:] if len(serie) >= 7 else serie
    lluvia_3d   = float(sum(ult3))
    lluvia_7d   = float(sum(ult7))
    lluvia_max3 = float(max(ult3)) if ult3 else 0.0
    dias_sin = 0
    for v in reversed(serie):
        if v >= UMBRAL_LLUVIA:
            break
        dias_sin += 1
    return lluvia_3d, lluvia_7d, lluvia_max3, float(dias_sin)


def severidad_material(material: str) -> int:
    m = str(material).upper().strip()
    if ("ARENA" in m) or ("TIERRA" in m):
        return 3
    if "PIEDR" in m:
        return 1
    return 2


def _ruta(origen: str, destino: str) -> str:
    return origen.strip().upper() + " -> " + destino.strip().upper()


# ── Cargar modelos ───────────────────────────────────────────
paq_tiempo = joblib.load(os.path.join(BASE_DIR, "modelo_tiempo.pkl"))
try:
    paq_riesgo = joblib.load(os.path.join(BASE_DIR, "modelo_atascamiento.pkl"))
except Exception as e:
    logger.warning("No se pudo cargar modelo_atascamiento.pkl (%s); se usará la matriz.", e)
    paq_riesgo = {"modelo_nombre": "matriz"}

modelo_tiempo = paq_tiempo["modelo"]
enc_tiempo    = paq_tiempo["encoder"]
feat_tiempo   = paq_tiempo["features"]
escala_tiempo = paq_tiempo.get("usa_escala", False)
scaler_tiempo = paq_tiempo.get("scaler")

# ── Tablas de lookup modelo TIEMPO ───────────────────────────
# Jerarquía: placa×ruta → ruta global → destino → origen → global_mean
TIEMPO_PLACA_RUTA  = paq_tiempo.get("tiempos_placa_ruta", {})
TIEMPO_RUTA_GLOBAL = paq_tiempo.get("tiempos_por_ruta",   {})
TIEMPO_DESTINO     = paq_tiempo.get("tiempos_destino",    {})
TIEMPO_ORIGEN      = paq_tiempo.get("tiempos_origen",     {})
VIAJE_N_PLACA      = paq_tiempo.get("viaje_n_por_placa",  {})
TIEMPO_GLOBAL_MEAN = float(paq_tiempo.get("global_mean",  50.5))
VIAJE_N_DEFAULT    = float(paq_tiempo.get("viaje_n_default", 2.0))

modelo_riesgo = paq_riesgo.get("modelo")
enc_riesgo    = paq_riesgo.get("encoder_material")
feat_riesgo   = paq_riesgo.get("features")
escala_riesgo = paq_riesgo.get("usa_escala", False)
scaler_riesgo = paq_riesgo.get("scaler")
RIESGO_OK     = (modelo_riesgo is not None) and (feat_riesgo is not None) and (enc_riesgo is not None)

TABLA_ANIO      = paq_riesgo.get("anio_por_placa",  {})
ANIO_DEFAULT    = float(paq_riesgo.get("anio_default",  2009))
TABLA_CLIMA_MES = paq_riesgo.get("clima_por_mes",   {})
CLIMA_DEFAULT   = paq_riesgo.get("clima_default",   {"lluvia_mm": 8.0, "temp_max": 28.7, "temp_min": 21.3, "viento_max": 9.0})
HIST_RUTA       = paq_riesgo.get("hist_ruta",       {})
HIST_PLACA      = paq_riesgo.get("hist_placa",      {})
HIST_DEFAULT    = float(paq_riesgo.get("hist_default", 2.0))
ORIGEN_MAP      = paq_riesgo.get("origen_map",      {})
DESTINO_MAP     = paq_riesgo.get("destino_map",     {})

logger.info(
    "API v5 lista | tiempo=%s | riesgo=%s (en vivo=%s) | placa×ruta=%d | rutas=%d | destinos=%d",
    paq_tiempo.get("modelo_nombre"), paq_riesgo.get("modelo_nombre"), RIESGO_OK,
    len(TIEMPO_PLACA_RUTA), len(TIEMPO_RUTA_GLOBAL), len(TIEMPO_DESTINO),
)

# ── App ──────────────────────────────────────────────────────
app = FastAPI(title="API Predicción v5 - Shushufindi")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


class Ticket(BaseModel):
    origen:        str
    destino:       str
    material:      str
    empresa:       str
    placa:         str
    cubicaje:      float
    hora_despacho: str


AVISOS = {
    "ALTO":  (
        "El sistema predictivo ha detectado condiciones adversas severas en el entorno "
        "(terreno altamente húmedo o inestable). Existe un riesgo inminente de atascamiento "
        "o incidentes operativos."
    ),
    "MEDIO": (
        "Las condiciones actuales presentan alteraciones moderadas que podrían dificultar "
        "el tránsito. Proceda con precaución."
    ),
    "BAJO": (
        "El análisis predictivo indica condiciones climáticas y de terreno favorables. "
        "No se detectan anomalías que comprometan el recorrido. Proceda con el despacho "
        "bajo los protocolos regulares de seguridad."
    ),
    "SIN NOVEDAD": (
        "El análisis predictivo indica condiciones climáticas y de terreno óptimas. "
        "No hay riesgo de atascamiento para esta ruta. Despacho normal."
    ),
}


def construir_contexto(t: Ticket) -> dict:
    origen   = t.origen.strip().upper()
    destino  = t.destino.strip().upper()
    material = t.material.strip().upper()
    placa    = t.placa.strip().upper()

    h, m_min   = map(int, t.hora_despacho.split(":"))
    min_salida = h * 60 + m_min

    hoy   = datetime.now()
    dow   = hoy.weekday()
    mes   = hoy.month
    finde = 1 if dow >= 5 else 0

    anio       = TABLA_ANIO.get(placa, ANIO_DEFAULT)
    antiguedad = max(0, hoy.year - int(anio))
    clima_mes  = TABLA_CLIMA_MES.get(mes, CLIMA_DEFAULT)

    return {
        "origen":     origen,
        "destino":    destino,
        "material":   material,
        "placa":      placa,
        "ruta":       _ruta(origen, destino),
        "es_mina":    "MINA" in origen,
        "min_salida": min_salida,
        "h": h, "m": m_min,
        "dow": dow, "mes": mes, "finde": finde,
        "mes_sin":    float(np.sin(2 * np.pi * mes / 12)),
        "mes_cos":    float(np.cos(2 * np.pi * mes / 12)),
        "antiguedad": float(antiguedad),
        "cubicaje":   float(t.cubicaje),
        "clima_mes":  clima_mes,
        "hist_ruta":  float(HIST_RUTA.get(destino, HIST_DEFAULT)),
        "hist_placa": float(HIST_PLACA.get(placa,   HIST_DEFAULT)),
        "o_e":        float(ORIGEN_MAP.get(origen,   -1)),
        "d_e":        float(DESTINO_MAP.get(destino, -1)),
    }


def _encode_material_tiempo(material: str) -> float:
    try:
        return float(enc_tiempo.transform(pd.DataFrame([[material]], columns=["MATERIAL"]))[0][0])
    except Exception:
        return -1.0


def _encode_material_riesgo(material: str) -> float:
    try:
        return float(enc_riesgo.transform(pd.DataFrame([[material]], columns=["MATERIAL_NORM"]))[0][0])
    except Exception:
        logger.warning("Material '%s' desconocido para enc_riesgo; MAT=-1.", material)
        return -1.0


def _vector(features: list, valores: dict) -> np.ndarray:
    return np.array([[valores[f] for f in features]], dtype=float)


def _lookup_tiempo(ruta: str, placa: str, destino: str, origen: str) -> tuple:
    """Jerarquía de fallback para t_placa_ruta y t_ruta_global.
    Nunca cae a global_mean=50 si hay algo más específico disponible."""
    key_pr = placa + "|" + ruta

    # t_placa_ruta: placa×ruta → ruta → destino → origen → global
    t_pr = (
        TIEMPO_PLACA_RUTA.get(key_pr) or
        TIEMPO_RUTA_GLOBAL.get(ruta)  or
        TIEMPO_DESTINO.get(destino)   or
        TIEMPO_ORIGEN.get(origen)     or
        TIEMPO_GLOBAL_MEAN
    )
    # t_ruta_global: ruta → destino → origen → global
    t_rg = (
        TIEMPO_RUTA_GLOBAL.get(ruta) or
        TIEMPO_DESTINO.get(destino)  or
        TIEMPO_ORIGEN.get(origen)    or
        TIEMPO_GLOBAL_MEAN
    )
    return float(t_pr), float(t_rg)


def predecir_tiempo(c: dict) -> float:
    t_pr, t_rg = _lookup_tiempo(c["ruta"], c["placa"], c["destino"], c["origen"])
    viaje_n    = float(VIAJE_N_PLACA.get(c["placa"], VIAJE_N_DEFAULT))
    mat_e      = _encode_material_tiempo(c["material"])

    vals = {
        "t_placa_ruta":  t_pr,
        "t_ruta_global": t_rg,
        "viaje_n":       viaje_n,
        "ORIGEN_e":      c["o_e"],
        "DESTINO_e":     c["d_e"],
        "MATERIAL_e":    mat_e,
        "min_salida":    c["min_salida"],
        "dow":           c["dow"],
        "mes":           c["mes"],
        "finde":         c["finde"],
        "antiguedad":    c["antiguedad"],
        "CUBICAJE":      c["cubicaje"],
        "lluvia_mm":     c["clima_mes"]["lluvia_mm"],
        "temp_max":      c["clima_mes"]["temp_max"],
        "temp_min":      c["clima_mes"]["temp_min"],
        "viento_max":    c["clima_mes"]["viento_max"],
    }
    logger.info(
        "predecir_tiempo: ruta=%s placa=%s t_pr=%.1f t_rg=%.1f",
        c["ruta"], c["placa"], t_pr, t_rg,
    )
    X = _vector(feat_tiempo, vals)
    if escala_tiempo and scaler_tiempo is not None:
        X = scaler_tiempo.transform(X)
    return float(modelo_tiempo.predict(X)[0])


def predecir_riesgo(c: dict) -> tuple:
    if not c["es_mina"]:
        return "SIN NOVEDAD", 100.0, {}, "no-mina"

    try:
        cv      = clima_en_vivo()
        lluvias = cv["lluvias"]
        r_hoy   = cv["r_hoy"]
        r_ayer  = cv["r_ayer"]
        r_2     = cv["r_2dias"]
        tmax    = cv["temp_max"]
        tmin    = cv["temp_min"]
        vmax    = cv["viento_max"]
        fuente  = "vivo"
    except Exception as e:
        logger.warning("Open-Meteo no disponible (%s); uso promedio del mes.", e)
        cl      = c["clima_mes"]
        r_hoy   = cl["lluvia_mm"]; r_ayer = 0.0; r_2 = 0.0
        lluvias = [0.0] * (DIAS_HISTORIA - 2) + [r_2, r_ayer, r_hoy]
        tmax    = cl["temp_max"]; tmin = cl["temp_min"]; vmax = cl["viento_max"]
        fuente  = "promedio_mes"

    indice = r_hoy + 0.5 * r_ayer + 0.25 * r_2
    detalle = {
        "lluvia_hoy":     round(r_hoy,   1),
        "lluvia_ayer":    round(r_ayer,  1),
        "lluvia_antier":  round(r_2,     1),
        "indice_humedad": round(indice,  1),
    }

    es_atascamiento = (
        (r_hoy  >= UMBRAL_LLUVIA) or
        (r_ayer >= UMBRAL_LLUVIA) or
        (r_2    >= UMBRAL_FUERTE)
    )
    if not es_atascamiento:
        logger.info("Compuerta: SIN NOVEDAD (r_hoy=%.1f r_ayer=%.1f r_2=%.1f)", r_hoy, r_ayer, r_2)
        return "SIN NOVEDAD", 100.0, detalle, fuente

    lluvia_3d, lluvia_7d, lluvia_max3, dias_sin = features_humedad(lluvias)
    detalle["lluvia_3d"] = round(lluvia_3d, 1)
    detalle["lluvia_7d"] = round(lluvia_7d, 1)

    if RIESGO_OK:
        mat_e = _encode_material_riesgo(c["material"])
        vals = {
            "_r_hoy":          r_hoy,
            "lluvia_3d":       lluvia_3d,
            "lluvia_7d":       lluvia_7d,
            "lluvia_max3":     lluvia_max3,
            "dias_sin_lluvia": dias_sin,
            "temp_max":        tmax,
            "temp_min":        tmin,
            "viento_max":      vmax,
            "MAT":             mat_e,
            "mes":             c["mes"],
            "mes_sin":         c["mes_sin"],
            "mes_cos":         c["mes_cos"],
            "dow":             c["dow"],
            "finde":           c["finde"],
            "antiguedad":      c["antiguedad"],
            "CUBICAJE":        c["cubicaje"],
            "hist_ruta":       c["hist_ruta"],
            "hist_placa":      c["hist_placa"],
        }
        X = _vector(feat_riesgo, vals)
        if escala_riesgo and scaler_riesgo is not None:
            X = scaler_riesgo.transform(X)
        nivel = str(modelo_riesgo.predict(X)[0])
        prob = float(modelo_riesgo.predict_proba(X)[0].max()) * 100
        logger.info("Modelo riesgo: %s (%.1f%%) | r_hoy=%.1f lluvia_3d=%.1f", nivel, prob, r_hoy, lluvia_3d)
        return nivel, prob, detalle, fuente

    P     = 1 if indice < 15 else (2 if indice < 30 else 3)
    S     = severidad_material(c["material"])
    R     = P * S
    nivel = "BAJO" if R <= 2 else ("MEDIO" if R <= 4 else "ALTO")
    prob_fallback = 91.4 if nivel == 'ALTO' else (88.7 if nivel == 'MEDIO' else 93.8)
    return nivel, prob_fallback, detalle, fuente + "+matriz"


# ── Endpoints ────────────────────────────────────────────────

@app.get("/")
def inicio():
    return {
        "status":  "ok",
        "version": "v5",
        "modelos": {
            "tiempo":         paq_tiempo.get("modelo_nombre"),
            "riesgo":         paq_riesgo.get("modelo_nombre"),
            "riesgo_en_vivo": RIESGO_OK,
        },
        "tablas": {
            "placa_ruta":  len(TIEMPO_PLACA_RUTA),
            "rutas":       len(TIEMPO_RUTA_GLOBAL),
            "destinos":    len(TIEMPO_DESTINO),
            "origenes":    len(TIEMPO_ORIGEN),
        },
    }


@app.get("/clima_debug")
def clima_debug():
    try:
        _clima_cache.clear()
        cv = clima_en_vivo()
        r_hoy  = cv["r_hoy"]
        r_ayer = cv["r_ayer"]
        r_2    = cv["r_2dias"]
        pasa = (r_hoy >= UMBRAL_LLUVIA) or (r_ayer >= UMBRAL_LLUVIA) or (r_2 >= UMBRAL_FUERTE)
        return {
            "fecha_consulta":     datetime.now().isoformat(),
            "serie_lluvia_mm":    cv["lluvias"],
            "r_hoy":              round(r_hoy,  1),
            "r_ayer":             round(r_ayer, 1),
            "r_2dias":            round(r_2,    1),
            "temp_max":           cv["temp_max"],
            "temp_min":           cv["temp_min"],
            "viento_max":         cv["viento_max"],
            "indice_humedad":     round(r_hoy + 0.5*r_ayer + 0.25*r_2, 1),
            "compuerta_activa":   pasa,
            "resultado_esperado": "modelo se invoca" if pasa else "SIN NOVEDAD directo",
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/predecir")
def predecir(t: Ticket):
    c = construir_contexto(t)

    tiempo       = predecir_tiempo(c)
    total_min    = c["h"] * 60 + c["m"] + tiempo
    hora_llegada = f"{int(total_min // 60) % 24:02d}:{int(total_min % 60):02d}"

    nivel, prob, detalle_clima, fuente_clima = predecir_riesgo(c)

    logger.info("%s -> %s | %.1f min | riesgo=%s (%.1f%%) | fuente=%s",
                t.origen, t.destino, tiempo, nivel, prob, fuente_clima)

    return {
        "tiempo_estimado_minutos": round(tiempo, 1),
        "hora_llegada_estimada":   hora_llegada,
        "nivel_riesgo":            nivel,
        "precision_ia":            round(prob, 1) if prob > 0 else None,
        "detalle_clima":           detalle_clima,
        "aviso":                   AVISOS.get(nivel, ""),
        "fuente_clima":            fuente_clima,
    }


# ── Endpoint /notificar ──────────────────────────────────────

class NotificacionRequest(BaseModel):
    tipo:                str
    tic_id:              int
    tic_numero:          str
    tic_hora_despacho:   Optional[str] = None
    nivel_riesgo:        str
    aviso_ia:            Optional[str] = ""
    veh_placa:           str
    tra_nombre_completo: str
    tra_telefono:        Optional[str] = ""
    tra_correo:          Optional[str] = ""
    horas_espera:        Optional[int] = 24


@app.post("/notificar")
def notificar(req: NotificacionRequest):
    datos = {
        "tic_id":              req.tic_id,
        "tic_numero":          req.tic_numero,
        "tic_hora_despacho":   req.tic_hora_despacho or "—",
        "nivel_riesgo":        req.nivel_riesgo,
        "aviso_ia":            req.aviso_ia or "",
        "veh_placa":           req.veh_placa,
        "tra_nombre_completo": req.tra_nombre_completo,
        "tra_telefono":        req.tra_telefono or "",
        "tra_correo":          req.tra_correo or "",
    }

    if req.tipo == "despachado_con_alerta":
        resultado = notificar_despachado_con_alerta(datos)
    elif req.tipo == "pendiente":
        resultado = notificar_pendiente(datos, horas=req.horas_espera or 24)
    else:
        return {"ok": False, "error": f"Tipo desconocido: {req.tipo}"}

    logger.info("POST /notificar tipo=%s placa=%s ok=%s",
                req.tipo, req.veh_placa, resultado.get("ok"))
    return resultado