# Contrato de Mandato — Castle Crypto Income (CCI)

**Tipo:** Contrato de Mandato Remunerado para Gestión Técnica de Liquidez en Protocolos DeFi
**Jurisdicción:** República de Colombia
**Producto:** Castle Crypto Income (CCI)
**Elaborado por:** Legal Chief (AIOX) — Análisis orientativo
**Fecha base:** 2026-04-21
**Estado:** Borrador de trabajo — REQUIERE VALIDACIÓN POR ABOGADO COLOMBIANO HABILITADO

---

> ⚠️ **ADVERTENCIA:** Este documento es estrictamente orientativo y NO constituye asesoría legal. Antes de usarlo, validar con abogado colombiano habilitado en derecho financiero, societario, tributario y fintech.

---

## Por qué el Mandato es la estructura correcta para CCI

El mandato (arts. 2142+ Código Civil; arts. 1262+ Código Comercio) es la figura más defendible para CCI porque:

- **El cliente (mandante) conserva la propiedad de sus criptoactivos.** Nunca salen de su wallet o, si se usa wallet compartida, se mantienen contabilizados a su nombre.
- **Julián (mandatario) ejecuta instrucciones estratégicas** — aporta pools a usar, rangos de liquidez, configuración de Revert, niveles de leverage.
- **Julián cobra honorarios** — fijos (onboarding $5M COP) + variables (20% sobre ganancias).
- **El riesgo de mercado es del cliente**, no de Julián. Esto saca la operación del radar de "captación".

### Riesgos regulatorios residuales

1. **Registro PSAV (Decreto 1297/2023):** Si Julián custodia o mueve cripto por cuenta de terceros, debe inscribirse. **Mitigación:** que el cliente mantenga control de su wallet (llave privada o multifirma donde Julián no tenga control unilateral).
2. **Asesoría en mercado de valores no autorizada:** Los criptoactivos NO son valores en Colombia. **Mitigación:** redactar el contrato como "gestión técnica de liquidez DeFi" y NO como "asesoría de inversión en valores".
3. **SARLAFT:** Implementar KYC básico (identificación, origen de fondos) aunque no esté obligado formalmente.

### Tributación del Mandato (DIAN 2024)

- **Cliente mandante:** Criptoactivos declarados en patrimonio. Ganancias por venta: ganancia ocasional (15%) si tenencia > 2 años; renta ordinaria si < 2 años.
- **Julián mandatario:** Honorarios recibidos = ingresos por prestación de servicios → renta ordinaria.
- **Recomendación fuerte:** Facturar honorarios desde Castle Capital SAS — reduce exposición personal y formaliza.

---

## MODELO — Contrato de Mandato de Inversión en Criptoactivos

```
CONTRATO DE MANDATO REMUNERADO PARA GESTIÓN TÉCNICA DE
LIQUIDEZ EN PROTOCOLOS DEFI

Entre los suscritos:

MANDANTE (cliente):
[Nombre completo], mayor de edad, identificado con C.C. No. [___],
con domicilio en [ciudad], correo electrónico [___], quien en
adelante se denominará EL MANDANTE.

MANDATARIO (gestor):
CASTLE CAPITAL SAS, sociedad legalmente constituida, NIT [___],
representada por JULIÁN ESTEBAN CASTILLO MARULANDA, identificado
con C.C. No. [___], quien en adelante se denominará EL MANDATARIO.

CONSIDERANDO:
(i) Que EL MANDANTE es propietario de criptoactivos y desea
    obtener rendimientos a través de su participación en pools de
    liquidez de protocolos descentralizados (DeFi).
(ii) Que EL MANDATARIO posee conocimiento técnico y experiencia
    en gestión de liquidez en Uniswap, Revert Finance y protocolos
    análogos.
(iii) Que EL MANDANTE ha sido informado exhaustivamente sobre los
    riesgos del mercado DeFi y manifiesta comprenderlos.
(iv) Que las partes desean celebrar un contrato de mandato
    remunerado, conservando EL MANDANTE en todo momento la
    propiedad y el control sobre sus activos.

ACUERDAN las siguientes cláusulas:

PRIMERA — OBJETO
EL MANDANTE otorga mandato remunerado a EL MANDATARIO para que este,
actuando por cuenta y riesgo de EL MANDANTE, le brinde:
(a) Análisis técnico de oportunidades en protocolos DeFi.
(b) Recomendaciones específicas de configuración de pools de
    liquidez (pares, rangos, tick spacing).
(c) [Opcional] Ejecución técnica de operaciones en blockchain, bajo
    instrucción expresa y previa aprobación de EL MANDANTE para
    cada operación relevante.
(d) Monitoreo de posiciones y reporte periódico.

SEGUNDA — PROPIEDAD Y CUSTODIA DE LOS ACTIVOS
2.1. Los criptoactivos objeto del mandato son y seguirán siendo en
todo momento de propiedad exclusiva de EL MANDANTE.
2.2. EL MANDANTE conservará el control primario de la wallet, ya
sea mediante:
    [ ] Custodia total de la llave privada por parte de EL MANDANTE.
    [ ] Wallet multifirma (MultiSig) con [2 de 3] firmas, en la que
        EL MANDATARIO no puede ejecutar retiros unilateralmente.
2.3. EL MANDATARIO NO recibe, custodia ni controla los activos por
cuenta propia. Cualquier acceso técnico es exclusivamente
operacional para ejecutar instrucciones dentro del alcance pactado.

TERCERA — ACTIVOS GESTIONADOS
Los activos iniciales son: [listar cripto + montos].
Red/blockchain: [Ethereum / Arbitrum / etc.].
Protocolos autorizados: Uniswap V3, Revert Finance.
Cualquier adición o cambio requiere anexo firmado.

CUARTA — HONORARIOS
EL MANDATARIO percibirá las siguientes remuneraciones:

4.1. Honorario fijo de onboarding: CINCO MILLONES DE PESOS
COLOMBIANOS ($5.000.000 COP), pagaderos por anticipado al momento
de la firma, por concepto de configuración inicial, análisis de
perfil, apertura de wallet y primera asignación de liquidez.

4.2. Participación sobre ganancias (performance fee): VEINTE POR
CIENTO (20%) sobre las ganancias netas realizadas, calculadas
según la Cláusula Quinta.

4.3. Los honorarios serán facturados por CASTLE CAPITAL SAS con
los impuestos correspondientes (IVA, retenciones aplicables).

QUINTA — CÁLCULO DE GANANCIAS
5.1. "Ganancia neta" = Valor total del portafolio al final del
periodo de liquidación — Valor inicial aportado — Costos de gas y
fees de protocolo — Pérdidas realizadas en el periodo.
5.2. Periodicidad de liquidación: [trimestral / semestral / a la
terminación].
5.3. Moneda de cálculo: equivalente en USD al momento del cálculo,
tomando precio de [oráculo Chainlink / promedio últimas 24h
CoinGecko].
5.4. High Water Mark: El performance fee solo se causa sobre el
monto que exceda el máximo histórico previamente alcanzado y por
el cual ya se haya pagado fee.

SEXTA — OBLIGACIONES DEL MANDATARIO
EL MANDATARIO se obliga a:
(a) Actuar con la diligencia de un buen hombre de negocios.
(b) Rendir cuentas mensualmente con reportes detallados.
(c) Informar oportunamente cambios materiales del mercado que
    impacten las posiciones.
(d) Mantener confidencialidad sobre la información de EL MANDANTE.
(e) No usar los activos del mandato para fines distintos a los
    pactados.
(f) Cumplir con las normas de prevención de lavado de activos
    aplicables.

SÉPTIMA — OBLIGACIONES DEL MANDANTE
EL MANDANTE se obliga a:
(a) Pagar oportunamente los honorarios pactados.
(b) Proveer información veraz para cumplimiento KYC.
(c) Declarar el origen lícito de los criptoactivos aportados.
(d) Cumplir con sus obligaciones tributarias personales derivadas
    de las operaciones.
(e) Mantener actualizados sus medios de contacto y firma.

OCTAVA — DECLARACIONES Y EXCLUSIÓN DE GARANTÍAS
8.1. EL MANDANTE DECLARA EXPRESAMENTE que comprende y acepta los
siguientes riesgos:
(a) VOLATILIDAD EXTREMA de los criptoactivos — la pérdida puede
    ser total.
(b) IMPERMANENT LOSS en pools de liquidez.
(c) RIESGOS DE SMART CONTRACT — hacks, bugs, exploits.
(d) RIESGOS DE PROTOCOLO — depegs, rug pulls, liquidaciones.
(e) RIESGOS DE BORROWING Y LEVERAGE — liquidación forzada por
    movimientos adversos del precio.
(f) RIESGOS REGULATORIOS — cambios normativos en Colombia o en
    jurisdicciones de los protocolos.

8.2. EL MANDATARIO NO GARANTIZA:
(a) Rendimiento mínimo, máximo ni rango alguno.
(b) Preservación del capital.
(c) Rentabilidad positiva en ningún periodo.

8.3. EL MANDATARIO NO RESPONDE por:
(a) Hacks o fallos de protocolos de terceros (Uniswap, Revert, etc.).
(b) Liquidaciones producto de movimientos de mercado.
(c) Decisiones de EL MANDANTE de desatender recomendaciones.
(d) Cambios regulatorios o impositivos sobrevinientes.

OCTAVA BIS — LIMITACIÓN DE RESPONSABILIDAD
La responsabilidad máxima total de EL MANDATARIO frente a EL
MANDANTE por cualquier reclamo derivado de este contrato se limita
al monto de honorarios efectivamente cobrados en los doce (12)
meses anteriores al evento que origine la reclamación.

NOVENA — NATURALEZA JURÍDICA NO-FINANCIERA DEL SERVICIO
9.1. Las partes reconocen expresamente que este contrato NO
constituye:
(a) Un contrato de administración de recursos del público.
(b) Un contrato de fiducia mercantil.
(c) Un contrato de asesoría en valores en los términos de la
    Ley 964 de 2005.
(d) Un fondo de inversión colectivo.
(e) Una relación de intermediación de valores.

9.2. Los criptoactivos objeto del mandato NO son valores conforme
a la definición de la Ley 964 de 2005 y la doctrina vigente de la
Superintendencia Financiera de Colombia.

DÉCIMA — DURACIÓN
10.1. El presente contrato tendrá una duración inicial de doce
(12) meses, prorrogables automáticamente por periodos iguales.
10.2. Cualquiera de las partes podrá terminar el contrato con
aviso previo de treinta (30) días calendario.
10.3. Terminación sin preaviso: por incumplimiento grave, fraude
o incapacidad sobreviniente.

DÉCIMA PRIMERA — TERMINACIÓN Y LIQUIDACIÓN
Al terminar el contrato:
(a) EL MANDATARIO liquidará ordenadamente las posiciones abiertas.
(b) Se calculará el performance fee final (si aplica).
(c) Los activos permanecen en la wallet de EL MANDANTE.
(d) EL MANDATARIO entrega reporte final detallado.

DÉCIMA SEGUNDA — CONFIDENCIALIDAD
Las partes se obligan a mantener confidencialidad sobre la
información intercambiada, incluyendo estrategias, posiciones,
saldos y metodología. Obligación vigente por 3 años tras la
terminación.

DÉCIMA TERCERA — PROTECCIÓN DE DATOS
EL MANDATARIO tratará los datos personales de EL MANDANTE conforme
a la Ley 1581 de 2012 y la política de privacidad de CASTLE
CAPITAL SAS, que EL MANDANTE declara haber leído y aceptado.

DÉCIMA CUARTA — PREVENCIÓN DE LAVADO DE ACTIVOS
EL MANDANTE declara bajo gravedad de juramento que:
(a) Los recursos aportados provienen de actividades lícitas.
(b) No figura en listas vinculantes para Colombia (OFAC, ONU,
    etc.).
(c) Autoriza a EL MANDATARIO a realizar debida diligencia.

DÉCIMA QUINTA — RESOLUCIÓN DE CONFLICTOS
Las controversias derivadas de este contrato se someterán a:
[Opción A: jueces ordinarios de Armenia, Quindío]
[Opción B: Centro de Arbitraje y Conciliación de la Cámara de
Comercio de Bogotá — arbitraje en derecho, 1 árbitro, plazo 6
meses]

DÉCIMA SEXTA — MODIFICACIONES
Cualquier modificación debe constar por escrito y firmada por
ambas partes.

DÉCIMA SÉPTIMA — NOTIFICACIONES
[Correo electrónico y dirección física de cada parte]

ANEXO I — Perfil de Riesgo del Mandante (cuestionario firmado)
ANEXO II — Estrategia Inicial de Liquidez (pools, rangos, caps)
ANEXO III — Formato de Reporte Mensual
ANEXO IV — Política de Prevención LA/FT de Castle Capital SAS

Firmado en [ciudad], el [fecha], en dos (2) ejemplares.


_____________________________       _____________________________
EL MANDANTE                          CASTLE CAPITAL SAS
                                     Representante: Julián E. Castillo M.
```

---

## Checklist antes de usar este contrato

- [ ] Castle Capital SAS ya constituida.
- [ ] Perfil de riesgo firmado por el cliente.
- [ ] Wallet multifirma o custodia total del cliente configurada.
- [ ] KYC: C.C., comprobante de domicilio, declaración de origen de fondos.
- [ ] Cliente declarante de renta (confirmar para retenciones).
- [ ] Política de LA/FT interna redactada.

---

**Fuente:** Extraído de `docs/castle-capital/legal-estructuras-inversion.md` — Estructura 2
**Elaborado por:** Legal Chief (AIOX), 2026-04-21
