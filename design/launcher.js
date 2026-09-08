/* Shared BIOS Launcher shell: clock/format setting, corner HUD, toast,
   gamepad dispatch, list navigation, and back navigation.
   Included by index.html, games.html, settings.html, about.html. */
(() => {
  const Bios = (window.Bios = {});
  const KEY_FMT = "bios.clockFormat";

  /* ---- clock format (persisted 24h / 12h) ---- */
  const clock = (Bios.clock = {
    get() {
      try {
        return localStorage.getItem(KEY_FMT) === "12h" ? "12h" : "24h";
      } catch {
        return "24h";
      }
    },
    set(v) {
      const fmt = v === "12h" ? "12h" : "24h";
      try {
        localStorage.setItem(KEY_FMT, fmt);
      } catch {}
      document.dispatchEvent(
        new CustomEvent("bios:clockchange", { detail: fmt }),
      );
    },
    toggle() {
      this.set(this.get() === "12h" ? "24h" : "12h");
    },
    label() {
      return this.get() === "12h" ? "12-Hour (AM/PM)" : "24-Hour";
    },
    parts(d = new Date()) {
      const p = (n) => String(n).padStart(2, "0");
      const date = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${
        p(d.getDate())
      }`;
      let time;
      if (this.get() === "12h") {
        const h = d.getHours();
        time = `${p(h % 12 || 12)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${
          h < 12 ? "AM" : "PM"
        }`;
      } else {
        time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      }
      return { date, time, hour: d.getHours() };
    },
  });

  /* ---- corner date/time: toast-like fade, ticks every second ---- */
  function initCorners() {
    const corners = document.querySelector("#corners");
    if (!corners) {
      Bios.wakeCorners = () => {};
      return;
    }
    const dEl = corners.querySelector(".clock-date");
    const tEl = corners.querySelector(".clock-time");
    let timer;
    Bios.wakeCorners = () => {
      corners.classList.add("awake");
      clearTimeout(timer);
      timer = setTimeout(() => corners.classList.remove("awake"), 3200);
    };
    const tick = () => {
      const { date, time } = clock.parts();
      if (dEl) dEl.textContent = date;
      if (tEl) tEl.textContent = time;
    };
    tick();
    setInterval(tick, 1000);
    document.addEventListener("bios:clockchange", tick);
    addEventListener("pointermove", Bios.wakeCorners, { passive: true });
    Bios.wakeCorners();
  }

  /* ---- notice toast ---- */
  function initNotice() {
    const n = document.querySelector("#notice");
    Bios.notify = (msg) => {
      if (!n) return;
      if (msg) n.textContent = msg;
      n.classList.add("show");
      clearTimeout(Bios.notify._t);
      Bios.notify._t = setTimeout(() => n.classList.remove("show"), 1400);
      Bios.wakeCorners();
    };
  }

  /* ---- gamepad: one poll loop, fan out to registered handlers ---- */
  const padHandlers = { up: [], down: [], cross: [], circle: [], triangle: [] };
  const PAD_BTN = { up: 12, down: 13, cross: 0, circle: 1, triangle: 3 };
  Bios.onPad = (btn, fn) => padHandlers[btn] && padHandlers[btn].push(fn);
  let padPrev = {};
  function pollPad() {
    const pad = navigator.getGamepads &&
      [...navigator.getGamepads()].find(Boolean);
    if (pad) {
      const state = {};
      for (const k in PAD_BTN) state[k] = !!pad.buttons[PAD_BTN[k]]?.pressed;
      for (const k in state) {
        if (state[k] && !padPrev[k]) padHandlers[k].forEach((fn) => fn());
      }
      padPrev = state;
    }
    requestAnimationFrame(pollPad);
  }

  /* ---- keyboard + gamepad list navigation ---- */
  Bios.listNav = (selector, { onActivate, onMove } = {}) => {
    const els = [...document.querySelectorAll(selector)];
    if (!els.length) return null;
    let i = Math.max(0, els.findIndex((e) => e.classList.contains("active")));
    const sync = () =>
      els.forEach((e, n) => e.classList.toggle("active", n === i));
    const move = (d) => {
      i = (i + d + els.length) % els.length;
      sync();
      onMove && onMove(els[i], i);
      Bios.wakeCorners();
    };
    const fire = () => onActivate && onActivate(els[i], i);
    els.forEach((e, n) =>
      e.addEventListener("click", () => {
        i = n;
        sync();
        fire();
      })
    );
    addEventListener("keydown", (e) => {
      Bios.wakeCorners();
      if (e.key === "ArrowDown") {
        move(1);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        move(-1);
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === "x" || e.key === "X") fire();
    });
    Bios.onPad("down", () => move(1));
    Bios.onPad("up", () => move(-1));
    Bios.onPad("cross", fire);
    sync();
    onMove && onMove(els[i], i);
    return {
      get index() {
        return i;
      },
      move,
      fire,
      els,
    };
  };

  /* ---- back navigation via <body data-back="..."> ---- */
  function initBack() {
    const target = document.body.dataset.back;
    if (!target) return;
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        location.href = target;
      }
    });
    Bios.onPad("circle", () => {
      location.href = target;
    });
  }

  addEventListener("DOMContentLoaded", () => {
    initCorners();
    initNotice();
    initBack();
    pollPad();
  });
})();
