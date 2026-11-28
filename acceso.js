/* =========================================================================
   CashMates · acceso.js  (acceso rápido simulado · Sprint 3)

   No hay back-end: "entrar" solo guarda el nombre en este navegador.
   - Sin sesión: la demo se oculta y sale la tarjeta #acceso.
   - "Entrar": guarda el nombre y enseña la demo.
   - "Probar con el piso de José": además carga el piso de ejemplo (botón de app.js).
   - "Salir": borra el nombre y vuelve a la tarjeta de acceso.
   Se carga después de app.js (los dos con defer), así que el botón
   #cargar-ejemplo ya existe cuando se ejecuta este archivo.
   app.js no se toca.
   ========================================================================= */

(function () {
  const CLAVE_USUARIO = 'cashmates-usuario';

  const demo = document.getElementById('demo');
  const acceso = document.getElementById('acceso');
  if (!demo || !acceso) return;

  const inputNombre = document.getElementById('acceso-nombre');
  const botonEjemplo = document.getElementById('acceso-ejemplo');

  // Saludo con botón "Salir", justo debajo del título de la demo
  const sesion = document.createElement('p');
  sesion.id = 'sesion';
  sesion.className = 'sesion';
  sesion.hidden = true;
  sesion.innerHTML = '<span id="sesion-saludo"></span>' +
    '<button id="sesion-salir" class="boton-borrar" type="button">Salir</button>';
  acceso.after(sesion);

  // localStorage puede fallar en modo incógnito: entonces la sesión dura lo que la página
  let usuarioEnMemoria = null;
  function leerUsuario() {
    try { return localStorage.getItem(CLAVE_USUARIO) || usuarioEnMemoria; }
    catch (error) { return usuarioEnMemoria; }
  }
  function guardarUsuario(nombre) {
    usuarioEnMemoria = nombre;
    try {
      if (nombre) localStorage.setItem(CLAVE_USUARIO, nombre);
      else localStorage.removeItem(CLAVE_USUARIO);
    } catch (error) { /* la demo sigue funcionando sin guardar */ }
  }

  function mostrar() {
    const nombre = leerUsuario();
    const dentro = Boolean(nombre);
    demo.classList.toggle('sin-sesion', !dentro);
    acceso.hidden = dentro;
    sesion.hidden = !dentro;
    if (dentro) document.getElementById('sesion-saludo').textContent = 'Hola, ' + nombre + ' 👋';
  }

  function entrar(nombre, conEjemplo) {
    guardarUsuario(nombre);
    mostrar();
    if (conEjemplo) {
      const cargar = document.getElementById('cargar-ejemplo');
      if (cargar) cargar.click();
    }
    const importe = document.getElementById('pago-importe');
    if (importe) importe.focus({ preventScroll: true });
  }

  acceso.addEventListener('submit', function (evento) {
    evento.preventDefault();
    const nombre = inputNombre.value.trim();
    if (nombre === '') {
      inputNombre.setCustomValidity('Escribe tu nombre para entrar.');
      inputNombre.reportValidity();
      inputNombre.addEventListener('input', function () { inputNombre.setCustomValidity(''); }, { once: true });
      return;
    }
    entrar(nombre, false);
  });

  botonEjemplo.addEventListener('click', function () { entrar('José', true); });

  // Cualquier enlace con data-entrar-ejemplo (p. ej. "Pruébalo como José") entra directamente
  document.querySelectorAll('[data-entrar-ejemplo]').forEach(function (enlace) {
    enlace.addEventListener('click', function () {
      if (!leerUsuario()) entrar('José', true);
    });
  });

  document.getElementById('sesion-salir').addEventListener('click', function () {
    guardarUsuario(null);
    mostrar();
    inputNombre.value = '';
    inputNombre.focus();
  });

  mostrar();
})();
