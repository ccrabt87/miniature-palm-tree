// Live rate check: recompute on the server as he types so the verdict updates
// without a page reload. Falls back to plain form submit if fetch fails.
(function () {
  var form = document.querySelector("[data-live-calc]");
  if (!form) return;

  var out = document.getElementById("calc-result");
  var timer = null;
  var inFlight = null;

  function run() {
    if (inFlight) inFlight.abort();
    var controller = new AbortController();
    inFlight = controller;

    fetch("/calculator/preview", {
      method: "POST",
      body: new URLSearchParams(new FormData(form)),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (h) { if (out) out.innerHTML = h; })
      .catch(function () { /* keep the last good result on screen */ });
  }

  form.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  });
})();
