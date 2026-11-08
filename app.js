/* =========================================================================
   CashMates · app.js  (demo de la one page)

   Índice:
     1. Datos de la demo
     2. Elementos de la página
     3. Formulario: quién paga, entre quiénes se reparte, tipo de pago
     4. Añadir un pago
     5. Cálculos y resumen ("Has gastado", gráfico y saldo)
     6. Historial de pagos (con borrar)
     7. Guardar los pagos en el navegador
     8. Vídeo conceptual
     9. Animaciones al hacer scroll y contadores de las cifras
    10. Arranque

   Cómo se calcula el dinero:
   - Personal: suma de tus pagos personales.
   - Grupal: tu parte de cada pago grupal (importe / nº de personas),
     solo si tú estás entre las personas del reparto.
   - Has gastado = Personal + Grupal.
   - Saldo = lo que tú has pagado por el grupo - tu parte de los gastos.
       positivo -> "Te debe el grupo"
       negativo -> "Debes al grupo"

   Clases y atributos que añade el JS (por si el CSS los quiere usar):
   - label.miembro                (cada persona en "Se reparte entre")
   - #campo-pagador               (bloque "¿Quién ha pagado?")
   - #historial, .pago, .boton-borrar, #borrar-todo
   - #saldo[data-estado="positivo" | "negativo" | "cero"]
   - #boton-anadir.anadido        (1,5 s después de añadir un pago)
   - .cabecera.con-sombra         (al hacer scroll)
   ========================================================================= */


/* ---------- 1. Datos de la demo ---------- */

const YO = 'Tú';
const MIEMBROS = [YO, 'Lucía', 'Pablo', 'Marta'];
const CLAVE_GUARDADO = 'cashmates-pagos';

// Cada pago: { id, tipo, importe, concepto, pagador, reparto }
// Ejemplo:   { id: 1, tipo: 'grupal', importe: 40, concepto: 'Wifi',
//              pagador: 'Tú', reparto: ['Tú', 'Lucía', 'Pablo', 'Marta'] }
let pagos = cargarPagos();


/* ---------- 2. Elementos de la página ---------- */

const form = document.getElementById('form-pago');
const inputImporte = document.getElementById('pago-importe');
const inputConcepto = document.getElementById('pago-concepto');
const bloqueReparto = document.getElementById('bloque-reparto');
const listaMiembros = document.getElementById('lista-miembros');
const botonAnadir = document.getElementById('boton-anadir');


/* ---------- 3. Formulario ---------- */

// Convierte un número en texto con euros: 1234.5 -> "1234,50 €"
function euros(cantidad) {
  return cantidad.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// Crea el desplegable "¿Quién ha pagado?" justo antes de "Se reparte entre"
function crearSelectorPagador() {
  const campo = document.createElement('div');
  campo.id = 'campo-pagador';

  const label = document.createElement('label');
  label.htmlFor = 'pago-pagador';
  label.textContent = '¿Quién ha pagado?';

  const select = document.createElement('select');
  select.id = 'pago-pagador';
  select.name = 'pagador';

  MIEMBROS.forEach(function (nombre) {
    const opcion = document.createElement('option');
    opcion.value = nombre;
    opcion.textContent = nombre;
    select.appendChild(opcion);
  });

  campo.appendChild(label);
  campo.appendChild(select);
  form.insertBefore(campo, bloqueReparto);
}

// Rellena "Se reparte entre" con una casilla por persona (todas marcadas)
function crearCasillasMiembros() {
  listaMiembros.innerHTML = '';
  MIEMBROS.forEach(function (nombre) {
    const label = document.createElement('label');
    label.className = 'miembro';
    label.innerHTML = '<input type="checkbox" name="reparto" checked> <span></span>';
    label.querySelector('input').value = nombre;
    label.querySelector('span').textContent = nombre;
    listaMiembros.appendChild(label);
  });
}

function tipoElegido() {
  return form.querySelector('input[name="tipo"]:checked').value; // 'grupal' o 'personal'
}

// Los pagos personales son solo tuyos: se ocultan "quién paga" y el reparto
function actualizarTipo() {
  const esGrupal = tipoElegido() === 'grupal';
  bloqueReparto.hidden = !esGrupal;
  document.getElementById('campo-pagador').hidden = !esGrupal;
}

// Muestra un aviso del navegador junto al campo que está mal
function mostrarError(campo, mensaje) {
  campo.setCustomValidity(mensaje);
  campo.reportValidity();
  // Se borra en cuanto el usuario toca el campo
  campo.addEventListener('input', function () { campo.setCustomValidity(''); }, { once: true });
  campo.addEventListener('change', function () { campo.setCustomValidity(''); }, { once: true });
}


/* ---------- 4. Añadir un pago ---------- */

function alEnviarFormulario(evento) {
  evento.preventDefault(); // que no se recargue la página

  // Admite "20,50" además de "20.50"
  const importe = Number(String(inputImporte.value).replace(',', '.'));
  const concepto = inputConcepto.value.trim();
  const tipo = tipoElegido();

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
    const marcadas = listaMiembros.querySelectorAll('input:checked');
    marcadas.forEach(function (casilla) { reparto.push(casilla.value); });

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

  pagos.push({
    id: Date.now(),
    tipo: tipo,
    importe: Math.round(importe * 100) / 100,
    concepto: concepto,
    pagador: pagador,
    reparto: reparto
  });

  actualizarTodo();
  avisarEnBoton();

  // Deja el formulario listo para el siguiente pago
  inputImporte.value = '';
  inputConcepto.value = '';
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


/* ---------- 5. Cálculos y resumen ---------- */

function calcular() {
  let personal = 0;      // tus gastos personales
  let miParte = 0;       // tu parte de los gastos del grupo
  let pagadoPorMi = 0;   // lo que tú has adelantado por el grupo

  pagos.forEach(function (pago) {
    if (pago.tipo === 'personal') {
      personal += pago.importe;
      return;
    }
    if (pago.pagador === YO) {
      pagadoPorMi += pago.importe;
    }
    if (pago.reparto.includes(YO)) {
      miParte += pago.importe / pago.reparto.length;
    }
  });

  return {
    personal: personal,
    grupal: miParte,
    total: personal + miParte,
    saldo: pagadoPorMi - miParte
  };
}

function pintarResumen() {
  const r = calcular();

  document.getElementById('total-gastado').textContent = euros(r.total);
  document.getElementById('valor-personal').textContent = euros(r.personal);
  document.getElementById('valor-grupal').textContent = euros(r.grupal);

  // Gráfico: el ancho de cada tramo es su porcentaje del total
  let porcentajePersonal = 0;
  let porcentajeGrupal = 0;
  if (r.total > 0) {
    porcentajePersonal = (r.personal / r.total) * 100;
    porcentajeGrupal = 100 - porcentajePersonal;
  }
  document.getElementById('tramo-personal').style.width = porcentajePersonal + '%';
  document.getElementById('tramo-grupal').style.width = porcentajeGrupal + '%';

  // Saldo con el grupo
  const saldo = document.getElementById('saldo');
  const etiqueta = document.getElementById('saldo-etiqueta');
  const valor = document.getElementById('saldo-valor');

  if (r.saldo > 0.005) {
    saldo.dataset.estado = 'positivo';
    etiqueta.textContent = 'Te debe el grupo';
    valor.textContent = euros(r.saldo);
  } else if (r.saldo < -0.005) {
    saldo.dataset.estado = 'negativo';
    etiqueta.textContent = 'Debes al grupo';
    valor.textContent = euros(-r.saldo);
  } else {
    saldo.dataset.estado = 'cero';
    etiqueta.textContent = 'Estás en paz con el grupo';
    valor.textContent = euros(0);
  }
}


/* ---------- 6. Historial de pagos ---------- */

// Crea la tarjeta "Historial" debajo del resumen
function crearHistorial() {
  const historial = document.createElement('section');
  historial.id = 'historial';
  historial.className = 'tarjeta';
  historial.innerHTML =
    '<h3>Historial</h3>' +
    '<p id="historial-vacio">Todavía no has apuntado ningún pago.</p>' +
    '<ul id="lista-pagos"></ul>' +
    '<button id="borrar-todo" class="boton boton-pequeno" type="button">Borrar todo</button>';

  document.getElementById('resumen').after(historial);

  // Un solo "escuchador" para todos los botones "Borrar" de la lista
  document.getElementById('lista-pagos').addEventListener('click', function (evento) {
    if (evento.target.classList.contains('boton-borrar')) {
      borrarPago(Number(evento.target.dataset.id));
    }
  });

  document.getElementById('borrar-todo').addEventListener('click', function () {
    if (confirm('¿Borrar todos los pagos?')) {
      pagos = [];
      actualizarTodo();
    }
  });
}

function textoPago(pago) {
  if (pago.tipo === 'personal') {
    return pago.concepto + ' · ' + euros(pago.importe) + ' · personal';
  }
  const quien = pago.pagador === YO ? 'pagaste tú' : 'pagó ' + pago.pagador;
  return pago.concepto + ' · ' + euros(pago.importe) + ' · ' + quien +
         ' · entre ' + pago.reparto.length;
}

function pintarHistorial() {
  const lista = document.getElementById('lista-pagos');
  lista.innerHTML = '';

  // Los más recientes primero
  pagos.slice().reverse().forEach(function (pago) {
    const li = document.createElement('li');
    li.className = 'pago';

    const texto = document.createElement('span');
    texto.textContent = textoPago(pago);

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-borrar';
    boton.dataset.id = pago.id;
    boton.textContent = 'Borrar';
    boton.setAttribute('aria-label', 'Borrar ' + pago.concepto);

    li.appendChild(texto);
    li.appendChild(boton);
    lista.appendChild(li);
  });

  const hayPagos = pagos.length > 0;
  document.getElementById('historial-vacio').hidden = hayPagos;
  document.getElementById('borrar-todo').hidden = !hayPagos;
}

function borrarPago(id) {
  pagos = pagos.filter(function (pago) { return pago.id !== id; });
  actualizarTodo();
}


/* ---------- 7. Guardar los pagos en el navegador ---------- */

// localStorage guarda texto, así que convertimos la lista a JSON y al revés.
// Va dentro de try/catch porque en modo incógnito puede fallar.
function guardarPagos() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(pagos));
  } catch (error) {
    // Si no se puede guardar, la demo sigue funcionando igual
  }
}

function cargarPagos() {
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADO);
    return guardado ? JSON.parse(guardado) : [];
  } catch (error) {
    return [];
  }
}

// Cada vez que cambian los pagos: repintar y guardar
function actualizarTodo() {
  pintarResumen();
  pintarHistorial();
  guardarPagos();
}


/* ---------- 8. Vídeo conceptual ---------- */

// Sustituye el texto de #video-contenedor por el vídeo del proyecto
function ponerVideo() {
  const contenedor = document.getElementById('video-contenedor');
  if (!contenedor) return;

  const video = document.createElement('video');
  video.src = 'assets/video/cashmates.mp4';
  video.controls = true;
  video.preload = 'metadata';
  video.playsInline = true;
  video.style.width = '100%';     // que nunca se salga de su caja
  video.style.maxWidth = '800px';

  contenedor.innerHTML = '';
  contenedor.appendChild(video);
}


/* ---------- 9. Animaciones al hacer scroll ---------- */

// Las secciones aparecen suavemente cuando entran en pantalla.
// Las cifras del problema (425 €, +19 %...) cuentan desde 0.
function iniciarAnimaciones() {
  // Si el usuario ha pedido menos movimiento en su sistema, no animamos
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const secciones = document.querySelectorAll('main > section');
  const cifras = document.querySelectorAll('.cifras strong');

  // Estado inicial: invisibles y un poco más abajo.
  // Solo las que están por debajo de la pantalla; lo que ya se ve, se queda.
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
      observador.unobserve(elemento); // solo se anima una vez
    });
  }, { threshold: 0.15 });

  secciones.forEach(function (s) { observador.observe(s); });
  cifras.forEach(function (c) { observador.observe(c); });
}

// "425 €/mes" -> cuenta de 0 a 425 manteniendo el resto del texto
function animarCifra(elemento) {
  const textoFinal = elemento.textContent;
  const numero = textoFinal.match(/\d+/);
  if (!numero) return;

  const objetivo = Number(numero[0]);
  const duracion = 1200; // milisegundos
  const inicio = performance.now();

  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    const valor = Math.round(objetivo * progreso);
    elemento.textContent = textoFinal.replace(numero[0], valor);
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

// Sombra en la cabecera cuando la página no está arriba del todo
function iniciarCabecera() {
  const cabecera = document.querySelector('.cabecera');
  window.addEventListener('scroll', function () {
    cabecera.classList.toggle('con-sombra', window.scrollY > 8);
  });
}


/* ---------- 10. Arranque ---------- */

crearSelectorPagador();
crearCasillasMiembros();
crearHistorial();
actualizarTipo();
actualizarTodo();
ponerVideo();
iniciarAnimaciones();
iniciarCabecera();

form.addEventListener('submit', alEnviarFormulario);
form.querySelectorAll('input[name="tipo"]').forEach(function (radio) {
  radio.addEventListener('change', actualizarTipo);
});
