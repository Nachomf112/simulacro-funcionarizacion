# 🏛️ Simulacro Funcionarización CIEMAT

> Aplicación web de simulacro de examen para el proceso de **cambio de régimen jurídico** del personal laboral fijo al Cuerpo de la **Escala Administrativa de Organismos Autónomos** — BOE-A-2026-11873

[![Estado](https://img.shields.io/badge/Estado-Activo-1D9E75?style=flat-square)](https://simulacro.menarguez-ia.com)
[![Preguntas](https://img.shields.io/badge/Banco-145%20preguntas-0070C0?style=flat-square)](#)
[![Versión](https://img.shields.io/badge/Versión-3.0-003366?style=flat-square)](#)
[![PWA](https://img.shields.io/badge/PWA-Compatible-5B1F8A?style=flat-square)](#)
[![Licencia](https://img.shields.io/badge/Licencia-Personal-BA7517?style=flat-square)](#)

---

## 🌐 Acceso

**👉 [simulacro.menarguez-ia.com](https://simulacro.menarguez-ia.com)**

Funciona en escritorio y móvil. Instalable como PWA.

---

## 📋 Sobre el examen

| Parámetro | Detalle |
|---|---|
| **Convocatoria** | BOE-A-2026-11873 |
| **Tipo de prueba** | Test · 3 alternativas por pregunta |
| **Total preguntas** | 60 + 5 de reserva |
| **Tiempo** | 80 minutos |
| **Penalización** | Sin penalización — errores y blancos valen 0 |
| **Mínimo aprobado** | 30 puntos (50%) |
| **Peso oposición** | 60% de la nota final |
| **Peso concurso** | 40% (méritos) |

---

## 📚 Temario oficial

| Tema | Contenido | Norma |
|---|---|---|
| **T1** | Ley 39/2015 (Procedimiento Administrativo) y Ley 40/2015 (Régimen Jurídico) | BOE 2015 |
| **T2** | Personal funcionario: concepto, clases, derechos y deberes | RDL 5/2015 EBEP |
| **T3** | Adquisición y pérdida de la condición de funcionario. Situaciones administrativas | RDL 5/2015 EBEP |
| **T4** | Administración electrónica, registros, Oficinas de Asistencia, PAGe | Ley 39/2015 |
| **T5** | Contratos del sector público: concepto, clases, adjudicación | Ley 9/2017 LCSP |
| **T6** | Presupuesto del Estado: concepto, estructura, créditos | Ley 47/2003 LGP |

---

## ⚙️ Funcionalidades

- ✅ **Banco de 145 preguntas reales** extraídas de los textos legales oficiales (sin inventar)
- ✅ **Modo examen** — temporizador de 80 min con barra visual y alertas de tiempo
- ✅ **Modo estudio** — sin límite de tiempo, con explicación inmediata tras cada respuesta
- ✅ **Configurable** — elige número de preguntas (5–60) y filtra por tema
- ✅ **Revisión completa** — tras finalizar, revisa cada pregunta con la respuesta correcta explicada
- ✅ **Estadísticas por tema** — detecta tus puntos débiles
- ✅ **Historial persistente** — guarda hasta 30 simulacros en el navegador
- ✅ **Sin penalización** — igual que el examen real
- ✅ **PWA** — instalable en móvil como app nativa
- ✅ **100% offline** — no requiere conexión tras la primera carga

---

## 🗂️ Estructura del repositorio

```
simulacro-funcionarizacion/
├── index.html          # Aplicación completa (HTML + CSS + JS en un único archivo)
├── CNAME               # Dominio personalizado (simulacro.menarguez-ia.com)
└── README.md           # Este archivo
```

---

## 🚀 Despliegue

La aplicación está desplegada en **GitHub Pages** con dominio personalizado vía **Cloudflare**:

```
GitHub Pages (Nachomf112) → CNAME → Cloudflare DNS → simulacro.menarguez-ia.com
```

Para actualizar el banco de preguntas o cualquier funcionalidad, basta con subir el nuevo `index.html` al repositorio. GitHub Pages publica automáticamente en 1–2 minutos.

---

## 📈 Historial de versiones

| Versión | Cambios |
|---|---|
| **v3.0** | Banco ampliado a 145 preguntas · Tema 6 completo con LGP y art. 134-135 CE |
| **v2.0** | Banco ampliado a 120 preguntas · Preguntas extraídas de textos legales reales |
| **v1.0** | Lanzamiento inicial · 60 preguntas · Todas las funcionalidades base |

---

## ✍️ Autor

**Nacho Menárguez** · [menarguez-ia.com](https://menarguez-ia.com)

Administrativo · CIEMAT · División de Combustión y Gasificación  
Especialista en automatización con IA y ciberseguridad SOC/Blue Team

---

> ⚠️ **Aviso:** Este simulacro es una herramienta de estudio personal. Las preguntas están elaboradas a partir de los textos legales oficiales vigentes. No sustituye la lectura directa de la normativa.
