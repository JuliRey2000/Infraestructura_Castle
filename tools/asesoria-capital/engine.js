'use strict';

const ARCA_ALLOCATION = {
  conservador: { acciones: 0.30, rentaFija: 0.45, caja: 0.20, alternativos: 0.05 },
  moderado:    { acciones: 0.55, rentaFija: 0.25, caja: 0.10, alternativos: 0.10 },
  agresivo:    { acciones: 0.75, rentaFija: 0.05, caja: 0.05, alternativos: 0.15 }
};

const RETORNO_ESPERADO = {
  conservador: 0.08,
  moderado:    0.11,
  agresivo:    0.15
};

const FONDO_EMERGENCIA_MESES = 6;

function determineProfile(q1, q2) {
  const tolera = !!q1;
  const necesitaCorto = !!q2;
  if (!tolera && necesitaCorto) return 'conservador';
  if (tolera && !necesitaCorto) return 'agresivo';
  return 'moderado';
}

function getArcaAllocation(profile) {
  return ARCA_ALLOCATION[profile] || ARCA_ALLOCATION.moderado;
}

function calculatePortfolioAllocation(capital, profile, hasEmergencyFund, monthlyExpenses) {
  const allocation = getArcaAllocation(profile);
  const emergencyFund = hasEmergencyFund ? 0 : Math.max(0, monthlyExpenses * FONDO_EMERGENCIA_MESES);
  const investableCapital = Math.max(0, capital - emergencyFund);

  return {
    capitalTotal: capital,
    fondoEmergencia: emergencyFund,
    capitalInvertible: investableCapital,
    perfil: profile,
    porcentajes: allocation,
    montos: {
      acciones: investableCapital * allocation.acciones,
      rentaFija: investableCapital * allocation.rentaFija,
      caja: investableCapital * allocation.caja,
      alternativos: investableCapital * allocation.alternativos
    }
  };
}

function selectETFs(profile, etfBank) {
  const acciones = (etfBank.acciones && etfBank.acciones[profile]) || [];
  const rentaFija = etfBank.rentaFija || [];
  const caja = etfBank.caja || [];
  return { acciones, rentaFija, caja };
}

function debtStrategy(debts, monthlyIncome, monthlyExpenses, monthlyObjective) {
  if (!Array.isArray(debts) || debts.length === 0) {
    return {
      hayDeudas: false,
      ordenadas: [],
      flujoDisponible: Math.max(0, monthlyIncome - monthlyExpenses),
      mensajeEstrategia: 'Sin deudas registradas. Capital disponible va directo a inversión.'
    };
  }

  const ordenadas = [...debts]
    .filter((d) => d && d.monto > 0)
    .sort((a, b) => a.monto - b.monto);

  const totalCuotaMinima = ordenadas.reduce((acc, d) => acc + (d.cuotaMinima || 0), 0);
  const flujoLibre = Math.max(0, monthlyIncome - monthlyExpenses - totalCuotaMinima);
  const ataqueMensual = flujoLibre;

  let saldoAcumulado = 0;
  let mesAcumulado = 0;
  const cronograma = ordenadas.map((deuda) => {
    const tasaMensual = (deuda.tasa || 0) / 100 / 12;
    const cuotaTotal = (deuda.cuotaMinima || 0) + ataqueMensual;
    const meses = estimarMesesPago(deuda.monto, tasaMensual, cuotaTotal);
    mesAcumulado += meses;
    saldoAcumulado += deuda.monto;
    return {
      nombre: deuda.nombre,
      monto: deuda.monto,
      tasa: deuda.tasa,
      cuotaMinima: deuda.cuotaMinima || 0,
      mesesPago: meses,
      mesPagoFinal: mesAcumulado
    };
  });

  return {
    hayDeudas: true,
    ordenadas: cronograma,
    cuotaMinimaTotal: totalCuotaMinima,
    flujoLibreParaAtaque: ataqueMensual,
    mesesParaLibertad: mesAcumulado,
    saldoTotal: saldoAcumulado,
    mensajeEstrategia: `Bola de nieve: pagar primero la deuda más pequeña ($${formatCOP(ordenadas[0].monto)}). Una vez liquidada, esa cuota se redirige a la siguiente. Estimado: ${mesAcumulado} meses para libertad de deuda.`
  };
}

function estimarMesesPago(saldo, tasaMensual, cuota) {
  if (cuota <= 0 || saldo <= 0) return 0;
  if (tasaMensual === 0) return Math.ceil(saldo / cuota);
  if (cuota <= saldo * tasaMensual) return 999;
  const meses = -Math.log(1 - (saldo * tasaMensual) / cuota) / Math.log(1 + tasaMensual);
  return Math.ceil(meses);
}

function projectPortfolio(allocation, profile, years) {
  const baseRate = RETORNO_ESPERADO[profile] || 0.10;
  const escenarios = [
    { nombre: 'Conservador', factor: 0.6, rate: baseRate * 0.6 },
    { nombre: 'Base',        factor: 1.0, rate: baseRate },
    { nombre: 'Optimista',   factor: 1.4, rate: baseRate * 1.4 }
  ];

  const capital = allocation.capitalInvertible;
  const horizonteAnios = Array.isArray(years) ? years : [1, 3, 5];

  return escenarios.map((esc) => ({
    escenario: esc.nombre,
    tasaAnual: esc.rate,
    proyecciones: horizonteAnios.map((y) => ({
      anios: y,
      valorFinal: capital * Math.pow(1 + esc.rate, y),
      ganancia: capital * (Math.pow(1 + esc.rate, y) - 1)
    }))
  }));
}

function recommendBroker(capital, profile, brokersBank) {
  const todos = [
    ...(brokersBank.internacional || []),
    ...(brokersBank.local_colombia || [])
  ];

  const candidatos = todos.filter((b) => {
    const aplicaPerfil = !b.recomendado_para || b.recomendado_para.includes(profile);
    const aplicaCapital = !b.capital_min_cop || capital >= b.capital_min_cop;
    return aplicaPerfil && aplicaCapital;
  });

  const principal = candidatos.find((b) => b.nombre === 'XTB') || candidatos[0] || todos[0];
  const local = (brokersBank.local_colombia || []).find((b) => capital >= (b.capital_min_cop || 0));

  return {
    principal,
    complementoLocal: local && local.nombre !== (principal && principal.nombre) ? local : null,
    cripto: (brokersBank.cripto || [])[0] || null
  };
}

function calcDefiStrategy(experiencia, esCCI, montoAlternativos, etfBank) {
  const exp = (experiencia || 'ninguna').toLowerCase();
  const alt = etfBank.alternativos || {};

  if (exp === 'ninguna') {
    return {
      tier: 0,
      titulo: 'Tier 0 — Sin DeFi',
      contenido: 'Tu exposición alternativa va a oro (GLD/IAU) y REITs (VNQ). DeFi requiere experiencia previa.',
      instrumentos: alt.no_defi || [],
      cta: '¿Te gustaría aprender DeFi? Avanza a Tier 1 cuando tengas wallet propia y operes en Bitso.'
    };
  }

  if (exp === 'basica' || exp === 'básica') {
    return {
      tier: 1,
      titulo: 'Tier 1 — Educación DeFi',
      contenido: 'Aún no inviertes en DeFi. Primero entiendes los protocolos.',
      instrumentos: alt.tier1_educacion || [],
      noDefi: alt.no_defi || [],
      cta: '¿Quieres empezar a invertir en DeFi? Activa CCI Básico (Tier 2) o CCI Full (Tier 3) con Julián.',
      montoSugerido: montoAlternativos
    };
  }

  if (exp === 'intermedia' && !esCCI) {
    return {
      tier: 2,
      titulo: 'Tier 2 — CCI Básico (Aave + Uniswap V3)',
      contenido: 'Tienes experiencia DeFi. Recomendamos CCI Básico: estrategia conservadora con LTV ≤ 50%.',
      instrumentos: alt.tier2_cci_basico || [],
      cta: 'Para implementar CCI Básico, agenda sesión de setup con Julián (incluida en el producto).',
      requiereSetup: true,
      montoSugerido: montoAlternativos
    };
  }

  return {
    tier: 3,
    titulo: 'Tier 3 — CCI Full (Aave Leverage + LP Stack)',
    contenido: 'Eres cliente CCI. Estrategia full: leverage controlado + LP concentrado + rebalanceo semanal.',
    instrumentos: alt.tier3_cci || [],
    cta: 'Continúa bajo Contrato de Mandato de Inversión. Monitoreo activo por Julián.',
    montoSugerido: montoAlternativos
  };
}

function calcAaveLeverage(capital, ltv, supplyAPY, borrowAPY, lpAPY) {
  const ltvSafe = Math.min(Math.max(ltv || 0.7, 0), 0.8);
  const supply = supplyAPY != null ? supplyAPY : 0.04;
  const borrow = borrowAPY != null ? borrowAPY : 0.06;
  const lp = lpAPY != null ? lpAPY : 0.40;

  const colateral = capital;
  const prestado = capital * ltvSafe;
  const expuestoLP = prestado;

  const ingresoSupply = colateral * supply;
  const costoBorrow = prestado * borrow;
  const ingresoLP = expuestoLP * lp;

  const netoAnual = ingresoSupply + ingresoLP - costoBorrow;
  const netoAPY = capital > 0 ? netoAnual / capital : 0;
  const healthFactor = ltvSafe > 0 ? 0.825 / ltvSafe : 99;

  return {
    colateral,
    prestado,
    expuestoLP,
    ltv: ltvSafe,
    healthFactor,
    supplyAPY: supply,
    borrowAPY: borrow,
    lpAPY: lp,
    netoAnual,
    netoAPY
  };
}

function projectDefiReturns(capital, tier, years) {
  const horizonte = years || 1;
  let escenarios;

  if (tier <= 1) {
    return null;
  } else if (tier === 2) {
    escenarios = [
      { nombre: 'Pesimista (IL > fees)', rate: 0.05 },
      { nombre: 'Base',                  rate: 0.30 },
      { nombre: 'Optimista (alto vol)',  rate: 0.50 }
    ];
  } else {
    escenarios = [
      { nombre: 'Pesimista (rebalanceo costoso)', rate: 0.10 },
      { nombre: 'Base (gestión activa)',          rate: 0.40 },
      { nombre: 'Optimista (alto vol + leverage)', rate: 0.75 }
    ];
  }

  return escenarios.map((esc) => ({
    escenario: esc.nombre,
    apy: esc.rate,
    valorFinal: capital * Math.pow(1 + esc.rate, horizonte),
    gananciaAnual: capital * esc.rate
  }));
}

function gapAnalysis(allocation, profile, monthlyObjective) {
  const baseRate = RETORNO_ESPERADO[profile] || 0.10;
  const flujoMensualEsperado = (allocation.capitalInvertible * baseRate) / 12;
  const objetivo = monthlyObjective || 0;
  const brecha = objetivo - flujoMensualEsperado;
  const capitalRequerido = objetivo > 0 ? (objetivo * 12) / baseRate : 0;

  return {
    flujoMensualEsperado,
    objetivoMensual: objetivo,
    brecha,
    capitalRequerido,
    capitalActual: allocation.capitalInvertible,
    deficitCapital: Math.max(0, capitalRequerido - allocation.capitalInvertible),
    objetivoAlcanzado: brecha <= 0
  };
}

function formatCOP(value) {
  if (value == null || isNaN(value)) return '$0';
  return '$' + Math.round(value).toLocaleString('es-CO');
}

function formatPct(value, digits) {
  const d = digits != null ? digits : 1;
  return (value * 100).toFixed(d) + '%';
}

function formatDate(date) {
  const d = date || new Date();
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

const CastleEngine = {
  determineProfile,
  getArcaAllocation,
  calculatePortfolioAllocation,
  selectETFs,
  debtStrategy,
  projectPortfolio,
  recommendBroker,
  calcDefiStrategy,
  calcAaveLeverage,
  projectDefiReturns,
  gapAnalysis,
  formatCOP,
  formatPct,
  formatDate,
  ARCA_ALLOCATION,
  RETORNO_ESPERADO
};

if (typeof window !== 'undefined') {
  window.CastleEngine = CastleEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CastleEngine;
}
