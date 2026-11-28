/* =========================================================================
   CashMates · desplegables.js
   El historial y la meta de ahorro salen cerrados; al pulsar su título
   se abren o se cierran. No toca app.js: solo pone o quita la clase
   "plegada" en la tarjeta (el CSS se encarga de esconder el contenido).
   Se escucha en la tarjeta y no en el título porque app.js vuelve a
   pintar el título de la meta cada vez que cambian los datos.
   ========================================================================= */

(function () {
  ['historial', 'meta'].forEach(function (id) {
    const tarjeta = document.getElementById(id);
    if (!tarjeta) return;

    tarjeta.classList.add('desplegable', 'plegada');

    tarjeta.addEventListener('click', function (evento) {
      if (evento.target.closest('h3')) tarjeta.classList.toggle('plegada');
    });
  });
})();
