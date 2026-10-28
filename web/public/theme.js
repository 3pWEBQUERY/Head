// Setzt das Farbschema vor dem ersten Rendern, damit nichts aufblitzt.
(function () {
  var t = null;
  try { t = localStorage.getItem('lapis-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < m.length; i++) { m[i].setAttribute('content', t === 'dark' ? '#0D0F14' : '#F7F4F0'); m[i].removeAttribute('media'); }
})();
