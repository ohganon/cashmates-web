/* =========================================================================
   CashMates · app.js
   Lógica de la demo "Tus cuentas" de la one page.

   Qué hace:
   - Rellena #lista-miembros con las personas del piso (casillas).
   - Muestra u oculta "Se reparte entre" según el pago sea grupal o personal.
   - Valida el formulario y añade el pago.
   - Recalcula: total gastado, tramos del gráfico personal/grupal y saldo
     con el grupo (te deben / debes / en paz).

   Cómo se calcula (todo en céntimos para evitar errores de redondeo):
   - Personal: suma de tus pagos personales.
   - Grupal: tu parte de cada pago grupal (importe / nº de personas entre las
     que se reparte, solo si tú estás incluido).
   - Has gastado = Personal + Grupal  -> lo que de verdad te ha costado a ti.
   - Saldo = lo que has adelantado por el grupo - tu parte.
       > 0  "Te debe el grupo"
       < 0  "Debes al grupo"
       = 0  "Estás en paz"

   CashMates no mueve dinero: aquí solo se apuntan gastos.

   Ganchos para el CSS (no cambian el HTML, solo añaden clases/atributos):
   - #lista-miembros > label.miembro > input[type=checkbox] + span
   - #bloque-reparto recibe [hidden] cuando el pago es personal
   - #saldo recibe data-estado="positivo" | "negativo" | "cero"
   - #boton-anadir recibe la clase "anadido" durante 1,5 s tras añadir
   - .cabecera recibe la clase "con-sombra" al hacer scroll
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- Datos de la demo ---------- */

  // La persona que usa la web siempre es "yo". El resto son compañeros de piso.
  var YO = 'yo';
  var MIEMBROS = [
    { id: YO, nombre: 'Tú' },
    { id: 'lucia', nombre: 'Lucía' },
    { id: 'pablo', nombre: 'Pablo' },
    { id: 'marta', nombre: 'Marta' }
  ];

  var IMPORTE_MAXIMO = 100000; // €; evita cifras absurdas en la demo

  // Lista de pagos apuntados en esta sesión.
  // { tipo: 'grupal'|'personal', centimos: 2000, concepto: 'Wifi', reparto: ['yo','lucia'] }
  var pagos = [];

  /* ---------- Utilidades ---------- */

  var formatoEuros = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function euros(centimos) {
    return formatoEuros.format(centimos / 100);
  }

  function $(id) {
    return document.getElementById(id);
  }

  // Acepta "20", "20.5", "20,50" y "1.234,56". Devuelve céntimos o NaN.
  function leerImporte(input) {
    var texto = String(input.value || '').trim();
    var numero = input.valueAsNumber;

    if (isNaN(numero) && texto) {
      if (texto.indexOf(',') !== -1) {
        texto = texto.replace(/\./g, '').replace(',', '.');
      }
      numero = parseFloat(texto);
    }
    if (isNaN(numero)) return NaN;
    return Math.round(numero * 100);
  }

  /* ---------- Referencias al DOM ---------- */

  var form = $('form-pago');
  if (!form) return; // por si se carga en otra página

  var inputImporte = $('pago-importe');
  var inputConcepto = $('pago-concepto');
  var bloqueReparto = $('bloque-reparto');
  var listaMiembros = $('lista-miembros');
  var botonAnadir = $('boton-anadir');

  var totalGastado = $('total-gastado');
  var grafico = $('grafico');
  var tramoPersonal = $('tramo-personal');
  var tramoGrupal = $('tramo-grupal');
  var valorPersonal = $('valor-personal');
  var valorGrupal = $('valor-grupal');
  var saldo = $('saldo');
  var saldoEtiqueta = $('saldo-etiqueta');
  var saldoValor = $('saldo-valor');

  /* ---------- Miembros del grupo ---------- */

  function pintarMiembros() {
    listaMiembros.textContent = '';
    MIEMBROS.forEach(function (m) {
      var label = document.createElement('label');
      label.className = 'miembro';

      var check = document.createElement('input');
      check.type = 'checkbox';
      check.name = 'reparto';
      check.value = m.id;
      check.checked = true;

      var nombre = document.createElement('span');
      nombre.textContent = m.nombre;

      label.appendChild(check);
      label.appendChild(nombre);
      listaMiembros.appendChild(label);
    });
  }

  function casillasMiembros() {
    return listaMiembros.querySelectorAll('input[name="reparto"]');
  }

  function miembrosMarcados() {
    var ids = [];
    casillasMiembros().forEach(function (c) {
      if (c.checked) ids.push(c.value);
    });
    return ids;
  }

  /* ---------- Tipo de pago ---------- */

  function tipoSeleccionado() {
    var marcado = form.querySelector('input[name="tipo"]:checked');
    return marcado ? marcado.value : 'grupal';
  }

  function actualizarTipo() {
    var esGrupal = tipoSeleccionado() === 'grupal';
    bloqueReparto.hidden = !esGrupal;
    // Un fieldset deshabilitado no se envía ni se valida
    bloqueReparto.disabled = !esGrupal;
    limpiarErrorReparto();
  }

  /* ---------- Validación ---------- */

  function errorReparto(mensaje) {
    var primera = casillasMiembros()[0];
    if (!primera) return;
    primera.setCustomValidity(mensaje);
    primera.reportValidity();
  }

  function limpiarErrorReparto() {
    var primera = casillasMiembros()[0];
    if (primera) primera.setCustomValidity('');
  }

  function validar() {
    inputImporte.setCustomValidity('');
    inputConcepto.setCustomValidity('');
    limpiarErrorReparto();

    var centimos = leerImporte(inputImporte);
    if (isNaN(centimos) || centimos <= 0) {
      inputImporte.setCustomValidity('Escribe cuánto has pagado (por ejemplo, 20,00).');
      inputImporte.reportValidity();
      return null;
    }
    if (centimos > IMPORTE_MAXIMO * 100) {
      inputImporte.setCustomValidity('El importe máximo es ' + euros(IMPORTE_MAXIMO * 100) + '.');
      inputImporte.reportValidity();
      return null;
    }

    var concepto = inputConcepto.value.trim();
    if (!concepto) {
      inputConcepto.setCustomValidity('Pon un concepto, por ejemplo "Wifi" o "Compra".');
      inputConcepto.reportValidity();
      return null;
    }

    var tipo = tipoSeleccionado();
    var reparto = [];
    if (tipo === 'grupal') {
      reparto = miembrosMarcados();
      if (reparto.length === 0) {
        errorReparto('Elige al menos una persona para repartir el pago.');
        return null;
      }
      if (reparto.length === 1 && reparto[0] === YO) {
        errorReparto('Si solo es para ti, márcalo como pago personal.');
        return null;
      }
    }

    return { tipo: tipo, centimos: centimos, concepto: concepto, reparto: reparto };
  }

  /* ---------- Cálculos ---------- */

  function calcularResumen() {
    var personal = 0; // céntimos
    var miParteGrupal = 0;
    var adelantado = 0; // lo que he pagado por el grupo

    pagos.forEach(function (p) {
      if (p.tipo === 'personal') {
        personal += p.centimos;
        return;
      }
      adelantado += p.centimos;
      if (p.reparto.indexOf(YO) !== -1) {
        miParteGrupal += p.centimos / p.reparto.length;
      }
    });

    miParteGrupal = Math.round(miParteGrupal);

    return {
      personal: personal,
      grupal: miParteGrupal,
      total: personal + miParteGrupal,
      saldo: adelantado - miParteGrupal
    };
  }

  /* ---------- Pintar el resumen ---------- */

  function pintarResumen() {
    var r = calcularResumen();

    totalGastado.textContent = euros(r.total);
    valorPersonal.textContent = euros(r.personal);
    valorGrupal.textContent = euros(r.grupal);

    var pctPersonal = r.total > 0 ? (r.personal / r.total) * 100 : 0;
    var pctGrupal = r.total > 0 ? 100 - pctPersonal : 0;
    tramoPersonal.style.width = pctPersonal + '%';
    tramoGrupal.style.width = pctGrupal + '%';

    grafico.setAttribute(
      'aria-label',
      r.total > 0
        ? 'Reparto de tu gasto: ' + Math.round(pctPersonal) + ' % personal (' + euros(r.personal) +
          ') y ' + Math.round(pctGrupal) + ' % grupal (' + euros(r.grupal) + ')'
        : 'Todavía no has apuntado ningún gasto'
    );

    if (r.saldo > 0) {
      saldo.dataset.estado = 'positivo';
      saldoEtiqueta.textContent = 'Te debe el grupo';
      saldoValor.textContent = euros(r.saldo);
    } else if (r.saldo < 0) {
      saldo.dataset.estado = 'negativo';
      saldoEtiqueta.textContent = 'Debes al grupo';
      saldoValor.textContent = euros(-r.saldo);
    } else {
      saldo.dataset.estado = 'cero';
      saldoEtiqueta.textContent = pagos.length ? 'Estás en paz con el grupo' : 'Te debe el grupo';
      saldoValor.textContent = euros(0);
    }
  }

  /* ---------- Añadir un pago ---------- */

  var temporizadorBoton = null;
  var textoBoton = botonAnadir ? botonAnadir.textContent : '';

  function confirmarEnBoton() {
    if (!botonAnadir) return;
    clearTimeout(temporizadorBoton);
    botonAnadir.classList.add('anadido');
    botonAnadir.textContent = '¡Pago añadido!';
    temporizadorBoton = setTimeout(function () {
      botonAnadir.classList.remove('anadido');
      botonAnadir.textContent = textoBoton;
    }, 1500);
  }

  function alEnviar(evento) {
    evento.preventDefault();

    var pago = validar();
    if (!pago) return;

    pagos.push(pago);
    pintarResumen();
    confirmarEnBoton();

    // Deja el formulario listo para el siguiente gasto, manteniendo el tipo
    inputImporte.value = '';
    inputConcepto.value = '';
    casillasMiembros().forEach(function (c) { c.checked = true; });
    inputImporte.focus();
  }

  /* ---------- Cabecera con sombra al hacer scroll ---------- */

  function iniciarCabecera() {
    var cabecera = document.querySelector('.cabecera');
    if (!cabecera) return;
    var actualizar = function () {
      cabecera.classList.toggle('con-sombra', window.scrollY > 8);
    };
    window.addEventListener('scroll', actualizar, { passive: true });
    actualizar();
  }

  /* ---------- Arranque ---------- */

  pintarMiembros();
  actualizarTipo();
  pintarResumen();
  iniciarCabecera();

  form.addEventListener('submit', alEnviar);

  form.querySelectorAll('input[name="tipo"]').forEach(function (radio) {
    radio.addEventListener('change', actualizarTipo);
  });

  // Al corregir un campo, quita el mensaje de error
  inputImporte.addEventListener('input', function () { inputImporte.setCustomValidity(''); });
  inputConcepto.addEventListener('input', function () { inputConcepto.setCustomValidity(''); });
  listaMiembros.addEventListener('change', limpiarErrorReparto);
})();
