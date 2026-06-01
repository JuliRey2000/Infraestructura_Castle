'use strict';

const ARCA_ALLOCATION = {
  conservador: { acciones: 0.10, rentaFija: 0.55, caja: 0.30, alternativos: 0.05 },
  moderado:    { acciones: 0.55, rentaFija: 0.25, caja: 0.10, alternativos: 0.10 },
  agresivo:    { acciones: 0.35, rentaFija: 0.15, caja: 0.15, alternativos: 0.35 }
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

function calculatePortfolioAllocation(capital, profile, hasEmergencyFund, monthlyExpenses, monthlyIncome, monthlyContribution, useFlujoLibre, hasDebts) {
  const allocation = getArcaAllocation(profile);
  const emergencyFund = hasEmergencyFund ? 0 : Math.max(0, monthlyExpenses * FONDO_EMERGENCIA_MESES);

  const flujoLibreMensual = Math.max(0, (monthlyIncome || 0) - (monthlyExpenses || 0));
  const aporteMensual = Math.max(0, monthlyContribution || 0);

  // Si el cliente decide usar SOLO el aporte adicional (no todo el flujo libre),
  // el aporte mensual real para invertir es solamente lo que ingresó como objetivo.
  // Si decide usar todo el flujo libre, sumamos ambos.
  const usarFlujoLibre = useFlujoLibre !== false; // default true (compat)
  const aporteMensualReal = usarFlujoLibre
    ? Math.max(flujoLibreMensual, aporteMensual)
    : aporteMensual;

  // Tabla de capital invertible inicial. Refleja prioridades reales del cliente:
  // si hay deudas, parte del capital ataca deudas; si no hay fondo, parte va a fondo.
  // | Fondo | Deudas | Factor |
  // | No    | Sí     | 25%    |
  // | Sí    | Sí     | 50%    |
  // | No    | No     | 75%    |
  // | Sí    | No     | 100%   |
  let factorInvertible;
  if (hasEmergencyFund && !hasDebts) factorInvertible = 1.00;
  else if (hasEmergencyFund && hasDebts) factorInvertible = 0.50;
  else if (!hasEmergencyFund && !hasDebts) factorInvertible = 0.75;
  else factorInvertible = 0.25;

  const capitalInvertibleInicial = capital * factorInvertible;
  // Capital disponible total = lump sum inmediato (NO incluir flujo libre que es recurrente).
  // Se usa como base para el choque inicial del 50% en la bola de nieve.
  const capitalDisponibleTotal = capital;

  return {
    capitalTotal: capital,
    fondoEmergencia: emergencyFund,
    flujoLibreMensual,
    aporteMensual,
    aporteMensualReal,
    usarFlujoLibre,
    hasDebts: !!hasDebts,
    factorInvertible,
    capitalDisponibleTotal,
    capitalInvertible: capitalInvertibleInicial,
    perfil: profile,
    porcentajes: allocation,
    montos: {
      acciones: capitalInvertibleInicial * allocation.acciones,
      rentaFija: capitalInvertibleInicial * allocation.rentaFija,
      caja: capitalInvertibleInicial * allocation.caja,
      alternativos: capitalInvertibleInicial * allocation.alternativos
    }
  };
}

function selectETFs(profile, etfBank) {
  const acciones = (etfBank.acciones && etfBank.acciones[profile]) || [];
  const rentaFija = etfBank.rentaFija || [];
  const caja = etfBank.caja || [];
  return { acciones, rentaFija, caja };
}

function debtStrategy(debts, monthlyIncome, monthlyExpenses, monthlyObjective, capitalDisponibleTotal) {
  if (!Array.isArray(debts) || debts.length === 0) {
    return {
      hayDeudas: false,
      ordenadas: [],
      flujoDisponible: Math.max(0, monthlyIncome - monthlyExpenses),
      mensajeEstrategia: 'Sin deudas registradas. Capital disponible va directo a inversión.'
    };
  }

  // Bola de nieve: ordenar por la cuota mensual más pequeña primero.
  // El objetivo no es la matemática óptima sino el momentum psicológico:
  // abonarle a la deuda con la cuota mínima más baja libera ese flujo rápido
  // y da una primera victoria que sostiene el hábito.
  const ordenadas = [...debts]
    .filter((d) => d && d.monto > 0)
    .sort((a, b) => (a.cuotaMinima || 0) - (b.cuotaMinima || 0));

  const totalCuotaMinima = ordenadas.reduce((acc, d) => acc + (d.cuotaMinima || 0), 0);
  const aporteMensual = Math.max(0, monthlyObjective || 0);

  // PASO 0 - Choque inicial = 50% del capital total disponible
  const capDispTotal = Math.max(0, capitalDisponibleTotal || 0);
  const choqueInicial = capDispTotal * 0.50;

  // PASO 1 - Aplicar choque a deudas ordenadas (menor cuota → mayor)
  // hasta agotar el capital inicial. Marcar deudas saldadas/parciales.
  let choqueRestante = choqueInicial;
  const deudasPostChoque = ordenadas.map((deuda) => {
    const monto = deuda.monto || 0;
    let pagoInicial = 0;
    if (choqueRestante > 0) {
      pagoInicial = Math.min(choqueRestante, monto);
      choqueRestante -= pagoInicial;
    }
    const saldoPostChoque = Math.max(0, monto - pagoInicial);
    return {
      nombre: deuda.nombre,
      monto,
      tasa: deuda.tasa,
      cuotaMinima: deuda.cuotaMinima || 0,
      pagoInicial,
      saldoPostChoque,
      saldada: saldoPostChoque === 0
    };
  });

  // PASO 2 - Simular meses sobre las deudas restantes.
  // Cuota efectiva de la deuda activa =
  //   cuotaMinima_actual
  //   + Σ cuotas_minimas_liberadas (deudas ya saldadas)
  //   + 50% del aporte mensual.
  // Al saldar la deuda activa, su cuota mínima pasa al pool de "liberadas".
  const ataqueExtraMensual = aporteMensual * 0.50;
  const cuotasLiberadasIniciales = deudasPostChoque
    .filter((d) => d.saldada)
    .reduce((acc, d) => acc + d.cuotaMinima, 0);

  let cuotasLiberadasPool = cuotasLiberadasIniciales;
  let mesAcumulado = 0;
  const cronograma = deudasPostChoque.map((deuda) => {
    if (deuda.saldada) {
      // Esta deuda quedó saldada con el choque inicial.
      return {
        nombre: deuda.nombre,
        monto: deuda.monto,
        tasa: deuda.tasa,
        cuotaMinima: deuda.cuotaMinima,
        pagoInicial: deuda.pagoInicial,
        saldoPostChoque: 0,
        saldada: true,
        cuotaConSnowball: 0,
        mesesRestantes: 0,
        mesPagoFinal: mesAcumulado
      };
    }
    const tasaMensual = (deuda.tasa || 0) / 100 / 12;
    const cuotaEfectiva = deuda.cuotaMinima + cuotasLiberadasPool + ataqueExtraMensual;
    const meses = estimarMesesPago(deuda.saldoPostChoque, tasaMensual, cuotaEfectiva);
    mesAcumulado += meses;
    cuotasLiberadasPool += deuda.cuotaMinima;
    return {
      nombre: deuda.nombre,
      monto: deuda.monto,
      tasa: deuda.tasa,
      cuotaMinima: deuda.cuotaMinima,
      pagoInicial: deuda.pagoInicial,
      saldoPostChoque: deuda.saldoPostChoque,
      saldada: false,
      cuotaConSnowball: cuotaEfectiva,
      mesesRestantes: meses,
      mesPagoFinal: mesAcumulado
    };
  });

  const saldoTotal = ordenadas.reduce((acc, d) => acc + (d.monto || 0), 0);
  const primera = ordenadas[0];
  const deudasSaldadasChoque = deudasPostChoque.filter((d) => d.saldada);

  return {
    hayDeudas: true,
    ordenadas: cronograma,
    deudasPostChoque,
    cuotaMinimaTotal: totalCuotaMinima,
    choqueInicial,
    choqueAplicado: choqueInicial - choqueRestante,
    choqueRemanente: choqueRestante,
    deudasSaldadasChoque,
    ataqueExtraMensual,
    flujoLibreParaAtaque: ataqueExtraMensual,
    mesesParaLibertad: mesAcumulado,
    saldoTotal,
    primeraDeuda: primera ? primera.nombre : null,
    mensajeEstrategia: `Bola de nieve con choque inicial: aplicamos ${formatCOP(choqueInicial)} (50% de tu capital disponible) a las deudas con la cuota mínima más baja, saldándolas o reduciéndolas drásticamente. Luego, mes a mes, atacamos las deudas restantes sumando todas las cuotas liberadas más el 50% de tu aporte mensual. Estimado: ${mesAcumulado} meses para libertad de deuda.`,
    mensajeHabito: 'En paralelo a la bola de nieve, sugerimos empezar a invertir un monto pequeño aunque sea simbólico. La meta no es el retorno todavía, es construir el hábito de mover capital al sistema cada mes.'
  };
}

function estimarMesesPago(saldo, tasaMensual, cuota) {
  if (cuota <= 0 || saldo <= 0) return 0;
  if (tasaMensual === 0) return Math.ceil(saldo / cuota);
  if (cuota <= saldo * tasaMensual) return 999;
  const meses = -Math.log(1 - (saldo * tasaMensual) / cuota) / Math.log(1 + tasaMensual);
  return Math.ceil(meses);
}

function projectPortfolio(allocation, profile, years, aporteMensual) {
  const baseRate = RETORNO_ESPERADO[profile] || 0.10;
  const escenarios = [
    { nombre: 'Conservador', factor: 0.6, rate: baseRate * 0.6 },
    { nombre: 'Base',        factor: 1.0, rate: baseRate },
    { nombre: 'Optimista',   factor: 1.4, rate: baseRate * 1.4 }
  ];

  const capital = allocation.capitalInvertible;
  const horizonteAnios = Array.isArray(years) ? years : [1, 3, 5];
  const aporte = Math.max(0, aporteMensual || 0);

  return escenarios.map((esc) => {
    const tasaMensual = Math.pow(1 + esc.rate, 1 / 12) - 1;
    return {
      escenario: esc.nombre,
      tasaAnual: esc.rate,
      proyecciones: horizonteAnios.map((y) => {
        if (aporte <= 0) {
          const valorFinal = capital * Math.pow(1 + esc.rate, y);
          return {
            anios: y,
            valorFinal,
            ganancia: valorFinal - capital
          };
        }
        // Simulación mensual con aporte recurrente (DCA real)
        const totalMeses = y * 12;
        let valor = capital;
        for (let m = 1; m <= totalMeses; m++) {
          valor = valor * (1 + tasaMensual) + aporte;
        }
        const aportado = aporte * totalMeses;
        return {
          anios: y,
          valorFinal: valor,
          ganancia: valor - capital - aportado
        };
      })
    };
  });
}

// Genera puntos mensuales para gráfica de línea, con o sin aporte mensual recurrente.
// Si aporteMensual > 0, simula DCA: cada mes se suma el aporte y se capitaliza.
// Si aporteMensual = 0, es solo capitalización compuesta del capital inicial.
function projectPortfolioMonthly(capitalInicial, profile, years, aporteMensual) {
  const baseRate = RETORNO_ESPERADO[profile] || 0.10;
  const escenarios = [
    { nombre: 'Conservador', rate: baseRate * 0.6 },
    { nombre: 'Base',        rate: baseRate },
    { nombre: 'Optimista',   rate: baseRate * 1.4 }
  ];

  const totalMeses = (years || 5) * 12;
  const aporte = Math.max(0, aporteMensual || 0);

  // Resolución adaptativa: para horizontes largos guardamos cada 3 meses para no saturar la curva,
  // para horizontes cortos guardamos cada mes para mayor fidelidad en el hover.
  const stride = totalMeses > 120 ? 3 : 1;

  return escenarios.map((esc) => {
    const tasaMensual = Math.pow(1 + esc.rate, 1 / 12) - 1;
    const puntos = [];
    let valor = capitalInicial;
    puntos.push({ mes: 0, anio: 0, valor });
    for (let m = 1; m <= totalMeses; m++) {
      valor = valor * (1 + tasaMensual) + aporte;
      if (m % stride === 0 || m === totalMeses) {
        puntos.push({ mes: m, anio: m / 12, valor });
      }
    }
    return {
      escenario: esc.nombre,
      tasaAnual: esc.rate,
      puntos
    };
  });
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
      titulo: 'Tier 0. Sin DeFi',
      contenido: 'Tu exposición alternativa va a oro (GLD/IAU) y compra directa de cripto en Binance (BTC, ETH, XRP). DeFi requiere experiencia previa.',
      instrumentos: alt.no_defi || [],
      noDefi: alt.no_defi || [],
      cta: '¿Te gustaría aprender DeFi? Avanza a Tier 1 cuando tengas wallet propia y operes en Binance.'
    };
  }

  if (exp === 'basica' || exp === 'básica') {
    return {
      tier: 1,
      titulo: 'Tier 1. Educación DeFi',
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
      titulo: 'Tier 2. CCI Básico (solo Uniswap V3)',
      contenido: 'Tienes experiencia DeFi. Recomendamos CCI Básico: solo Uniswap V3 con LTV ≤ 50%, sin leverage.',
      instrumentos: alt.tier2_cci_basico || [],
      cta: 'Para implementar CCI Básico, agenda sesión de setup con Julián (incluida en el producto).',
      requiereSetup: true,
      montoSugerido: montoAlternativos
    };
  }

  return {
    tier: 3,
    titulo: 'Tier 3. CCI Full (Aave Leverage y LP Stack)',
    contenido: 'Eres cliente CCI. Estrategia full: leverage controlado + LP concentrado + rebalanceo semanal.',
    instrumentos: alt.tier3_cci || [],
    cta: 'Continúa con la gestión activa de Castle. Monitoreo y operación por Julián.',
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

function projectDefiReturns(capital, tier, years, aporteMensualAlt) {
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

  const aporte = Math.max(0, aporteMensualAlt || 0);

  return escenarios.map((esc) => {
    if (aporte <= 0) {
      return {
        escenario: esc.nombre,
        apy: esc.rate,
        valorFinal: capital * Math.pow(1 + esc.rate, horizonte),
        gananciaAnual: capital * esc.rate
      };
    }
    const totalMeses = horizonte * 12;
    const tasaMensual = Math.pow(1 + esc.rate, 1 / 12) - 1;
    let valor = capital;
    for (let m = 1; m <= totalMeses; m++) {
      valor = valor * (1 + tasaMensual) + aporte;
    }
    const aportado = aporte * totalMeses;
    return {
      escenario: esc.nombre,
      apy: esc.rate,
      valorFinal: valor,
      gananciaAnual: valor - capital - aportado
    };
  });
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

// Convierte un capital exacto (COP) al rango enumerado que persiste en DB.
// Castle Capital Security Standards: no guardamos montos exactos del cliente.
// Los rangos deben coincidir EXACTAMENTE con el CHECK constraint de
// supabase-migration-003-capital-range.sql.
function capitalToRange(value) {
  const v = Number(value);
  if (!isFinite(v) || v < 0) return null;
  if (v < 5000000)          return '<5M';
  if (v < 20000000)         return '5M-20M';
  if (v < 50000000)         return '20M-50M';
  if (v < 200000000)        return '50M-200M';
  if (v < 1000000000)       return '200M-1B';
  return '>1B';
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
  projectPortfolioMonthly,
  recommendBroker,
  calcDefiStrategy,
  calcAaveLeverage,
  projectDefiReturns,
  gapAnalysis,
  formatCOP,
  formatPct,
  formatDate,
  capitalToRange,
  ARCA_ALLOCATION,
  RETORNO_ESPERADO
};

if (typeof window !== 'undefined') {
  window.CastleEngine = CastleEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CastleEngine;
}
