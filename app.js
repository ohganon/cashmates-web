/* =========================================================================
   CashMates · app.js  (demo de la one page · Sprint 3)

   Índice:
     1. Configuración y datos de ejemplo
     2. Guardar y cargar (localStorage)
     3. Utilidades
     4. Grupos (piso, pareja, viaje) y botón "Cargar ejemplo"
     5. Formulario: campos que crea el JS
     6. Añadir un pago
     7. Cálculos: balances y "quién debe a quién"
     8. Resumen ("Has gastado", gráfico y tu saldo)
     9. Quién debe a quién + botón "Saldar"
    10. Avisos: morosos, pagos urgentes y notificaciones
    11. Gastos programados (recurrentes)
    12. Meta de ahorro común
    13. Historial con filtro por etiqueta
    14. Repintar todo
    15. Vídeo, animaciones y cabecera (lo de la web)
    16. Arranque

   Cómo se calcula el dinero:
   - Balance de cada persona = lo que ha pagado por el grupo - su parte.
       positivo -> el grupo le debe dinero
       negativo -> debe dinero al grupo
   - "Quién debe a quién": se empareja a quien debe con quien tiene que
     cobrar, de mayor a menor, hasta que todo queda a 0.
   - Saldar una deuda apunta un pago "por Bizum" de una persona a otra.
   - Moroso: quien debe en total DEUDA_GRANDE € o más.
   - Urgente: si un pago se marca como urgente, se insiste a quienes
     tienen que pagarlo hasta que dejan de deber.

   CashMates no mueve dinero: aquí solo se apuntan gastos.
   ========================================================================= */


/* ---------- 1. Configuración y datos de ejemplo ---------- */

const YO = 'Tú';
const CLAVE_GUARDADO = 'cashmates-datos';
const DEUDA_GRANDE = 50;            // € a partir de los que alguien es "moroso"
const INSISTIR_CADA_SEGUNDOS = 30;  // cada cuánto se recuerda una deuda urgente
const ETIQUETAS = ['Casa', 'Comida', 'Ocio', 'Transporte', 'Suscripciones', 'Otros'];

// Datos vacíos: tres grupos sin pagos
function datosVacios() {
  return {
    grupoActivo: 'piso',
    grupos: {
      piso:   crearGrupo('Piso de la calle Olmo', [YO, 'Lucía', 'Pablo', 'Marta']),
      pareja: crearGrupo('Pareja', [YO, 'Alex']),
      viaje:  crearGrupo('Viaje a Lisboa', [YO, 'Lucía', 'Dani'])
    }
  };
}

function crearGrupo(nombre, miembros) {
  return {
    nombre: nombre,
    miembros: miembros,
    pagos: [],         // gastos, pagos personales y deudas saldadas
    recurrentes: [],   // gastos que se repiten cada mes
    meta: null         // { nombre, objetivo, aportaciones: [{ quien, importe }] }
  };
}

// Datos de ejemplo para la demo: el piso de José (que en la web es "Tú")
function datosEjemplo() {
  const datos = datosVacios();
  const piso = datos.grupos.piso;
  const todos = piso.miembros;

  piso.pagos = [
    nuevoPago('grupal', 60, 'Compra del Mercadona', 'Comida', YO, todos, false),
    nuevoPago('grupal', 80, 'Luz de noviembre', 'Casa', 'Lucía', todos, false),
    nuevoPago('grupal', 40, 'Wifi', 'Suscripciones', YO, todos, false),
    nuevoPago('grupal', 40, 'Limpieza de la escalera', 'Casa', YO, todos, true),
    nuevoPago('grupal', 12, 'Papel y detergente', 'Casa', 'Marta', todos, false),
    nuevoPago('personal', 9, 'Cine', 'Ocio', YO, [], false)
  ];

  piso.recurrentes = [
    { id: 1, importe: 40, concepto: 'Wifi', etiqueta: 'Suscripciones',
      pagador: YO, reparto: todos, dia: new Date().getDate(), ultimoMes: mesActual() }
  ];

  piso.meta = {
    nombre: 'Sofá nuevo para el salón',
    objetivo: 300,
    aportaciones: [
      { quien: YO, importe: 50 },
      { quien: 'Lucía', importe: 40 },
      { quien: 'Marta', importe: 30 }
    ]
  };

  datos.grupos.pareja.pagos = [
    nuevoPago('grupal', 50, 'Cena de aniversario', 'Ocio', 'Alex', [YO, 'Alex'], false)
  ];
  datos.grupos.viaje.pagos = [
    nuevoPago('grupal', 240, 'Apartamento', 'Casa', 'Lucía', [YO, 'Lucía', 'Dani'], false)
  ];

  return datos;
}

// Crea un objeto pago. "pendientesUrgente" son las personas a las que
// hay que insistir (todas las del reparto menos quien pagó).
let contadorIds = Date.now();
function nuevoPago(tipo, importe, concepto, etiqueta, pagador, reparto, urgente) {
  contadorIds++;
  return {
    id: contadorIds,
    tipo: tipo,                 // 'grupal', 'personal' o 'saldado'
    importe: importe,
    concepto: concepto,
    etiqueta: etiqueta,
    pagador: pagador,
    reparto: reparto,
    pendientesUrgente: urgente
      ? reparto.filter(function (nombre) { return nombre !== pagador; })
      : []
  };
}


/* ---------- 2. Guardar y cargar ---------- */

// localStorage solo guarda texto: convertimos los datos a JSON y al revés.
// Va dentro de try/catch porque en modo incógnito puede fallar.
function guardarDatos() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
  } catch (error) {
    // Si no se puede guardar, la demo sigue funcionando igual
  }
}

function cargarDatos() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    if (guardado && guardado.grupos && guardado.grupos[guardado.grupoActivo]) {
      return guardado;
    }
  } catch (error) {
    // datos rotos o sin permiso: empezamos de cero
  }
  return datosVacios();
}

let datos = cargarDatos();

// El grupo que se está viendo ahora mismo
function grupo() {
  return datos.grupos[datos.grupoActivo];
}


/* ---------- 3. Utilidades ---------- */

// 1234.5 -> "1234,50 €"
function euros(cantidad) {
  return cantidad.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// Redondea a céntimos: 10.005 -> 10.01
function redondear(cantidad) {
  return Math.round(cantidad * 100) / 100;
}

// "2026-11"
function mesActual() {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
}

// Crea un elemento HTML con su clase y su texto en una sola línea
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// Crea un <select> con una opción por cada texto de la lista
function crearSelect(id, opciones) {
  const select = crear('select');
  if (id) select.id = id;
  opciones.forEach(function (texto) {
    const opcion = crear('option', '', texto);
    opcion.value = texto;
    select.appendChild(opcion);
  });
  return select;
}

// "Tú" necesita otras palabras: "te debe", "debes"...
function quien(nombre) {
  return nombre === YO ? 'tú' : nombre;
}

// Mensaje flotante abajo a la derecha que desaparece solo
function mostrarMensaje(texto) {
  let zona = document.getElementById('mensajes');
  if (!zona) {
    zona = crear('div');
    zona.id = 'mensajes';
    zona.setAttribute('aria-live', 'polite');
    zona.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;' +
      'display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 32px));';
    document.body.appendChild(zona);
  }
  const mensaje = crear('p', 'mensaje', texto);
  mensaje.style.cssText = 'margin:0;padding:12px 16px;border-radius:12px;' +
    'background:#0F3D35;color:#FFFFFF;box-shadow:0 6px 20px rgba(0,0,0,.2);';
  zona.appendChild(mensaje);
  setTimeout(function () { mensaje.remove(); }, 4500);
}

// Muestra un aviso del navegador junto al campo que está mal
function mostrarError(campo, mensaje) {
  campo.setCustomValidity(mensaje);
  campo.reportValidity();
  campo.addEventListener('input', function () { campo.setCustomValidity(''); }, { once: true });
  campo.addEventListener('change', function () { campo.setCustomValidity(''); }, { once: true });
}


/* ---------- Elementos que ya están en el HTML ---------- */

const seccionDemo = document.getElementById('demo');
const form = document.getElementById('form-pago');
const inputImporte = document.getElementById('pago-importe');
const inputConcepto = document.getElementById('pago-concepto');
const bloqueReparto = document.getElementById('bloque-reparto');
const listaMiembros = document.getElementById('lista-miembros');
const botonAnadir = document.getElementById('boton-anadir');


/* ---------- 4. Grupos y "Cargar ejemplo" ---------- */

// Barra arriba del formulario: elegir grupo + cargar datos de ejemplo
function crearBarraGrupo() {
  const barra = crear('div');
  barra.id = 'barra-grupo';

  const label = crear('label', '', 'Grupo');
  label.htmlFor = 'selector-grupo';

  const select = crear('select');
  select.id = 'selector-grupo';
  Object.keys(datos.grupos).forEach(function (clave) {
    const opcion = crear('option', '', datos.grupos[clave].nombre);
    opcion.value = clave;
    select.appendChild(opcion);
  });

  const botonEjemplo = crear('button', 'boton boton-pequeno boton-secundario', 'Cargar ejemplo');
  botonEjemplo.type = 'button';
  botonEjemplo.id = 'cargar-ejemplo';

  barra.appendChild(label);
  barra.appendChild(select);
  barra.appendChild(botonEjemplo);
  form.prepend(barra);

  select.addEventListener('change', function () {
    datos.grupoActivo = select.value;
    rellenarMiembros();
    actualizarTodo();
  });

  botonEjemplo.addEventListener('click', function () {
    const hayDatos = Object.values(datos.grupos).some(function (g) { return g.pagos.length > 0; });
    if (hayDatos && !confirm('Se borrarán los pagos que has apuntado. ¿Cargar el ejemplo?')) return;
    datos = datosEjemplo();
    select.value = datos.grupoActivo;
    rellenarMiembros();
    actualizarTodo();
    mostrarMensaje('Ejemplo cargado: el piso de la calle Olmo.');
  });
}


/* ---------- 5. Formulario: campos que crea el JS ---------- */

function crearCamposFormulario() {
  // Etiqueta del pago, después del concepto
  const labelEtiqueta = crear('label', '', 'Etiqueta');
  labelEtiqueta.htmlFor = 'pago-etiqueta';
  const selectEtiqueta = crearSelect('pago-etiqueta', ETIQUETAS);

  // ¿Quién ha pagado?
  const campoPagador = crear('div');
  campoPagador.id = 'campo-pagador';
  const labelPagador = crear('label', '', '¿Quién ha pagado?');
  labelPagador.htmlFor = 'pago-pagador';
  const selectPagador = crear('select');
  selectPagador.id = 'pago-pagador';
  campoPagador.appendChild(labelPagador);
  campoPagador.appendChild(selectPagador);

  form.insertBefore(labelEtiqueta, bloqueReparto);
  form.insertBefore(selectEtiqueta, bloqueReparto);
  form.insertBefore(campoPagador, bloqueReparto);

  // Casillas "Urgente" y "Repetir cada mes", antes del botón
  const opciones = crear('div');
  opciones.id = 'opciones-pago';
  opciones.innerHTML =
    '<label id="opcion-urgente"><input type="checkbox" id="pago-urgente"> Urgente: insistir hasta que lo paguen</label>' +
    '<label id="opcion-repetir"><input type="checkbox" id="pago-repetir"> Repetir cada mes</label>';
  form.insertBefore(opciones, botonAnadir);
}

// Rellena "¿Quién ha pagado?" y "Se reparte entre" con la gente del grupo
function rellenarMiembros() {
  const selectPagador = document.getElementById('pago-pagador');
  selectPagador.innerHTML = '';
  listaMiembros.innerHTML = '';

  grupo().miembros.forEach(function (nombre) {
    const opcion = crear('option', '', nombre);
    opcion.value = nombre;
    selectPagador.appendChild(opcion);

    const label = crear('label', 'miembro');
    const casilla = crear('input');
    casilla.type = 'checkbox';
    casilla.name = 'reparto';
    casilla.value = nombre;
    casilla.checked = true;
    label.appendChild(casilla);
    label.appendChild(document.createTextNode(' '));
    label.appendChild(crear('span', '', nombre));
    listaMiembros.appendChild(label);
  });
}

function tipoElegido() {
  return form.querySelector('input[name="tipo"]:checked').value; // 'grupal' o 'personal'
}

// En un pago personal no hay pagador, ni reparto, ni urgencia
function actualizarTipo() {
  const esGrupal = tipoElegido() === 'grupal';
  bloqueReparto.hidden = !esGrupal;
  document.getElementById('campo-pagador').hidden = !esGrupal;
  document.getElementById('opcion-urgente').hidden = !esGrupal;
}


/* ---------- 6. Añadir un pago ---------- */

function alEnviarFormulario(evento) {
  evento.preventDefault(); // que no se recargue la página

  const importe = Number(String(inputImporte.value).replace(',', '.'));
  const concepto = inputConcepto.value.trim();
  const etiqueta = document.getElementById('pago-etiqueta').value;
  const tipo = tipoElegido();
  const urgente = document.getElementById('pago-urgente').checked;
  const repetir = document.getElementById('pago-repetir').checked;

  if (!(importe > 0)) {
    mostrarError(inputImporte, 'Escribe cuánto se ha pagado, por ejemplo 20,00.');
    return;
  }
  if (concepto === '') {
    mostrarError(inputConcepto, 'Pon un concepto, por ejemplo "Wifi" o "Compra".');
    return;
  }

  let pagador = YO;
  let reparto = [];

  if (tipo === 'grupal') {
    pagador = document.getElementById('pago-pagador').value;
    listaMiembros.querySelectorAll('input:checked').forEach(function (casilla) {
      reparto.push(casilla.value);
    });

    const primeraCasilla = listaMiembros.querySelector('input');
    if (reparto.length === 0) {
      mostrarError(primeraCasilla, 'Elige al menos una persona.');
      return;
    }
    if (reparto.length === 1 && reparto[0] === pagador) {
      mostrarError(primeraCasilla, 'Si solo es para quien ha pagado, no es un gasto del grupo.');
      return;
    }
  }

  const pago = nuevoPago(tipo, redondear(importe), concepto, etiqueta, pagador, reparto,
                         tipo === 'grupal' && urgente);
  grupo().pagos.push(pago);

  if (repetir) {
    grupo().recurrentes.push({
      id: pago.id,
      importe: pago.importe,
      concepto: concepto,
      etiqueta: etiqueta,
      pagador: pagador,
      reparto: reparto,
      tipo: tipo,
      dia: new Date().getDate(),  // se apuntará este día de cada mes
      ultimoMes: mesActual()      // este mes ya está apuntado
    });
  }

  actualizarTodo();
  avisarEnBoton();

  // Deja el formulario listo para el siguiente pago
  inputImporte.value = '';
  inputConcepto.value = '';
  document.getElementById('pago-urgente').checked = false;
  document.getElementById('pago-repetir').checked = false;
  listaMiembros.querySelectorAll('input').forEach(function (c) { c.checked = true; });
  inputImporte.focus();
}

// El botón dice "¡Pago añadido!" durante 1,5 segundos
function avisarEnBoton() {
  botonAnadir.textContent = '¡Pago añadido!';
  botonAnadir.classList.add('anadido');
  setTimeout(function () {
    botonAnadir.textContent = 'Añadir pago';
    botonAnadir.classList.remove('anadido');
  }, 1500);
}


/* ---------- 7. Cálculos ---------- */

// Devuelve { 'Tú': 82, 'Lucía': 22, 'Pablo': -58, 'Marta': -46 }
function calcularBalances(g) {
  const balances = {};
  g.miembros.forEach(function (nombre) { balances[nombre] = 0; });

  g.pagos.forEach(function (pago) {
    if (pago.tipo === 'grupal') {
      const parte = pago.importe / pago.reparto.length;
      balances[pago.pagador] += pago.importe;
      pago.reparto.forEach(function (nombre) { balances[nombre] -= parte; });
    }
    if (pago.tipo === 'saldado') {
      // pago.pagador le ha hecho un Bizum a pago.reparto[0]
      balances[pago.pagador] += pago.importe;
      balances[pago.reparto[0]] -= pago.importe;
    }
  });

  return balances;
}

// Convierte los balances en una lista de deudas:
// [{ de: 'Pablo', para: 'Tú', importe: 58 }, ...]
function calcularDeudas(balances) {
  const deben = [];    // balance negativo
  const cobran = [];   // balance positivo

  Object.keys(balances).forEach(function (nombre) {
    const balance = redondear(balances[nombre]);
    if (balance < 0) deben.push({ nombre: nombre, cantidad: -balance });
    if (balance > 0) cobran.push({ nombre: nombre, cantidad: balance });
  });

  // Primero las cantidades más grandes
  deben.sort(function (a, b) { return b.cantidad - a.cantidad; });
  cobran.sort(function (a, b) { return b.cantidad - a.cantidad; });

  const deudas = [];
  let i = 0;
  let j = 0;
  while (i < deben.length && j < cobran.length) {
    const cantidad = Math.min(deben[i].cantidad, cobran[j].cantidad);
    deudas.push({ de: deben[i].nombre, para: cobran[j].nombre, importe: redondear(cantidad) });

    deben[i].cantidad = redondear(deben[i].cantidad - cantidad);
    cobran[j].cantidad = redondear(cobran[j].cantidad - cantidad);
    if (deben[i].cantidad === 0) i++;
    if (cobran[j].cantidad === 0) j++;
  }
  return deudas;
}

// ¿Tiene esta persona algún pago urgente sin pagar?
function tieneUrgente(nombre) {
  return grupo().pagos.some(function (pago) {
    return pago.pendientesUrgente && pago.pendientesUrgente.includes(nombre);
  });
}

// Cuánto debe en total una persona (0 si no debe nada)
function totalQueDebe(nombre, balances) {
  return balances[nombre] < 0 ? redondear(-balances[nombre]) : 0;
}


/* ---------- 8. Resumen ---------- */

function pintarResumen() {
  let personal = 0;
  let miParte = 0;

  grupo().pagos.forEach(function (pago) {
    if (pago.tipo === 'personal') personal += pago.importe;
    if (pago.tipo === 'grupal' && pago.reparto.includes(YO)) {
      miParte += pago.importe / pago.reparto.length;
    }
  });

  const total = personal + miParte;
  const miBalance = redondear(calcularBalances(grupo())[YO]);

  document.getElementById('total-gastado').textContent = euros(total);
  document.getElementById('valor-personal').textContent = euros(personal);
  document.getElementById('valor-grupal').textContent = euros(miParte);

  const porcentajePersonal = total > 0 ? (personal / total) * 100 : 0;
  document.getElementById('tramo-personal').style.width = porcentajePersonal + '%';
  document.getElementById('tramo-grupal').style.width = (total > 0 ? 100 - porcentajePersonal : 0) + '%';

  const saldo = document.getElementById('saldo');
  const etiqueta = document.getElementById('saldo-etiqueta');
  const valor = document.getElementById('saldo-valor');

  if (miBalance > 0) {
    saldo.dataset.estado = 'positivo';
    etiqueta.textContent = 'Te debe el grupo';
    valor.textContent = euros(miBalance);
  } else if (miBalance < 0) {
    saldo.dataset.estado = 'negativo';
    etiqueta.textContent = 'Debes al grupo';
    valor.textContent = euros(-miBalance);
  } else {
    saldo.dataset.estado = 'cero';
    etiqueta.textContent = 'Estás en paz con el grupo';
    valor.textContent = euros(0);
  }
}


/* ---------- 9. Quién debe a quién + "Saldar" ---------- */

function crearTarjetaDeudas() {
  const tarjeta = crear('section', 'tarjeta');
  tarjeta.id = 'deudas';
  tarjeta.innerHTML =
    '<h3>Quién debe a quién</h3>' +
    '<p id="deudas-vacio">Nadie debe nada. ¡Cuentas claras!</p>' +
    '<ul id="lista-deudas"></ul>';
  seccionDemo.appendChild(tarjeta);

  // Un solo "escuchador" para todos los botones "Saldar"
  document.getElementById('lista-deudas').addEventListener('click', function (evento) {
    const boton = evento.target.closest('.boton-saldar');
    if (boton) saldarDeuda(boton.dataset.de, boton.dataset.para, Number(boton.dataset.importe));
  });
}

// "Pablo te debe 58,00 €" / "Debes 20,00 € a Lucía" / "Marta debe 22,00 € a Lucía"
function textoDeuda(deuda) {
  if (deuda.para === YO) return deuda.de + ' te debe ' + euros(deuda.importe);
  if (deuda.de === YO) return 'Debes ' + euros(deuda.importe) + ' a ' + deuda.para;
  return deuda.de + ' debe ' + euros(deuda.importe) + ' a ' + deuda.para;
}

function pintarDeudas() {
  const balances = calcularBalances(grupo());
  const deudas = calcularDeudas(balances);
  const lista = document.getElementById('lista-deudas');
  lista.innerHTML = '';

  deudas.forEach(function (deuda) {
    const li = crear('li', 'pago deuda');
    const texto = crear('span', '', textoDeuda(deuda));

    // Etiquetas de aviso al lado del nombre
    if (totalQueDebe(deuda.de, balances) >= DEUDA_GRANDE) {
      texto.appendChild(crear('strong', 'etiqueta-moroso', ' · Moroso'));
      li.classList.add('es-moroso');
    }
    if (tieneUrgente(deuda.de)) {
      texto.appendChild(crear('strong', 'etiqueta-urgente', ' · Urgente'));
      li.classList.add('es-urgente');
    }

    const boton = crear('button', 'boton-borrar boton-saldar', 'Saldar');
    boton.type = 'button';
    boton.dataset.de = deuda.de;
    boton.dataset.para = deuda.para;
    boton.dataset.importe = deuda.importe;
    boton.setAttribute('aria-label', 'Saldar: ' + textoDeuda(deuda));
    boton.style.color = '#0E7D71';

    li.appendChild(texto);
    li.appendChild(boton);
    lista.appendChild(li);
  });

  document.getElementById('deudas-vacio').hidden = deudas.length > 0;
}

// Apunta que "de" ha pagado su deuda a "para" (por Bizum, fuera de la app)
function saldarDeuda(de, para, importe) {
  const pago = nuevoPago('saldado', importe, 'Bizum', 'Otros', de, [para], false);
  grupo().pagos.push(pago);

  // Si ya no debe nada, se deja de insistirle con los pagos urgentes
  const balances = calcularBalances(grupo());
  if (totalQueDebe(de, balances) === 0) {
    grupo().pagos.forEach(function (p) {
      p.pendientesUrgente = (p.pendientesUrgente || []).filter(function (n) { return n !== de; });
    });
  }

  actualizarTodo();
  mostrarMensaje('Saldado: ' + de + ' → ' + para + ' (' + euros(importe) + ' por Bizum).');
}


/* ---------- 10. Avisos: morosos, urgentes y notificaciones ---------- */

function crearTarjetaAvisos() {
  const tarjeta = crear('section', 'tarjeta');
  tarjeta.id = 'avisos';
  tarjeta.innerHTML =
    '<h3>Avisos</h3>' +
    '<p id="avisos-vacio">No hay deudas grandes ni urgentes.</p>' +
    '<ul id="lista-avisos"></ul>' +
    '<button id="activar-notificaciones" class="boton boton-pequeno boton-secundario" type="button">' +
    'Activar notificaciones</button>';
  seccionDemo.appendChild(tarjeta);

  document.getElementById('lista-avisos').addEventListener('click', function (evento) {
    const boton = evento.target.closest('.boton-recordar');
    if (boton) recordar(boton.dataset.nombre);
  });

  document.getElementById('activar-notificaciones').addEventListener('click', function () {
    if (!('Notification' in window)) {
      mostrarMensaje('Este navegador no permite notificaciones; los avisos saldrán aquí.');
      return;
    }
    Notification.requestPermission().then(function (permiso) {
      mostrarMensaje(permiso === 'granted'
        ? 'Notificaciones activadas.'
        : 'Sin permiso: los avisos saldrán solo en la página.');
      pintarAvisos();
    });
  });
}

// Lista de personas a las que hay que avisar, con el motivo
function calcularAvisos() {
  const balances = calcularBalances(grupo());
  const avisos = [];

  grupo().miembros.forEach(function (nombre) {
    const debe = totalQueDebe(nombre, balances);
    if (debe === 0) return;

    const moroso = debe >= DEUDA_GRANDE;
    const urgente = tieneUrgente(nombre);
    if (moroso || urgente) {
      avisos.push({ nombre: nombre, debe: debe, moroso: moroso, urgente: urgente });
    }
  });
  return avisos;
}

// "Pablo debe 58,00 €: deuda grande." / "Marta debe 46,00 € y tiene un pago urgente."
function textoAviso(aviso) {
  const inicio = aviso.nombre === YO ? 'Debes ' : aviso.nombre + ' debe ';
  if (aviso.urgente) {
    return inicio + euros(aviso.debe) + (aviso.nombre === YO ? ' y tienes' : ' y tiene') + ' un pago urgente.';
  }
  return inicio + euros(aviso.debe) + ': deuda grande.';
}

function pintarAvisos() {
  const avisos = calcularAvisos();
  const lista = document.getElementById('lista-avisos');
  lista.innerHTML = '';

  avisos.forEach(function (aviso) {
    const li = crear('li', 'pago aviso');
    li.appendChild(crear('span', '', (aviso.urgente ? '🔔 ' : '⚠️ ') + textoAviso(aviso)));

    if (aviso.nombre !== YO) {
      const boton = crear('button', 'boton-borrar boton-recordar', 'Recordar');
      boton.type = 'button';
      boton.dataset.nombre = aviso.nombre;
      boton.style.color = '#0E7D71';
      li.appendChild(boton);
    }
    lista.appendChild(li);
  });

  document.getElementById('avisos-vacio').hidden = avisos.length > 0;

  // El botón de notificaciones solo sale si aún no se han activado
  const yaActivadas = 'Notification' in window && Notification.permission === 'granted';
  document.getElementById('activar-notificaciones').hidden = yaActivadas;
}

// Simula que se envía un recordatorio a esa persona
function recordar(nombre) {
  const debe = totalQueDebe(nombre, calcularBalances(grupo()));
  if (debe === 0) return;
  const texto = 'Recordatorio para ' + nombre + ': debe ' + euros(debe) + ' al grupo "' + grupo().nombre + '".';

  mostrarMensaje('🔔 ' + texto);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('CashMates', { body: texto, icon: 'assets/icono/favicon-32.png' });
  }
}

// Insistir: cada X segundos se recuerda a quien tiene pagos urgentes
function iniciarInsistencia() {
  setInterval(function () {
    calcularAvisos().forEach(function (aviso) {
      if (aviso.urgente && aviso.nombre !== YO) recordar(aviso.nombre);
    });
  }, INSISTIR_CADA_SEGUNDOS * 1000);
}


/* ---------- 11. Gastos programados (recurrentes) ---------- */

function crearTarjetaRecurrentes() {
  const tarjeta = crear('section', 'tarjeta');
  tarjeta.id = 'recurrentes';
  tarjeta.innerHTML =
    '<h3>Gastos programados</h3>' +
    '<p id="recurrentes-vacio">Marca "Repetir cada mes" al añadir un pago y se apuntará solo.</p>' +
    '<ul id="lista-recurrentes"></ul>' +
    '<button id="simular-mes" class="boton boton-pequeno boton-secundario" type="button">' +
    'Simular el mes que viene</button>';
  seccionDemo.appendChild(tarjeta);

  document.getElementById('lista-recurrentes').addEventListener('click', function (evento) {
    const boton = evento.target.closest('.boton-borrar');
    if (!boton) return;
    const id = Number(boton.dataset.id);
    grupo().recurrentes = grupo().recurrentes.filter(function (r) { return r.id !== id; });
    actualizarTodo();
  });

  // Para la demo: apunta ya los gastos del mes siguiente
  document.getElementById('simular-mes').addEventListener('click', function () {
    grupo().recurrentes.forEach(apuntarRecurrente);
    actualizarTodo();
    mostrarMensaje('Apuntados los gastos programados del mes que viene.');
  });
}

function apuntarRecurrente(r) {
  grupo().pagos.push(
    nuevoPago(r.tipo || 'grupal', r.importe, r.concepto + ' (automático)', r.etiqueta,
              r.pagador, r.reparto, false)
  );
}

// Al abrir la web: si ha empezado un mes nuevo y ya es el día, se apuntan solos
function comprobarRecurrentes() {
  Object.keys(datos.grupos).forEach(function (clave) {
    const g = datos.grupos[clave];
    g.recurrentes.forEach(function (r) {
      if (r.ultimoMes !== mesActual() && new Date().getDate() >= r.dia) {
        g.pagos.push(nuevoPago(r.tipo || 'grupal', r.importe, r.concepto + ' (automático)',
                               r.etiqueta, r.pagador, r.reparto, false));
        r.ultimoMes = mesActual();
      }
    });
  });
}

function pintarRecurrentes() {
  const lista = document.getElementById('lista-recurrentes');
  lista.innerHTML = '';

  grupo().recurrentes.forEach(function (r) {
    const li = crear('li', 'pago');
    li.appendChild(crear('span', '',
      r.concepto + ' · ' + euros(r.importe) + ' · cada mes el día ' + r.dia));
    const boton = crear('button', 'boton-borrar', 'Quitar');
    boton.type = 'button';
    boton.dataset.id = r.id;
    li.appendChild(boton);
    lista.appendChild(li);
  });

  const hay = grupo().recurrentes.length > 0;
  document.getElementById('recurrentes-vacio').hidden = hay;
  document.getElementById('simular-mes').hidden = !hay;
}


/* ---------- 12. Meta de ahorro común ---------- */

function crearTarjetaMeta() {
  const tarjeta = crear('section', 'tarjeta formulario');
  tarjeta.id = 'meta';
  seccionDemo.appendChild(tarjeta);

  // Los botones de dentro cambian al repintar, así que escuchamos en la tarjeta
  tarjeta.addEventListener('click', function (evento) {
    if (evento.target.id === 'crear-meta') crearMeta();
    if (evento.target.id === 'aportar-meta') aportarMeta();
    if (evento.target.id === 'quitar-meta' && confirm('¿Quitar la meta de ahorro?')) {
      grupo().meta = null;
      actualizarTodo();
    }
  });
}

function pintarMeta() {
  const tarjeta = document.getElementById('meta');
  const meta = grupo().meta;
  tarjeta.innerHTML = '<h3>Meta de ahorro común</h3>';

  // Sin meta: mini formulario para crearla
  if (!meta) {
    tarjeta.insertAdjacentHTML('beforeend',
      '<p>Ahorrad juntos para algo: un viaje, un sofá, la fianza...</p>' +
      '<label for="meta-nombre">¿Para qué ahorráis?</label>' +
      '<input id="meta-nombre" type="text" maxlength="40" placeholder="Viaje a Lisboa">' +
      '<label for="meta-objetivo">¿Cuánto necesitáis? (€)</label>' +
      '<input id="meta-objetivo" type="number" min="1" step="1" placeholder="400">' +
      '<button id="crear-meta" class="boton" type="button">Crear meta</button>');
    return;
  }

  let ahorrado = 0;
  const porPersona = {};
  meta.aportaciones.forEach(function (a) {
    ahorrado += a.importe;
    porPersona[a.quien] = (porPersona[a.quien] || 0) + a.importe;
  });
  const porcentaje = Math.min((ahorrado / meta.objetivo) * 100, 100);

  tarjeta.appendChild(crear('p', 'meta-nombre', meta.nombre));
  tarjeta.appendChild(crear('p', 'cifra-grande',
    euros(ahorrado) + ' de ' + euros(meta.objetivo)));

  // Barra de progreso: reutiliza el estilo del gráfico de "Has gastado"
  const barra = crear('div', 'grafico');
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-valuenow', Math.round(porcentaje));
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  const tramo = crear('div', 'tramo tramo-grupal');
  tramo.style.width = porcentaje + '%';
  barra.appendChild(tramo);
  tarjeta.appendChild(barra);

  const partes = Object.keys(porPersona).map(function (nombre) {
    return nombre + ' ' + euros(porPersona[nombre]);
  });
  tarjeta.appendChild(crear('p', '',
    porcentaje >= 100 ? '¡Meta conseguida! 🎉' : 'Han puesto: ' + (partes.join(' · ') || 'nadie todavía')));

  // Aportar dinero a la meta
  const labelQuien = crear('label', '', '¿Quién aporta?');
  labelQuien.htmlFor = 'meta-quien';
  const labelImporte = crear('label', '', 'Cantidad (€)');
  labelImporte.htmlFor = 'meta-importe';
  const inputMeta = crear('input');
  inputMeta.id = 'meta-importe';
  inputMeta.type = 'number';
  inputMeta.min = '1';
  inputMeta.step = '0.01';
  inputMeta.placeholder = '20';

  tarjeta.appendChild(labelQuien);
  tarjeta.appendChild(crearSelect('meta-quien', grupo().miembros));
  tarjeta.appendChild(labelImporte);
  tarjeta.appendChild(inputMeta);

  const aportar = crear('button', 'boton', 'Aportar');
  aportar.type = 'button';
  aportar.id = 'aportar-meta';
  tarjeta.appendChild(aportar);

  const quitar = crear('button', 'boton-borrar', 'Quitar meta');
  quitar.type = 'button';
  quitar.id = 'quitar-meta';
  tarjeta.appendChild(quitar);
}

function crearMeta() {
  const inputNombre = document.getElementById('meta-nombre');
  const inputObjetivo = document.getElementById('meta-objetivo');
  const nombre = inputNombre.value.trim();
  const objetivo = Number(inputObjetivo.value);

  if (nombre === '') return mostrarError(inputNombre, 'Pon para qué ahorráis.');
  if (!(objetivo > 0)) return mostrarError(inputObjetivo, 'Pon cuánto necesitáis.');

  grupo().meta = { nombre: nombre, objetivo: redondear(objetivo), aportaciones: [] };
  actualizarTodo();
}

function aportarMeta() {
  const input = document.getElementById('meta-importe');
  const importe = Number(String(input.value).replace(',', '.'));
  if (!(importe > 0)) return mostrarError(input, 'Escribe cuánto aportas.');

  const quienAporta = document.getElementById('meta-quien').value;
  grupo().meta.aportaciones.push({ quien: quienAporta, importe: redondear(importe) });
  actualizarTodo();
  mostrarMensaje(quienAporta + ' ha aportado ' + euros(importe) + ' a la meta.');
}


/* ---------- 13. Historial con filtro por etiqueta ---------- */

function crearHistorial() {
  const historial = crear('section', 'tarjeta');
  historial.id = 'historial';
  historial.innerHTML =
    '<h3>Historial</h3>' +
    '<label for="filtro-etiqueta">Ver</label> ' +
    '<p id="historial-vacio">Todavía no has apuntado ningún pago.</p>' +
    '<ul id="lista-pagos"></ul>' +
    '<button id="borrar-todo" class="boton boton-pequeno" type="button">Borrar todo</button>';

  // Filtro: "Todas" + cada etiqueta
  const filtro = crearSelect('filtro-etiqueta', ['Todas'].concat(ETIQUETAS));
  historial.querySelector('label').after(filtro);
  document.getElementById('resumen').after(historial);

  filtro.addEventListener('change', pintarHistorial);

  document.getElementById('lista-pagos').addEventListener('click', function (evento) {
    if (evento.target.classList.contains('boton-borrar')) {
      borrarPago(Number(evento.target.dataset.id));
    }
  });

  document.getElementById('borrar-todo').addEventListener('click', function () {
    if (confirm('¿Borrar todos los pagos de "' + grupo().nombre + '"?')) {
      grupo().pagos = [];
      actualizarTodo();
    }
  });
}

function textoPago(pago) {
  if (pago.tipo === 'saldado') {
    return '✅ ' + pago.pagador + ' pagó ' + euros(pago.importe) + ' a ' + quien(pago.reparto[0]) + ' por Bizum';
  }
  let texto = '[' + pago.etiqueta + '] ' + pago.concepto + ' · ' + euros(pago.importe);
  if (pago.tipo === 'personal') return texto + ' · personal';

  texto += pago.pagador === YO ? ' · pagaste tú' : ' · pagó ' + pago.pagador;
  texto += ' · entre ' + pago.reparto.length;
  if (pago.pendientesUrgente && pago.pendientesUrgente.length > 0) texto += ' · 🔔 urgente';
  return texto;
}

function pintarHistorial() {
  const filtro = document.getElementById('filtro-etiqueta').value;
  const lista = document.getElementById('lista-pagos');
  lista.innerHTML = '';

  const visibles = grupo().pagos.filter(function (pago) {
    return filtro === 'Todas' || pago.etiqueta === filtro;
  });

  // Los más recientes primero
  visibles.slice().reverse().forEach(function (pago) {
    const li = crear('li', 'pago');
    li.appendChild(crear('span', '', textoPago(pago)));

    const boton = crear('button', 'boton-borrar', 'Borrar');
    boton.type = 'button';
    boton.dataset.id = pago.id;
    boton.setAttribute('aria-label', 'Borrar ' + pago.concepto);
    li.appendChild(boton);
    lista.appendChild(li);
  });

  const vacio = document.getElementById('historial-vacio');
  vacio.hidden = visibles.length > 0;
  vacio.textContent = grupo().pagos.length === 0
    ? 'Todavía no has apuntado ningún pago.'
    : 'No hay pagos con la etiqueta "' + filtro + '".';
  document.getElementById('borrar-todo').hidden = grupo().pagos.length === 0;
}

function borrarPago(id) {
  grupo().pagos = grupo().pagos.filter(function (pago) { return pago.id !== id; });
  actualizarTodo();
}


/* ---------- 14. Repintar todo ---------- */

// Cada vez que cambian los datos: repintar todas las tarjetas y guardar
function actualizarTodo() {
  pintarResumen();
  pintarDeudas();
  pintarAvisos();
  pintarMeta();
  pintarRecurrentes();
  pintarHistorial();
  guardarDatos();
}


/* ---------- 15. Vídeo, animaciones y cabecera ---------- */

// Sustituye el texto de #video-contenedor por el vídeo del proyecto
function ponerVideo() {
  const contenedor = document.getElementById('video-contenedor');
  if (!contenedor) return;

  const video = crear('video');
  video.src = 'assets/video/cashmates.mp4';
  video.controls = true;
  video.preload = 'metadata';
  video.playsInline = true;
  video.style.width = '100%';
  video.style.maxWidth = '800px';

  contenedor.innerHTML = '';
  contenedor.appendChild(video);
}

// Las secciones aparecen suavemente al bajar y las cifras cuentan desde 0
function iniciarAnimaciones() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const secciones = document.querySelectorAll('main > section');
  const cifras = document.querySelectorAll('.cifras strong');

  // Solo se ocultan las que están por debajo de la pantalla al cargar
  secciones.forEach(function (seccion) {
    if (seccion.getBoundingClientRect().top < window.innerHeight) return;
    seccion.style.opacity = '0';
    seccion.style.transform = 'translateY(24px)';
    seccion.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      const elemento = entrada.target;
      if (elemento.tagName === 'STRONG') {
        animarCifra(elemento);
      } else {
        elemento.style.opacity = '1';
        elemento.style.transform = 'none';
      }
      observador.unobserve(elemento);
    });
  }, { threshold: 0.15 });

  secciones.forEach(function (s) { observador.observe(s); });
  cifras.forEach(function (c) { observador.observe(c); });
}

// "60 %" -> cuenta de 0 a 60 manteniendo el resto del texto
function animarCifra(elemento) {
  const textoFinal = elemento.textContent;
  const numero = textoFinal.match(/\d+/);
  if (!numero) return;

  const objetivo = Number(numero[0]);
  const duracion = 1200;
  const inicio = performance.now();

  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    elemento.textContent = textoFinal.replace(numero[0], Math.round(objetivo * progreso));
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

function iniciarCabecera() {
  const cabecera = document.querySelector('.cabecera');
  window.addEventListener('scroll', function () {
    cabecera.classList.toggle('con-sombra', window.scrollY > 8);
  });
}


/* ---------- 16. Arranque ---------- */

crearBarraGrupo();
crearCamposFormulario();
crearHistorial();
crearTarjetaDeudas();
crearTarjetaAvisos();
crearTarjetaMeta();
crearTarjetaRecurrentes();

document.getElementById('selector-grupo').value = datos.grupoActivo;
rellenarMiembros();
actualizarTipo();
comprobarRecurrentes();
actualizarTodo();
iniciarInsistencia();

ponerVideo();
iniciarAnimaciones();
iniciarCabecera();

form.addEventListener('submit', alEnviarFormulario);
form.querySelectorAll('input[name="tipo"]').forEach(function (radio) {
  radio.addEventListener('change', actualizarTipo);
});
