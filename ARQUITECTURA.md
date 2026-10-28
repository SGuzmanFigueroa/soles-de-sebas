# Soles de Sebas · arquitectura

App web estática (GitHub Pages) pensada para iPhone. Este repositorio no contiene montos personales:
los datos viven en el navegador del teléfono y el plan llega cifrado (AES-GCM) en `plan.enc.json`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura, estilos (modo claro) y carga de scripts |
| `calc.js` | Cálculos de dinero, sin pantalla: ciclo de cobro, plan, pagos, resumen, presupuesto diario, semáforo, inversiones. Todo en céntimos enteros |
| `app.js` | Pantallas, registro rápido, cierre del día, objetivos, sincronización del plan y actualización automática |
| `tests/calc.test.js` | Pruebas de los cálculos críticos (`npm test`) |

## Pantallas

1. **Inicio**: disponible para gastar, semáforo, qué hacer hoy, día por día con calendario y cierre del día.
2. **Movimientos**: periodos, búsqueda, filtros, gráfico diario y lista editable.
3. **Presupuesto**: total del ciclo, presupuesto diario dinámico con explicación, modo estricto, categorías y pagos del ciclo.
4. **Objetivos**: metas (crear, editar, pausar, completar, eliminar), deudas con proyección, tarjetas y préstamos que te deben.
5. **Finanzas**: indicadores, análisis, gráficos, inversiones y ajustes (ciclo, semáforo, reparto del sueldo, respaldo).

## Reglas contables

Cada movimiento tiene una sola clase (`Calc.clase`), así nada se cuenta dos veces:

- **gasto**: consumo; cuenta para el presupuesto.
- **ingreso**: ingreso extra; suma al ciclo.
- **transferencia**: entre cuentas propias; no es gasto ni ingreso.
- **préstamo** y **devolución**: van a "Te deben"; no son gasto ni ingreso.
- **pago**: obligaciones del plan (deudas y fijos).
- **ahorro**: aportes y retiros de metas.
- **inversión**: compras y ventas con costo promedio. No cuenta como dinero disponible.

"Disponible para gastar" es el menor entre lo que queda del presupuesto y lo libre según los saldos del último cierre
(cuentas líquidas, ajustadas con lo registrado después, menos los pagos y aportes pendientes del ciclo).

## Datos en el teléfono (localStorage)

`soles.config`, `soles.movs`, `soles.cierres`, `soles.key`, `soles.planv`, `soles.ajustes`, `soles.objetivos`,
`soles.objAjustes`, `soles.precios`, `soles.prefs`. Los nombres y formatos anteriores se mantienen.
