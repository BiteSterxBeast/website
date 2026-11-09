(function () {
  "use strict";

  /* =====================================================================
     GOOGLE FORMS SETUP: fill these in once the forms exist.
     - action:  the form's link with "viewform" changed to "formResponse"
     - entry.*: field IDs from the form's "Get pre-filled link"
     - csv:     the response sheet, File > Share > Publish to web > CSV
     Anything still saying PASTE keeps the page in preview mode.
     ===================================================================== */
  var CONFIG = {
    memory: {
      action:  "https://docs.google.com/forms/d/e/1FAIpQLSdDPqfYQd69Q_Dnz3l2tv9YeFBlRicogiM8KtrCW0ITz5KDoQ/formResponse",
      viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdDPqfYQd69Q_Dnz3l2tv9YeFBlRicogiM8KtrCW0ITz5KDoQ/viewform",
      nameField: "entry.21028733",
      textField: "entry.1093168780",
      csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQGcqTcfjVIwiO_v-KPiQbvA0LLLXZblczMjMGXKoSOkxswEpS4YhUX8hgvxDOJX9lTBpZwm-gCsdaD/pub?gid=615825495&single=true&output=csv"
    },
    photo: {   // Form 3: name + photo upload + optional memory (needs Google sign-in)
      viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLScji-bZYxpqD9mlubOj-3CBNRKDo7IFK6G1kAQ6GJN7nrgdfQ/viewform",
      nameField: "entry.1441576275",
      titleField: "entry.563567713",
      textField: "entry.481140223",
      csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRhi_HnD9PDhYlUTpYmUnFVQetG2IpYB7aWtWR7qo4spMPxc_ucTqq2AANmQDnhCUdV3_8yseDlxKlJ/pub?gid=1080675191&single=true&output=csv"
    },
    candle: {
      action:  "https://docs.google.com/forms/d/e/1FAIpQLSdXDJqT0vHPb66TXbF1hiiLwu73EiNtqHE0Arfr8khKtmQ5Iw/formResponse",
      nameField: "entry.1441576275",
      csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfJNISyMt6jq0S8rJkQxQJCti8zIp_D3LTbKAzOM-jwy3Oi90uQKAJzUbNRSppQmL9a0AvaQppu4iG/pub?gid=2088502476&single=true&output=csv"
    },
    reactions: {   // Form 4: Memory + Action (Like/Unlike) + Visitor
      action: "https://docs.google.com/forms/d/e/1FAIpQLSc_7oLmffYkn9qz5t9RXBWTX9eHY40Wje1BkAx_b9aln24hhw/formResponse",
      memoryField: "entry.1098573537",
      actionField: "entry.2119044638",
      visitorField: "entry.1415699998",
      csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRXHsRoCdHxu8a53FF86Fn8IBp-cL1lLoiXBk24RWOoSh1F_fYH4D6Dsml3Vqe3VnXIM-KwO1WviWSc/pub?gid=1845567372&single=true&output=csv"
    },
    requireApproval: false,  // false = show everything except rows ticked in the Hide column
    refreshSeconds: 60
  };
  var PREVIEW = /PASTE/.test([CONFIG.memory.csv, CONFIG.memory.nameField, CONFIG.photo.csv, CONFIG.photo.viewUrl, CONFIG.candle.csv, CONFIG.candle.nameField].join(" "));

  var $ = function (id) { return document.getElementById(id); };
  var PHOTOS_PAGE = document.documentElement.getAttribute("data-page") === "photos";
  var HOME_LIMIT = 6;   // photos shown in Moments on the main page
  function on(id, ev, fn, opt) { var n = $(id); if (n) n.addEventListener(ev, fn, opt); }
  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i]; if (c == null) continue;
      n.append(c.nodeType ? c : document.createTextNode(c));
    }
    return n;
  }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) {}
    return null;
  }
  function clean(s, max) { return String(s == null ? "" : s).trim().slice(0, max); }


  /* ---------- Language (English / Spanish) ---------- */
  var T = {
    en: {
      title: "Remembering Abby", titlePhotos: "Moments · Remembering Abby",
      heroAlt: "Abby smiling in her kitchen with a hand on her hip",
      heroDate: "November 9, 2026",
      footer: "Remembering Abby · 11/8/2026",
      switchTo: "Español",
      galleryShowing: "Showing {0} of {1} photos. Tap one to see it larger.",
      galleryAll: "{0} photos. Tap one to see it larger.", galleryOne: "1 photo. Tap it to see it larger.",
      seeAll: "See all {0} pictures →", seeSome: "See the pictures →",
      openPhotoOf: "Open photo {0} of {1}", sharedBy: "Shared by {0}",
      candlesAria: "Candles lit for Abby", noCandleAria: "No candle lit yet",
      candleBy: "Candle lit by {0}", candleAnon: "A candle lit by someone who loved her",
      noCandles: "No candles lit yet. Light the first one.", candle1: "1 candle lit", candleN: "{0} candles lit",
      seeNames: "See all {0} names", candleLit: "Your candle is lit", lightCandle: "Light a candle",
      candlesErr: "Can't show the candles right now.", lighting: "Lighting…", candleThanks: "Your candle is lit. Thank you.",
      sendErr: "That didn't go through. Check your connection and try again.",
      quiet1: "Plus 1 candle lit without a name.", quietN: "Plus {0} candles lit without a name.",
      closeList: "Close list", viewer: "Photo viewer", closePhoto: "Close photo", prevPhoto: "Previous photo", nextPhoto: "Next photo",
      likeMemory: "Like this memory", likePhoto: "Like this photo",
      like0: "Be the first to like this", like1: "1 like", likeN: "{0} likes",
      photoBy: "Photo shared by {0}", visitor: "a visitor", friend: "A friend",
      openPhotoBy: "Open photo shared by {0}. Double-tap to like.",
      openPhotoN: "Open photo {0}. Double-tap to like.", openPhotoNBy: "Open photo {0}, shared by {1}. Double-tap to like.",
      noMemories: "No memories here yet. The first one shared will appear for everyone who visits.",
      moreMemories: "Show more memories", memErr: "Can't show the memories right now.",
      photoCount1: "1 photo. Tap it to see it larger and how many likes it has.",
      photoCountN: "{0} photos. Tap one to see it larger and how many likes it has.",
      needName: "Please add your name so people know who this is from.",
      needText: "Write a few words first, or use Add a photo to send a picture.",
      sharing: "Sharing…", thanksSoon: "Thank you. Your memory will appear here in a few minutes.",
      thanksReview: "Thank you. Your memory will appear here once the family has read it."
    },
    es: {
      title: "Recordando a Abby", titlePhotos: "Momentos · Recordando a Abby",
      heroAlt: "Abby sonriendo en su cocina con una mano en la cadera",
      heroEyebrow: "Con amor, en memoria de", heroDate: "9 de noviembre de 2026",
      lede: "Esta página guarda las fotos y las historias de quienes la amaron. Agrega una foto, escribe un recuerdo o enciende una vela.",
      ctaShare: "Compartir un recuerdo", ctaCandle: "Encender una vela", ctaContrib: "Ver contribuciones",
      momentsH: "Momentos", galleryHint: "Toca una foto para verla más grande.", seeMore: "Ver más fotos →",
      candleH: "Enciende una vela", candleSub: "Cada llama es alguien que hoy piensa en Abby.",
      candleLoading: "Cargando velas…", candleNameLabel: "Tu nombre (opcional)",
      memoriesH: "Recuerdos", memoriesSub: "Escribe lo que recuerdas y agrega una foto si tienes una. Todos los que visiten podrán leer lo que compartas.",
      nameLabel: "Tu nombre", memoryLabel: "Tu recuerdo",
      memoryPh: "Una historia, algo que ella siempre decía, lo que significó para ti",
      addPhoto: "Agregar una foto a este recuerdo",
      photoHint: "Las fotos se envían por Google Forms, que te pide iniciar sesión en Google. Tu nombre y tu recuerdo se copian allí, para que se publiquen juntos.",
      shareBtn: "Compartir este recuerdo", memLoading: "Cargando recuerdos…",
      contribEyebrow: "Hecho con amor", contribH: "Contribuciones",
      roleAlyah: "Aportó las fotos, las ideas y el concepto",
      quoteAlyah: "Este sitio web es un lugar especial en memoria de mi abuela. Se me ocurrió la idea del sitio y creé el concepto, y con la ayuda de mi primo hicimos realidad la visión. Aquí podemos compartir todo lo que amamos y atesoramos de nuestra dulce Abby. Gracias por visitar este lugar especial para un alma especial. 🌻",
      roleJJ: "Programó el sitio web y sus interacciones, y aportó el dominio",
      quoteJJ: "Amo muchísimo a Abby. Cuando me contaron la idea de hacer un sitio web para ella y su memoria, dije que sí al instante y aporté mis ideas. Me alegra que me hayan invitado a trabajar en este proyecto. Que descanse con Dios. ❤️🕊️",
      footer: "Recordando a Abby · 8 de noviembre de 2026",
      namesTitle: "Velas encendidas por Abby",
      back: "← Volver a la página de Abby", photosEyebrow: "Recordando a Abby", photosLoading: "Cargando fotos…", morePhotos: "Ver más fotos",
      switchTo: "English",
      galleryShowing: "Mostrando {0} de {1} fotos. Toca una para verla más grande.",
      galleryAll: "{0} fotos. Toca una para verla más grande.", galleryOne: "1 foto. Tócala para verla más grande.",
      seeAll: "Ver las {0} fotos →", seeSome: "Ver las fotos →",
      openPhotoOf: "Abrir foto {0} de {1}", sharedBy: "Compartida por {0}",
      candlesAria: "Velas encendidas por Abby", noCandleAria: "Aún no hay velas encendidas",
      candleBy: "Vela encendida por {0}", candleAnon: "Una vela encendida por alguien que la amó",
      noCandles: "Aún no hay velas encendidas. Enciende la primera.", candle1: "1 vela encendida", candleN: "{0} velas encendidas",
      seeNames: "Ver los {0} nombres", candleLit: "Tu vela está encendida", lightCandle: "Encender una vela",
      candlesErr: "No se pueden mostrar las velas en este momento.", lighting: "Encendiendo…", candleThanks: "Tu vela está encendida. Gracias.",
      sendErr: "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.",
      quiet1: "Más 1 vela encendida sin nombre.", quietN: "Más {0} velas encendidas sin nombre.",
      closeList: "Cerrar lista", viewer: "Visor de fotos", closePhoto: "Cerrar foto", prevPhoto: "Foto anterior", nextPhoto: "Foto siguiente",
      likeMemory: "Me gusta este recuerdo", likePhoto: "Me gusta esta foto",
      like0: "Sé el primero en dar me gusta", like1: "1 me gusta", likeN: "{0} me gusta",
      photoBy: "Foto compartida por {0}", visitor: "un visitante", friend: "Un ser querido",
      openPhotoBy: "Abrir foto compartida por {0}. Toca dos veces para dar me gusta.",
      openPhotoN: "Abrir foto {0}. Toca dos veces para dar me gusta.", openPhotoNBy: "Abrir foto {0}, compartida por {1}. Toca dos veces para dar me gusta.",
      noMemories: "Aún no hay recuerdos. El primero que se comparta aparecerá para todos los que visiten.",
      moreMemories: "Ver más recuerdos", memErr: "No se pueden mostrar los recuerdos en este momento.",
      photoCount1: "1 foto. Tócala para verla más grande y ver cuántos me gusta tiene.",
      photoCountN: "{0} fotos. Toca una para verla más grande y ver cuántos me gusta tiene.",
      needName: "Agrega tu nombre para que sepan de quién es.",
      needText: "Escribe unas palabras primero, o usa «Agregar una foto» para enviar una imagen.",
      sharing: "Compartiendo…", thanksSoon: "Gracias. Tu recuerdo aparecerá aquí en unos minutos.",
      thanksReview: "Gracias. Tu recuerdo aparecerá aquí cuando la familia lo haya leído."
    }
  };
  var LANG = "en";
  function t(k, a, b) {
    var s = T[LANG][k]; if (s == null) s = T.en[k]; if (s == null) return k;
    return s.replace("{0}", a).replace("{1}", b);
  }
  function altOf(it) { return LANG === "es" && it.altEs ? it.altEs : it.alt; }
  /* "Lit by A, B and C, plus 2 more." in the chosen language */
  function litByLine(named, rest) {
    if (!named.length) return "";
    if (LANG === "es") {
      var parts = named.concat(rest > 0 ? [rest + " más"] : []), last = parts[parts.length - 1];
      var and = /^h?i(?!e)/i.test(last) ? " e " : " y ";
      return (parts.length > 1 ? "Encendidas por " + parts.slice(0, -1).join(", ") + and + last : "Encendida por " + last) + ".";
    }
    var line = "Lit by " + (named.length === 1 ? named[0] : named.slice(0, -1).join(", ") + " and " + named[named.length - 1]);
    if (rest > 0) line += (named.length === 1 ? " and " : ", plus ") + rest + " more";
    return line + ".";
  }
  /* Text that sits in the page itself: English is read from the HTML, Spanish from T.es */
  function applyStatic() {
    document.documentElement.lang = LANG;
    document.title = t(PHOTOS_PAGE ? "titlePhotos" : "title");
    [["data-i18n", "textContent"], ["data-i18n-ph", "placeholder"], ["data-i18n-aria", "aria-label"], ["data-i18n-alt", "alt"]].forEach(function (pair) {
      document.querySelectorAll("[" + pair[0] + "]").forEach(function (n) {
        var k = n.getAttribute(pair[0]), isProp = pair[1] === "textContent";
        if (!(k in T.en)) T.en[k] = isProp ? n.textContent : n.getAttribute(pair[1]);
        if (isProp) n.textContent = t(k); else n.setAttribute(pair[1], t(k));
      });
    });
    var sw = $("lang-switch"); if (sw) { sw.textContent = t("switchTo"); sw.setAttribute("lang", LANG === "es" ? "en" : "es"); }
  }
  var candleState = "", memState = "";
  function setLang(l, quiet) {
    LANG = l === "es" ? "es" : "en";
    store("abby-lang", LANG);
    applyStatic();
    if (quiet) return;
    ["m-status", "candle-status"].forEach(function (id) { if ($(id)) $(id).textContent = ""; });
    gallerySig = "";
    if (!PHOTOS_PAGE) {
      if (candleState === "ok") renderCandles(); else if (candleState === "err") $("candle-count").textContent = t("candlesErr");
    }
    if (memState === "ok") renderWall();
    else { renderGallery(); if (PHOTOS_PAGE) renderPhotoWall(); if (memState === "err") showMemErr(); }
    if (!$("lb").hidden) showLb();
    var nd = $("names-dlg"); if (nd && nd.open) openNames();
  }
  function showMemErr() { var w = $("wall"); if (w) w.replaceChildren(el("p", { class: "notice", text: t("memErr") })); }

  /* ---------- Photos that ship with the page ---------- */
  var seeded = [
    { key: "s0", src: "img/p7.jpg", alt: "Abby smiling beside a man with glasses in a yellow room", altEs: "Abby sonriendo junto a un hombre con lentes en una habitación amarilla", by: "" },
    { key: "s1", src: "img/p6.jpg", alt: "Abby smiling by a sunny window in a floral top", altEs: "Abby sonriendo junto a una ventana soleada con una blusa de flores", by: "" },
    { key: "s2", src: "img/p4.jpg", alt: "Abby leaning in for a selfie with a woman in a patterned blouse", altEs: "Abby acercándose para una selfie con una mujer de blusa estampada", by: "" },
    { key: "s3", src: "img/p3.jpg", alt: "Abby and another woman in black tops smiling together", altEs: "Abby y otra mujer con blusas negras sonriendo juntas", by: "" },
    { key: "s4", src: "img/p5.jpg", alt: "Abby smiling and cuddling with a young boy", altEs: "Abby sonriendo y abrazando a un niño pequeño", by: "" },
    { key: "s5", src: "img/p2.jpg", alt: "Abby with three family members in a group selfie", altEs: "Abby con tres familiares en una selfie de grupo", by: "" },
    { key: "s6", src: "img/p1.jpg", alt: "Abby with two small children at a party", altEs: "Abby con dos niños pequeños en una fiesta", by: "" }
  ];
  seeded.forEach(function (s) { s.likeKey = "s" + s.key; });
  var visitor = [], items = seeded.slice(), gallerySig = "";
  function renderGallery() {
    items = seeded.concat(visitor);
    var sig = items.map(function (i) { return i.key; }).join("|");
    if (sig === gallerySig) return;
    gallerySig = sig;
    var g = $("gallery");
    if (!g) return;
    var shown = items.slice(0, HOME_LIMIT);
    g.replaceChildren.apply(g, shown.map(function (it, i) {
      return el("button", { class: "tile", type: "button", "aria-label": t("openPhotoOf", i + 1, items.length), onclick: function () { openLb(i); } },
        driveFallback(el("img", { src: it.src, alt: altOf(it), loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" })));
    }));
    $("gallery-count").textContent = items.length > HOME_LIMIT ? t("galleryShowing", HOME_LIMIT, items.length)
      : items.length === 1 ? t("galleryOne") : t("galleryAll", items.length);
    var more = $("see-more");
    if (more) more.textContent = items.length > HOME_LIMIT ? t("seeAll", items.length) : t("seeSome");
  }

  /* ---------- Lightbox ---------- */
  var lbIndex = 0, lbOpener = null, touchX = null;
  function showLb() {
    var it = items[lbIndex]; if (!it) return;
    $("lb-img").dataset.try = 0; $("lb-img").src = it.src; $("lb-img").alt = altOf(it);
    $("lb-cap").textContent = it.by ? t("sharedBy", it.by) : "";
    var lr = $("lb-react");
    if (lr) { var r = reactRow({ id: it.key, time: "", name: it.by, photo: it.src, text: "" }, it.likeKey); lr.replaceChildren(r.row); }
    $("lb-prev").hidden = $("lb-next").hidden = items.length < 2;
  }
  function openLb(i) { lbOpener = document.activeElement; lbIndex = i; showLb(); $("lb").hidden = false; document.documentElement.style.overflow = "hidden"; $("lb-close").focus(); }
  function closeLb() { $("lb").hidden = true; document.documentElement.style.overflow = ""; if (lbOpener && lbOpener.focus) lbOpener.focus(); }
  function stepLb(d) { lbIndex = (lbIndex + d + items.length) % items.length; showLb(); }
  $("lb-close").addEventListener("click", closeLb);
  $("lb-prev").addEventListener("click", function () { stepLb(-1); });
  $("lb-next").addEventListener("click", function () { stepLb(1); });
  $("lb").addEventListener("click", function (e) { if (e.target === $("lb")) closeLb(); });
  $("lb").addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  $("lb").addEventListener("touchend", function (e) {
    if (touchX == null) return;
    var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if ($("lb").hidden) return;
    if (e.key === "Escape") closeLb(); else if (e.key === "ArrowLeft") stepLb(-1); else if (e.key === "ArrowRight") stepLb(1);
  });

  /* ---------- Google Sheets (CSV) reading ---------- */
  function parseCsv(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  function toObjects(rows, prefix) {
    prefix = prefix || "r";
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.toLowerCase(); });
    function col(word) { return head.findIndex(function (h) { return h.indexOf(word) >= 0; }); }
    var c = { title: col("title"), time: col("timestamp"), name: col("name"), text: (col("memory") >= 0 ? col("memory") : col("message")), photo: col("photo"), ok: col("approved"), hide: col("hide") };
    return rows.slice(1).map(function (r, i) {
      function g(k) { return c[k] >= 0 ? (r[c[k]] || "") : ""; }
      return { id: prefix + i, title: clean(g("title"), 100), time: g("time"), name: clean(g("name"), 60), text: clean(g("text"), 1500), photo: drivePhoto(g("photo")), approved: /^\s*(yes|y|true|x)\s*$/i.test(g("ok")), hidden: /^\s*(yes|y|true|x)\s*$/i.test(g("hide")) };
    });
  }
  function drivePhoto(link) {
    var m = String(link || "").match(/[?&]id=([\w-]+)|\/d\/([\w-]+)/);
    var id = m && (m[1] || m[2]);
    return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200" : (/^img\//.test(link) ? link : null);
  }
  function driveFallback(img) {
    var m = img.src.match(/[?&]id=([\w-]+)|\/d\/([\w-]+)/), id = m && (m[1] || m[2]);
    var tries = id ? ["https://drive.google.com/thumbnail?id=" + id + "&sz=w1200", "https://lh3.googleusercontent.com/d/" + id + "=w1200", "https://drive.google.com/uc?export=view&id=" + id] : [];
    img.addEventListener("error", function () {
      var n = Number(img.dataset.try || 0) + 1;
      img.dataset.try = n;
      if (n < tries.length) img.src = tries[n];
      else { var box = img.closest(".photo, .tile"); if (box) box.hidden = true; }
    });
    return img;
  }
  function fetchCsv(url, prefix) {
    return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now()).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    }).then(function (t) { return toObjects(parseCsv(t), prefix); });
  }

  /* ---------- Sending to Google Forms ---------- */
  function sendForm(action, fields) {
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) { body.append(k, fields[k]); });
    if (PREVIEW) return new Promise(function (r) { setTimeout(r, 600); });
    // Google doesn't let pages read the reply, so a sent request counts as done.
    return fetch(action, { method: "POST", mode: "no-cors", body: body });
  }

  /* ---------- Sample data for preview mode ---------- */
  var SAMPLE = {
    memories: [
      { id: "d1", time: "11/9/2026 9:12:00", name: "Sample: a cousin", text: "This is where a memory will show up once someone sends one through the form. A story, something she always said, what she meant to them.", photo: null, approved: true },
      { id: "d2", time: "11/9/2026 8:40:00", name: "Sample: a friend", text: "A Title On The First Line\nIf the first line of a memory is short, it shows as a heading like the one above. Photo posts come from the photo form, and the memory written with it shows on the same card, under the picture.", photo: "img/p3.jpg", approved: true },
      { id: "d3", time: "11/9/2026 8:05:00", name: "Not approved yet", text: "You won't see this one, because it hasn't been approved in the sheet.", photo: null, approved: false }
    ],
    candles: [{ name: "Sample name" }, { name: "" }, { name: "Another name" }, { name: "" }, { name: "" }]
  };

  /* ---------- Candles ---------- */
  var candles = [], localCandle = store("abby-candle") === "1";
  function flameSvg() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 14 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M7 0C7 7 1 10 1 17a6 6 0 0 0 12 0C13 12 9.500 9.500 7 0Z");
    s.appendChild(p); return s;
  }
  function renderCandles(freshLast) {
    var box = $("flames"), shown = candles.slice(0, 36), n = candles.length;
    if (!n) {
      box.replaceChildren(el("div", { class: "candle unlit", role: "listitem", "aria-label": t("noCandleAria") }, flameSvg(), el("div", { class: "wick" }), el("div", { class: "wax" })));
    } else {
      box.replaceChildren.apply(box, shown.map(function (c, i) {
        var node = el("div", { class: "candle" + (freshLast && i === 0 ? " fresh" : ""), role: "listitem", title: c.name || "",
          "aria-label": c.name ? t("candleBy", c.name) : t("candleAnon") }, flameSvg(), el("div", { class: "wick" }), el("div", { class: "wax" }));
        node.style.setProperty("--d", (-((i * 0.37) % 2.6)).toFixed(2) + "s");
        return node;
      }));
    }
    $("flames").setAttribute("aria-label", t("candlesAria"));
    $("candle-count").textContent = n === 0 ? t("noCandles") : n === 1 ? t("candle1") : t("candleN", n);
    var named = candles.filter(function (c) { return c.name; }).slice(0, 3).map(function (c) { return c.name; });
    $("candle-names").textContent = litByLine(named, n - named.length);
    var allNamed = candles.filter(function (c) { return c.name; });
    $("names-btn").hidden = allNamed.length <= 3;
    $("names-btn").textContent = t("seeNames", allNamed.length);
    $("candle-btn").disabled = localCandle;
    $("candle-btn").textContent = localCandle ? t("candleLit") : t("lightCandle");
  }
  function loadCandles() {
    if (PREVIEW) { if (!candles.length) candles = SAMPLE.candles.slice(); renderCandles(); return Promise.resolve(); }
    return fetchCsv(CONFIG.candle.csv).then(function (rows) {
      candles = rows.reverse().map(function (r) { return { name: r.name }; });
      candleState = "ok";
      renderCandles();
    }).catch(function () { if (candleState !== "ok") { candleState = "err"; $("candle-count").textContent = t("candlesErr"); } });
  }
  on("candle-form", "submit", function (e) {
    e.preventDefault();
    if (localCandle) return;
    var name = clean($("candle-name").value, 60);
    if (name) store("abby-name", name);
    $("candle-btn").disabled = true; $("candle-status").textContent = t("lighting");
    var f = {}; f[CONFIG.candle.nameField] = name;
    sendForm(CONFIG.candle.action, f).then(function () {
      localCandle = true; store("abby-candle", "1");
      candles.unshift({ name: name });
      renderCandles(true);
      $("candle-status").textContent = t("candleThanks");
    }).catch(function () {
      $("candle-btn").disabled = false;
      $("candle-status").textContent = t("sendErr");
    });
  });

  /* Full list of candle names */
  function openNames() {
    var named = candles.filter(function (c) { return c.name; });
    var list = $("nd-list");
    list.replaceChildren.apply(list, named.map(function (c) { return el("li", { text: c.name }); }));
    var quiet = candles.length - named.length;
    $("nd-foot").textContent = quiet > 1 ? t("quietN", quiet) : quiet === 1 ? t("quiet1") : "";
    var d = $("names-dlg");
    if (d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  function closeNames() { var d = $("names-dlg"); if (d.close) d.close(); else d.removeAttribute("open"); }
  on("names-btn", "click", openNames);
  on("nd-close", "click", closeNames);
  on("names-dlg", "click", function (e) { if (e.target === this) closeNames(); });

  /* ---------- Likes ---------- */
  var visitorId = store("abby-visitor");
  if (!visitorId) { visitorId = "v" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); store("abby-visitor", visitorId); }
  var serverLikes = {}, myLikes = {};
  try { myLikes = JSON.parse(store("abby-likes") || "{}") || {}; } catch (e) { myLikes = {}; }
  function memKey(m) {
    var s = m.id.charAt(0) + "|" + m.time + "|" + m.name, h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return m.id.charAt(0) + (h >>> 0).toString(36);
  }
  function likeState(k) {
    var v = serverLikes[k] || {}, n = 0;
    Object.keys(v).forEach(function (id) { if (id !== visitorId && v[id]) n++; });
    var mine = Object.prototype.hasOwnProperty.call(myLikes, k) ? !!myLikes[k] : !!v[visitorId];
    return { n: n + (mine ? 1 : 0), mine: mine };
  }
  var likeListeners = {};
  function onLikeChange(k, fn) { (likeListeners[k] = likeListeners[k] || []).push(fn); }
  function setLike(k, on) {
    myLikes[k] = on; store("abby-likes", JSON.stringify(myLikes));
    (likeListeners[k] || []).forEach(function (fn) { try { fn(); } catch (e) {} });
    var R = CONFIG.reactions, f = {};
    f[R.memoryField] = k; f[R.actionField] = on ? "Like" : "Unlike"; f[R.visitorField] = visitorId;
    sendForm(R.action, f).catch(function () {});
  }
  function heartSvg() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12 20.6s-7.2-4.4-9.4-8.9C1 8.4 2.9 4.6 6.5 4.6c2.2 0 3.7 1.3 4.5 2.7L12 8.8l1-1.5c.8-1.4 2.3-2.7 4.5-2.7 3.6 0 5.5 3.8 3.9 7.1-2.2 4.5-9.4 8.9-9.4 8.9z");
    s.appendChild(p); return s;
  }
  function reactRow(m, key) {
    var k = key || memKey(m);
    var btn = el("button", { class: "heart", type: "button", "aria-label": t("likeMemory") }, heartSvg());
    var cnt = el("span", { class: "likes" });
    function paint(pop) {
      var st = likeState(k);
      btn.classList.toggle("on", st.mine); btn.setAttribute("aria-pressed", String(st.mine));
      cnt.classList.toggle("zero", st.n === 0);
      cnt.textContent = st.n === 0 ? t("like0") : st.n === 1 ? t("like1") : t("likeN", st.n);
      if (pop) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
    }
    paint(false);
    onLikeChange(k, function () { paint(false); });
    btn.addEventListener("click", function () { setLike(k, !likeState(k).mine); paint(true); });
    btn.setAttribute("aria-label", m.photo && !m.text ? t("likePhoto") : t("likeMemory"));
    return { row: el("div", { class: "react" }, btn, cnt), like: function () { if (!likeState(k).mine) setLike(k, true); paint(true); } };
  }
  function burst(box) {
    var b = el("span", { class: "burst" }); b.appendChild(heartSvg()); box.appendChild(b);
    setTimeout(function () { b.remove(); }, 950);
  }
  function loadReactions() {
    var url = CONFIG.reactions.csv;
    return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now()).then(function (r) { if (!r.ok) throw new Error(); return r.text(); }).then(function (t) {
      var rows = parseCsv(t); if (!rows.length) return;
      var head = rows[0].map(function (h) { return h.toLowerCase(); });
      var cm = head.findIndex(function (h) { return h.indexOf("memory") >= 0; }),
          ca = head.findIndex(function (h) { return h.indexOf("action") >= 0; }),
          cv = head.findIndex(function (h) { return h.indexOf("visitor") >= 0; });
      if (cm < 0 || ca < 0 || cv < 0) return;
      var next = {};
      rows.slice(1).forEach(function (r) {   // rows are oldest first, so the last one per visitor wins
        var k = (r[cm] || "").trim(), v = (r[cv] || "").trim(); if (!k || !v) return;
        (next[k] = next[k] || {})[v] = /^\s*like\s*$/i.test(r[ca] || "");
      });
      serverLikes = next;
      renderWall();
    }).catch(function () {});
  }

  /* ---------- Memories ---------- */
  var memories = [], memLimit = 12;
  function whenText(t) {
    var d = new Date(t);
    if (isNaN(d)) return "";
    var loc = LANG === "es" ? "es-US" : "en-US";
    var day = d.toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
    var hasTime = /\d:\d\d/.test(String(t));
    return hasTime ? day + " · " + d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" }) : day;
  }
  /* A short first line with more text under it (no ending period) is shown as the memory's title. */
  function splitTitle(m) {
    if (m.title) return { title: m.title, body: m.text };
    var t = m.text || "", nl = t.indexOf("\n");
    if (nl > 0) {
      var first = t.slice(0, nl).trim(), rest = t.slice(nl + 1).trim();
      if (rest && first.length <= 70 && !/[.,;]$/.test(first)) return { title: first, body: rest };
    }
    return { title: "", body: t };
  }
  function renderWall() {
    likeListeners = {};
    if (!$("lb").hidden) setTimeout(showLb, 0);
    var list = memories.filter(function (m) { return !m.hidden && (!CONFIG.requireApproval || m.approved); })
                       .filter(function (m) { return m.text || m.photo; });
    visitor = list.filter(function (m) { return m.photo; }).map(function (m) {
      return { key: m.id, likeKey: memKey(m), src: m.photo, alt: t("photoBy", m.name || t("visitor")), altEs: "", by: m.name || "" };
    });
    renderGallery();
    if (PHOTOS_PAGE) { renderPhotoWall(); return; }
    var wall = $("wall");
    if (!wall) return;
    if (!list.length) { wall.replaceChildren(el("p", { class: "notice", text: t("noMemories") })); return; }
    var cards = list.slice(0, memLimit).map(function (m) {
      var kids = [el("div", { class: "card-head" }, el("strong", { text: m.name || t("friend") }), el("time", { text: whenText(m.time) }))];
      var react = reactRow(m), tapTimer = null;
      if (m.photo) kids.push(el("button", { class: "photo", type: "button", "aria-label": t("openPhotoBy", m.name || t("visitor")),
        onclick: function () {
          var box = this;
          if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; react.like(); burst(box); return; }
          tapTimer = setTimeout(function () { tapTimer = null; var ix = items.findIndex(function (i) { return i.key === m.id; }); if (ix >= 0) openLb(ix); }, 260);
        } },
        driveFallback(el("img", { src: m.photo, alt: t("photoBy", m.name || t("visitor")), loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" }))));
      if (m.photo) kids.push(react.row);
      var tb = splitTitle(m);
      if (tb.title) kids.push(el("h3", { class: "title", text: tb.title }));
      if (tb.body) kids.push(el("p", { class: "msg", text: tb.body }));
      if (!m.photo) kids.push(react.row);
      return el.apply(null, ["article", { class: "card" }].concat(kids));
    });
    if (list.length > memLimit) cards.push(el("button", { class: "btn ghost more", type: "button", onclick: function () { memLimit += 12; renderWall(); } }, t("moreMemories")));
    wall.replaceChildren.apply(wall, cards);
  }
  /* The "Moments" page: just the pictures, with a small heart in the corner */
  var photoLimit = 30;
  function miniHeart(k) {
    var b = el("button", { class: "mini-heart", type: "button", "aria-label": t("likePhoto") }, heartSvg());
    function paint(pop) {
      var on = likeState(k).mine;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
      if (pop) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    }
    paint(false);
    onLikeChange(k, function () { paint(true); });
    b.addEventListener("click", function (e) { e.stopPropagation(); setLike(k, !likeState(k).mine); });
    return b;
  }
  function photoTile(it, ix) {
    var tapTimer = null;
    var photo = el("button", { class: "photo", type: "button", "aria-label": it.by ? t("openPhotoNBy", ix + 1, it.by) : t("openPhotoN", ix + 1),
      onclick: function () {
        var box = this.parentNode;
        if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; if (!likeState(it.likeKey).mine) setLike(it.likeKey, true); burst(box); return; }
        tapTimer = setTimeout(function () { tapTimer = null; openLb(ix); }, 260);
      } }, driveFallback(el("img", { src: it.src, alt: altOf(it), loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" })));
    return el("div", { class: "ptile" }, photo, miniHeart(it.likeKey));
  }
  function renderPhotoWall() {
    var wall = $("photo-wall"); if (!wall) return;
    var tiles = items.slice(0, photoLimit).map(photoTile);
    wall.replaceChildren.apply(wall, tiles);
    var more = $("photo-more");
    more.hidden = items.length <= photoLimit;
    $("photo-count").textContent = items.length === 1 ? t("photoCount1") : t("photoCountN", items.length);
  }
  function loadMemories() {
    if (PREVIEW) { memories = SAMPLE.memories; renderWall(); return Promise.resolve(); }
    // Text-only memories (Form 1) and photo posts (Form 3) are merged and shown newest first.
    return Promise.all([
      fetchCsv(CONFIG.memory.csv, "m").catch(function () { return null; }),
      fetchCsv(CONFIG.photo.csv, "p").catch(function () { return null; })
    ]).then(function (res) {
      if (!res[0] && !res[1]) throw new Error("both failed");
      memories = (res[0] || []).concat(res[1] || []).sort(function (a, b) { return (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0); });
      memState = "ok";
      renderWall();
    }).catch(function () { if (memState === "ok") return; memState = "err"; showMemErr(); if (PHOTOS_PAGE) renderPhotoWall(); });
  }

  /* "Add a photo" opens the Google Form with name and memory already filled in */
  function photoLink() {
    var u = CONFIG.photo.viewUrl + "?usp=pp_url";
    var n = clean($("m-name").value, 60), t = clean($("m-text").value, 1500);
    if (n) u += "&" + CONFIG.photo.nameField + "=" + encodeURIComponent(n);
    var tb = splitTitle({ text: t });
    if (tb.title) u += "&" + CONFIG.photo.titleField + "=" + encodeURIComponent(tb.title);
    if (tb.body) u += "&" + CONFIG.photo.textField + "=" + encodeURIComponent(tb.body);
    return u;
  }
  on("m-photo-btn", "click", function (e) {
    if (PREVIEW) { e.preventDefault(); $("m-status").textContent = "Preview: this opens the photo form with your name and memory already filled in, so the photo and memory post together."; return; }
    this.href = photoLink();
    if (clean($("m-name").value, 60)) store("abby-name", clean($("m-name").value, 60));
  });

  on("memory-form", "submit", function (e) {
    e.preventDefault();
    var name = clean($("m-name").value, 60), text = clean($("m-text").value, 1500);
    if (!name) { $("m-status").textContent = t("needName"); $("m-name").focus(); return; }
    if (!text) { $("m-status").textContent = t("needText"); $("m-text").focus(); return; }
    store("abby-name", name);
    $("m-submit").disabled = true; $("m-status").textContent = t("sharing");
    var f = {}; f[CONFIG.memory.nameField] = name; f[CONFIG.memory.textField] = text;
    sendForm(CONFIG.memory.action, f).then(function () {
      $("m-text").value = "";
      $("m-status").textContent = CONFIG.requireApproval
        ? t("thanksReview")
        : t("thanksSoon");
    }).catch(function () {
      $("m-status").textContent = t("sendErr");
    }).then(function () { $("m-submit").disabled = false; });
  });

  /* ---------- Start ---------- */
  var savedLang = store("abby-lang");
  var guess = /^es/i.test(navigator.language || "") ? "es" : "en";
  if (savedLang) setLang(savedLang, true); else { LANG = guess; applyStatic(); }
  on("lang-switch", "click", function () { setLang(LANG === "es" ? "en" : "es"); });
  var langDlg = $("lang-dlg");
  if (langDlg) {
    var closeLang = function () { if (langDlg.close) langDlg.close(); else langDlg.removeAttribute("open"); };
    langDlg.querySelectorAll("[data-lang]").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); closeLang(); });
    });
    langDlg.addEventListener("cancel", function () { setLang(LANG, true); });   // Esc keeps the current language
    if (!savedLang) { if (langDlg.showModal) langDlg.showModal(); else langDlg.setAttribute("open", ""); }
  }
  if ($("preview-bar")) $("preview-bar").hidden = !PREVIEW;
  if (PHOTOS_PAGE) {
    renderPhotoWall();
    on("photo-more", "click", function () { photoLimit += 30; renderPhotoWall(); });
    loadMemories().then(loadReactions);
    if (!PREVIEW) setInterval(function () { loadMemories().then(loadReactions); }, CONFIG.refreshSeconds * 1000);
  } else {
    $("m-submit").disabled = false;
    var saved = store("abby-name");
    if (saved) { $("m-name").value = saved; $("candle-name").value = saved; }
    renderGallery();
    loadCandles(); loadMemories().then(loadReactions);
    if (!PREVIEW) setInterval(function () { loadCandles(); loadMemories().then(loadReactions); }, CONFIG.refreshSeconds * 1000);
  }
})();