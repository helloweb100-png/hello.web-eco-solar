/* =====================================================================
   ECO SOLAR MÉXICO - app.js
   Dependencias (CDN): GSAP + ScrollTrigger, Lenis. Si no cargan, la página
   sigue funcionando en "modo estático" (todo visible, sin pines ni scroll suave).

   ÍNDICE
   01 Configuración y utilidades     02 WhatsApp / pie / menú / FAQ
   03 Calculadora de ahorro          04 Formulario -> WhatsApp
   05 Videos perezosos               06 Partículas (canvas)
   07 Scroll suave (Lenis)           08 Preloader
   09 Texto dividido                 10 Intro del hero
   11 Animaciones con scroll         12 Interacciones (magnético, tilt, spotlight)
   13 Arranque
   ===================================================================== */
(() => {
    'use strict';

    /* ---------- 01 CONFIGURACIÓN Y UTILIDADES ---------- */
    const CONFIG = {
        whatsapp: '5214441306950',            // +52 1 444 130 6950
        brand: 'Eco Solar México',
        // Constantes de la calculadora. Ajústalas con el cliente: son estimaciones referenciales.
        calc: {
            tariff: 3.0,       // MXN por kWh (promedio de referencia)
            sunHours: 5.5,     // horas de sol pico por día
            performance: 0.8,  // eficiencia global del sistema
            panelWatts: 550,   // potencia por panel (LONGi 550 W)
            offset: 0.9,       // fracción del recibo que se estima ahorrar
            maxCells: 40       // paneles dibujados en la visualización
        }
    };

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const root = document.documentElement;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    const motion = hasGsap && !reduceMotion;
    if (!motion) root.classList.add('is-static');

    let lenis = null;

    const waUrl = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
    const money = (n) => '$' + Math.round(n).toLocaleString('es-MX');

    /* ---------- 02 WHATSAPP / PIE / MENÚ / FAQ ---------- */
    function bindWhatsAppLinks() {
        $$('[data-wa]').forEach((a) => {
            a.href = waUrl(a.dataset.wa);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
    }

    function setYear() {
        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();
    }

    let setMenuOpen = () => {};
    function initMenu() {
        const burger = $('#burger');
        const menu = $('#menu');
        if (!burger || !menu) return;

        setMenuOpen = (open) => {
            root.classList.toggle('menu-open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            menu.inert = !open;
            if (lenis) { open ? lenis.stop() : lenis.start(); }
            else { document.body.style.overflow = open ? 'hidden' : ''; }
        };

        burger.addEventListener('click', () => setMenuOpen(!root.classList.contains('menu-open')));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenuOpen(false); burger.focus(); }
        });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenuOpen(false); });
    }

    function initAnchors() {
        $$('a[href^="#"]').forEach((a) => {
            a.addEventListener('click', (e) => {
                const id = a.getAttribute('href');
                if (!id || id.length < 2) return;
                const target = $(id);
                if (!target) return;
                e.preventDefault();
                setMenuOpen(false);
                if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
                else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
                history.replaceState(null, '', id);
            });
        });
    }

    function initFaq() {
        $$('.faq__item').forEach((item) => {
            const btn = $('.faq__q', item);
            const panel = $('.faq__a', item);
            btn.addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                // un solo item abierto a la vez
                $$('.faq__item.is-open').forEach((other) => {
                    if (other === item) return;
                    other.classList.remove('is-open');
                    $('.faq__q', other).setAttribute('aria-expanded', 'false');
                    $('.faq__a', other).inert = true;
                });
                item.classList.toggle('is-open', open);
                btn.setAttribute('aria-expanded', String(open));
                panel.inert = !open;
                if (hasGsap) setTimeout(() => window.ScrollTrigger.refresh(), 700);
            });
        });
    }

    /* ---------- 03 CALCULADORA DE AHORRO ---------- */
    function initCalculator() {
        const form = $('#calc');
        if (!form) return;
        const range = $('#calc-bill');
        const out = $('#calc-bill-out');
        const viz = $('#calc-viz');
        const panelsEl = $('#calc-panels');
        const kwpEl = $('#calc-kwp');
        const saveEl = $('#calc-save');
        const cta = $('#calc-cta');
        const chips = $$('[data-bill]', form);
        const { tariff, sunHours, performance, panelWatts, offset, maxCells } = CONFIG.calc;

        const cells = Array.from({ length: maxCells }, (_, n) => {
            const c = document.createElement('span');
            c.className = 'cell';
            c.style.setProperty('--n', n);
            viz.appendChild(c);
            return c;
        });

        const compute = (bill) => {
            const kwhPerDay = bill / tariff / 60; // el recibo de CFE es bimestral
            const kwNeeded = kwhPerDay / (sunHours * performance);
            const panels = Math.max(2, Math.ceil((kwNeeded * 1000) / panelWatts));
            return {
                panels,
                kwp: (panels * panelWatts) / 1000,
                save: Math.round((bill * 6 * offset) / 100) * 100
            };
        };

        const view = { panels: 0, kwp: 0, save: 0 };
        const paint = () => {
            panelsEl.textContent = Math.round(view.panels);
            kwpEl.textContent = view.kwp.toFixed(1);
            saveEl.textContent = money(view.save);
        };

        const update = (animate = true) => {
            const bill = Number(range.value);
            const min = Number(range.min);
            const max = Number(range.max);
            range.style.setProperty('--p', `${((bill - min) / (max - min)) * 100}%`);
            out.textContent = money(bill);
            chips.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.bill) === bill));

            const r = compute(bill);
            if (animate && hasGsap && !reduceMotion) {
                window.gsap.to(view, { panels: r.panels, kwp: r.kwp, save: r.save, duration: 0.7, ease: 'power3.out', overwrite: true, onUpdate: paint });
            } else {
                Object.assign(view, r);
                paint();
            }

            cells.forEach((c, i) => {
                const lastCell = i === maxCells - 1;
                const more = lastCell && r.panels > maxCells;
                c.classList.toggle('cell--more', more);
                c.textContent = more ? `+${r.panels - (maxCells - 1)}` : '';
                c.classList.toggle('on', i < Math.min(r.panels, maxCells));
            });

            cta.href = waUrl(
                `Hola ${CONFIG.brand}, mi pago bimestral de luz es de aproximadamente ${money(bill)}. ` +
                `Según su calculadora necesitaría unos ${r.panels} paneles de ${panelWatts} W (${r.kwp.toFixed(1)} kWp). Quiero mi cotización.`
            );
        };

        range.addEventListener('input', () => update(true));
        chips.forEach((c) => c.addEventListener('click', () => { range.value = c.dataset.bill; update(true); }));
        form.addEventListener('submit', (e) => e.preventDefault());
        update(false);
    }

    /* ---------- 04 FORMULARIO -> WHATSAPP ---------- */
    function initForm() {
        const form = $('#contact-form');
        if (!form) return;
        const status = $('#form-status');
        const fallback = $('#form-fallback');

        const rules = [
            { id: 'f-name', err: 'f-name-err', msg: 'Escribe tu nombre para saber cómo llamarte.', ok: (v) => v.trim().length >= 2 },
            { id: 'f-project', err: 'f-project-err', msg: 'Elige qué necesitas para orientarte mejor.', ok: (v) => v !== '' }
        ];

        const setError = (rule, message) => {
            const field = $('#' + rule.id).closest('.field');
            $('#' + rule.err).textContent = message;
            field.classList.toggle('has-error', Boolean(message));
            $('#' + rule.id).setAttribute('aria-invalid', message ? 'true' : 'false');
        };

        rules.forEach((rule) => {
            const el = $('#' + rule.id);
            el.addEventListener('input', () => { if (rule.ok(el.value)) setError(rule, ''); });
            el.addEventListener('change', () => { if (rule.ok(el.value)) setError(rule, ''); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let firstInvalid = null;
            rules.forEach((rule) => {
                const el = $('#' + rule.id);
                const valid = rule.ok(el.value);
                setError(rule, valid ? '' : rule.msg);
                if (!valid && !firstInvalid) firstInvalid = el;
            });
            if (firstInvalid) { firstInvalid.focus(); return; }

            const data = Object.fromEntries(new FormData(form).entries());
            const lines = [
                `Hola ${CONFIG.brand}, soy ${data.name.trim()}.`,
                `Necesito: ${data.project}.`
            ];
            if (data.bill) lines.push(`Mi pago bimestral de luz es aproximadamente: ${data.bill}.`);
            if (data.phone && data.phone.trim()) lines.push(`Mi teléfono: ${data.phone.trim()}.`);
            if (data.message && data.message.trim()) lines.push(`Mensaje: ${data.message.trim()}`);

            const url = waUrl(lines.join('\n'));
            fallback.href = url;
            status.hidden = false;
            window.open(url, '_blank', 'noopener');
        });
    }

    /* ---------- 05 VIDEOS PEREZOSOS ---------- */
    function initVideos() {
        const hero = $('.hero__video');
        if (hero && reduceMotion) { hero.pause(); hero.removeAttribute('autoplay'); }

        const lazy = $$('video[data-lazy]');
        const all = hero ? [hero, ...lazy] : lazy;
        if (!all.length || !('IntersectionObserver' in window)) {
            lazy.forEach((v) => { v.src = v.dataset.src; });
            return;
        }
        const play = (v) => {
            if (reduceMotion) return;
            if (v.dataset.src && !v.dataset.ready) { v.src = v.dataset.src; v.dataset.ready = '1'; v.load(); }
            const p = v.play();
            if (p && p.catch) p.catch(() => {});
        };
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { en.isIntersecting ? play(en.target) : en.target.pause(); });
        }, { rootMargin: '280px 280px' });
        all.forEach((v) => io.observe(v));
    }

    /* ---------- 06 PARTÍCULAS (campo de fotones) ---------- */
    function createPhotons(canvas, options) {
        const ctx = canvas && canvas.getContext('2d');
        if (!ctx) return;
        const o = Object.assign({ density: 15000, min: 26, max: 90, link: 120, speed: 1, dots: ['#EAB207'], line: '45,92,41', lineAlpha: 0.16 }, options);
        const host = canvas.closest('section') || canvas.parentElement;
        const mouse = { x: -9999, y: -9999 };
        let w = 0, h = 0, parts = [], raf = 0, last = 0, visible = false;

        const rand = (a, b) => a + Math.random() * (b - a);
        const spawn = () => ({
            x: rand(0, w), y: rand(0, h), r: rand(1, 2.8), ph: rand(0, 6.28), a: rand(0.45, 0.95),
            vx: -rand(0.1, 0.45) * o.speed, vy: rand(0.04, 0.3) * o.speed,
            c: o.dots[(Math.random() * o.dots.length) | 0]
        });

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            const link2 = o.link * o.link;
            for (let i = 0; i < parts.length; i++) {
                const a = parts[i];
                for (let j = i + 1; j < parts.length; j++) {
                    const b = parts[j];
                    const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 < link2) {
                        ctx.strokeStyle = `rgba(${o.line},${(1 - Math.sqrt(d2) / o.link) * o.lineAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
            }
            for (const p of parts) {
                ctx.fillStyle = p.c;
                ctx.globalAlpha = p.a * 0.16;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, 6.2832); ctx.fill();
                ctx.globalAlpha = p.a;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
            }
            ctx.globalAlpha = 1;
        };

        const update = (dt) => {
            const k = dt / 16.67;
            for (const p of parts) {
                p.ph += 0.01 * k;
                p.x += (p.vx + Math.sin(p.ph) * 0.12) * k;
                p.y += (p.vy + Math.cos(p.ph * 0.8) * 0.08) * k;
                const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                if (d2 < 16900) {
                    const d = Math.sqrt(d2) || 1, f = (130 - d) / 130;
                    p.x += (dx / d) * f * 2.2 * k; p.y += (dy / d) * f * 2.2 * k;
                }
                if (p.x < -12) p.x = w + 12; else if (p.x > w + 12) p.x = -12;
                if (p.y > h + 12) p.y = -12; else if (p.y < -12) p.y = h + 12;
            }
        };

        const frame = (t) => {
            raf = 0;
            if (!visible || document.hidden) return;
            const dt = Math.min(50, t - (last || t));
            last = t;
            update(dt);
            draw();
            raf = requestAnimationFrame(frame);
        };
        const start = () => { if (!raf && !reduceMotion) { last = 0; raf = requestAnimationFrame(frame); } };

        const resize = () => {
            const r = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = Math.max(1, r.width); h = Math.max(1, r.height);
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.round(Math.min(o.max, Math.max(o.min, (w * h) / o.density)));
            while (parts.length < n) parts.push(spawn());
            parts.length = n;
            draw();
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        if (finePointer && !reduceMotion) {
            host.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }, { passive: true });
            host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; visible ? start() : (raf = 0); }).observe(host);
        } else { visible = true; start(); }
        document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    }

    function initPhotons() {
        createPhotons($('#photons-hero'), { dots: ['#EAB207', '#F4C62E', '#2D5C29'], line: '45,92,41', lineAlpha: 0.17 });
        createPhotons($('#photons-contact'), { dots: ['#F4C62E', '#FBE38B', '#FFFFFF'], line: '244,198,46', lineAlpha: 0.16, density: 17000 });
    }

    /* ---------- 07 SCROLL SUAVE (Lenis) ---------- */
    function initSmoothScroll() {
        if (!motion || typeof window.Lenis === 'undefined') return;
        lenis = new window.Lenis({
            duration: 1.3,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9
        });
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add((time) => lenis.raf(time * 1000));
        window.gsap.ticker.lagSmoothing(0);
    }

    /* ---------- 08 PRELOADER ---------- */
    function finishLoader(loader) {
        document.body.classList.remove('is-loading');
        if (loader) loader.remove();
    }

    function runLoader() {
        const loader = $('#loader');
        return new Promise((resolve) => {
            if (!loader) { resolve(); return; }

            // Sin GSAP o con movimiento reducido: salida simple con CSS
            if (!motion) {
                const done = () => { loader.classList.add('is-done'); document.body.classList.remove('is-loading'); setTimeout(() => loader.remove(), 700); resolve(); };
                if (reduceMotion || document.readyState === 'complete') done();
                else window.addEventListener('load', done, { once: true });
                return;
            }

            const { gsap } = window;
            const pct = $('#loader-pct');
            const bar = $('.loader__ring .bar');
            const state = { p: 0 };
            const render = () => {
                bar.style.strokeDashoffset = String(100 - state.p * 100);
                pct.textContent = Math.round(state.p * 100);
            };

            const started = performance.now();
            const MIN_MS = 2000;
            const ready = Promise.race([
                Promise.all([
                    document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
                    document.fonts ? document.fonts.ready : Promise.resolve()
                ]),
                new Promise((r) => setTimeout(r, 6500))
            ]);

            const crawl = gsap.to(state, { p: 0.9, duration: 1.9, ease: 'power2.out', onUpdate: render });

            ready.then(() => {
                const wait = Math.max(0, MIN_MS - (performance.now() - started));
                setTimeout(() => {
                    crawl.kill();
                    gsap.to(state, {
                        p: 1, duration: 0.55, ease: 'power2.inOut', onUpdate: render,
                        onComplete: () => {
                            // Salida: el disco de luz inunda la pantalla y revela el hero
                            const tl = gsap.timeline({ onComplete: () => finishLoader(loader) });
                            tl.to('.loader__meta', { opacity: 0, y: 14, duration: 0.35, ease: 'power2.in' }, 0)
                              .to('.loader__rays', { scale: 1.5, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
                              .to('.loader__ring', { opacity: 0, duration: 0.3 }, 0)
                              .to('.loader__bulb', { scale: 1.5, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.1)
                              .to('.loader__disc', { scale: 34, duration: 1.15, ease: 'power3.in' }, 0.1)
                              .call(resolve, null, 1.0)
                              .to(loader, { opacity: 0, duration: 0.6, ease: 'power1.out' }, 1.05);
                        }
                    });
                }, wait);
            });
        });
    }

    /* ---------- 09 TEXTO DIVIDIDO ---------- */
    function splitText(el, mode = 'words') {
        if (el._split) return el._split;
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        const pieces = [];
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const word = document.createElement('span');
                        word.className = 'w';
                        word.setAttribute('aria-hidden', 'true');
                        const inner = document.createElement('span');
                        inner.className = 'wi';
                        if (mode === 'chars') {
                            Array.from(part).forEach((ch) => {
                                const c = document.createElement('span');
                                c.className = 'ch';
                                c.textContent = ch;
                                inner.appendChild(c);
                                pieces.push(c);
                            });
                        } else {
                            inner.textContent = part;
                            pieces.push(inner);
                        }
                        word.appendChild(inner);
                        frag.appendChild(word);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1) {
                    walk(child);
                }
            });
        };
        walk(el);
        el._split = pieces;
        return pieces;
    }

    /* ---------- 10 INTRO DEL HERO ---------- */
    let heroChars = [];
    function prepareHero() {
        const { gsap } = window;
        heroChars = splitText($('#hero-title'), 'chars');
        gsap.set(heroChars, { yPercent: 125 });
        gsap.set('.hl', { '--hl': 0 });
        gsap.set('.hero__lead', { opacity: 0, y: 30 });
        gsap.set('.hero__actions .btn', { opacity: 0, y: 26, scale: 0.92 });
        gsap.set('.hero__frame', { clipPath: 'inset(100% 0% 0% 0% round 28px)', transformPerspective: 1100 });
        gsap.set('.hero__video', { scale: 1.35 });
        gsap.set('.hero__rays, .hero__ring', { opacity: 0, scale: 0.65 });
        gsap.set('.hero__photons', { opacity: 0 });
        gsap.set('.nav', { opacity: 0, y: -26 });
    }

    function playHero() {
        const { gsap } = window;
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.to(heroChars, { yPercent: 0, duration: 1.35, stagger: 0.028 }, 0)
          .to('.hl', { '--hl': 1, duration: 1.1, ease: 'power3.inOut' }, 0.95)
          .to('.hero__lead', { opacity: 1, y: 0, duration: 1.1 }, 0.55)
          .to('.hero__actions .btn', { opacity: 1, y: 0, scale: 1, duration: 1.1, stagger: 0.12, ease: 'back.out(1.5)' }, 0.75)
          .fromTo('.hero__frame', { clipPath: 'inset(100% 0% 0% 0% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.7, ease: 'expo.inOut' }, 0.15)
          .to('.hero__video', { scale: 1, duration: 2.4 }, 0.15)
          .to('.hero__rays, .hero__ring', { opacity: 1, scale: 1, duration: 2.2, stagger: 0.15 }, 0.3)
          .to('.hero__photons', { opacity: 1, duration: 2 }, 0.4)
          .to('.nav', { opacity: 1, y: 0, duration: 1.1 }, 0.6);
    }

    /* ---------- 11 ANIMACIONES CON SCROLL ---------- */
    function initScrollAnimations() {
        const { gsap, ScrollTrigger } = window;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });

        /* Progreso de lectura */
        gsap.to('.progress__bar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

        /* Header: se oculta al bajar, reaparece al subir */
        const header = $('#header');
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                const y = self.scroll();
                header.classList.toggle('is-scrolled', y > 24);
                const hide = self.direction === 1 && y > 520 && !root.classList.contains('menu-open');
                header.classList.toggle('is-hidden', hide);
            }
        });

        /* Enlace activo según sección */
        $$('[data-nav]').forEach((link) => {
            const section = document.getElementById(link.dataset.nav);
            if (!section) return;
            ScrollTrigger.create({
                trigger: section, start: 'top 48%', end: 'bottom 48%',
                onToggle: (self) => link.classList.toggle('is-active', self.isActive)
            });
        });

        /* Titulares: palabras que suben desde una máscara */
        $$('[data-split="words"]').forEach((el) => {
            const words = splitText(el, 'words');
            gsap.from(words, {
                yPercent: 118, duration: 1.15, ease: 'expo.out', stagger: 0.05,
                scrollTrigger: { trigger: el, start: 'top 86%', once: true }
            });
        });

        /* Aparición genérica */
        $$('[data-reveal]').forEach((el) => {
            gsap.from(el, { y: 44, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
        });
        $$('[data-reveal-group]').forEach((group) => {
            gsap.from($$('[data-reveal-item]', group), {
                y: 46, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.13,
                scrollTrigger: { trigger: group, start: 'top 86%', once: true }
            });
        });

        /* Hero: al salir, el contenido se aleja con parallax */
        const heroTrigger = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
        gsap.to('.hero__copy', { yPercent: -9, ease: 'none', scrollTrigger: heroTrigger });
        gsap.to('[data-hero-media]', { yPercent: 7, scale: 1.05, ease: 'none', scrollTrigger: heroTrigger });

        /* Manifiesto: las palabras se encienden al leer */
        const manifesto = $('[data-manifesto]');
        if (manifesto) {
            const words = splitText(manifesto, 'words');
            gsap.set(words, { opacity: 0.14 });
            gsap.to(words, {
                opacity: 1, ease: 'none', stagger: { each: 0.1 },
                scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 55%', scrub: true }
            });
        }

        /* Contadores */
        $$('[data-count]').forEach((el) => {
            const target = Number(el.dataset.count);
            const counter = { v: 0 };
            el.textContent = '0';
            gsap.to(counter, {
                v: target, duration: 2, ease: 'power3.out',
                onUpdate: () => { el.textContent = Math.round(counter.v); },
                scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
        });

        const mm = gsap.matchMedia();

        /* Tarjetas apiladas: la anterior se aleja y se oscurece */
        mm.add('(min-width: 900px) and (min-height: 700px)', () => {
            const cards = gsap.utils.toArray('.stack__card');
            cards.forEach((card, i) => {
                const next = cards[i + 1];
                if (!next) return;
                const st = { trigger: next, start: 'top 88%', end: 'top 22%', scrub: true };
                gsap.to(card, { scale: 0.94, ease: 'none', scrollTrigger: st });
                gsap.to($('.stack__dim', card), { opacity: 0.55, ease: 'none', scrollTrigger: st });
            });
        });

        /* Tarjetas: entrada con levitación en móvil/tablet */
        mm.add('(max-width: 899px), (max-height: 699px)', () => {
            gsap.utils.toArray('.stack__card').forEach((card) => {
                gsap.from(card, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 88%', once: true } });
            });
        });

        /* TECHO: la imagen se abre hasta ocupar toda la pantalla */
        const zoom = $('.zoom');
        if (zoom) {
            mm.add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (ctx) => {
                const from = ctx.conditions.wide ? 'inset(34% 30% 7% 30% round 28px)' : 'inset(40% 7% 9% 7% round 22px)';
                gsap.set('.zoom__media', { clipPath: from });
                gsap.set('.zoom__overlay > *', { opacity: 0, y: 40 });
                const tl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: { trigger: zoom, start: 'top top', end: '+=170%', scrub: 0.6, pin: true, anticipatePin: 1 }
                });
                // fromTo explícito: el navegador normaliza el clip-path calculado y rompería la interpolación
                tl.fromTo('.zoom__media', { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
                  .fromTo('.zoom__media img', { scale: 1.4 }, { scale: 1, duration: 1 }, 0)
                  .to('.zoom__intro', { opacity: 0, yPercent: -35, duration: 0.35 }, 0.06)
                  .to('.zoom__shade', { opacity: 1, duration: 0.45 }, 0.5)
                  .to('.zoom__overlay > *', { opacity: 1, y: 0, stagger: 0.12, duration: 0.28 }, 0.72);
            });
        }

        /* Mantenimiento: el marco sube con parallax suave */
        gsap.fromTo('.care__frame', { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.care', start: 'top bottom', end: 'bottom top', scrub: true } });

        /* PROYECTOS: scroll vertical -> desplazamiento horizontal (solo escritorio) */
        const gallery = $('.gallery');
        if (gallery) {
            mm.add('(min-width: 1024px)', () => {
                const track = $('.gallery__track');
                const bar = $('.gallery__bar span');
                const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
                const pan = gsap.to(track, {
                    x: () => -distance(), ease: 'none',
                    scrollTrigger: {
                        trigger: gallery, start: 'top top', end: () => '+=' + distance(),
                        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
                        onUpdate: (self) => { gsap.set(bar, { scaleX: self.progress }); }
                    }
                });
                $$('.gallery__media').forEach((media) => {
                    const img = $('img, video', media);
                    const amp = media.closest('.gallery__item--band') ? 2.5 : 7; // el recorte panorámico tiene menos margen
                    gsap.fromTo(img, { xPercent: -amp }, {
                        xPercent: amp, ease: 'none',
                        scrollTrigger: { trigger: media, containerAnimation: pan, start: 'left right', end: 'right left', scrub: true }
                    });
                });
            });
        }

        /* Proceso: la línea se dibuja y cada paso se enciende */
        gsap.fromTo('.timeline__fill', { scaleY: 0 }, {
            scaleY: 1, ease: 'none',
            scrollTrigger: { trigger: '.timeline', start: 'top 62%', end: 'bottom 70%', scrub: true }
        });
        $$('.timeline__item').forEach((item) => {
            ScrollTrigger.create({ trigger: item, start: 'top 66%', end: 'max', toggleClass: { targets: item, className: 'is-active' } });
        });

        /* Refrescar medidas cuando todo terminó de cargar */
        window.addEventListener('load', () => ScrollTrigger.refresh());
        if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    }

    /* ---------- 12 INTERACCIONES ---------- */
    function initInteractions() {
        if (!finePointer) return;
        const { gsap } = window;

        // Botones magnéticos
        $$('[data-magnetic]').forEach((el) => {
            const xTo = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3' });
            const yTo = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3' });
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
            });
            el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });

        // Tarjetas con luz que sigue al cursor
        $$('[data-spotlight]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });

        // Inclinación 3D del marco del hero
        const hero = $('.hero');
        const frame = $('[data-tilt]');
        if (hero && frame) {
            const rx = gsap.quickTo(frame, 'rotationX', { duration: 0.9, ease: 'power3' });
            const ry = gsap.quickTo(frame, 'rotationY', { duration: 0.9, ease: 'power3' });
            hero.addEventListener('pointermove', (e) => {
                const nx = e.clientX / window.innerWidth - 0.5;
                const ny = e.clientY / window.innerHeight - 0.5;
                ry(nx * 9);
                rx(-ny * 7);
            });
            hero.addEventListener('pointerleave', () => { rx(0); ry(0); });
        }
    }

    /* ---------- 13 ARRANQUE ---------- */
    function boot() {
        bindWhatsAppLinks();
        setYear();
        initMenu();
        initFaq();
        initCalculator();
        initForm();
        initVideos();
        initPhotons();
        initSmoothScroll();
        initAnchors();

        if (!motion) { runLoader(); return; }

        prepareHero();
        initScrollAnimations();
        initInteractions();
        runLoader().then(() => {
            playHero();
            setTimeout(() => window.ScrollTrigger.refresh(), 900);
        });
    }

    // Seguridad: si algo falla, nunca dejamos la página bloqueada por el loader
    try { boot(); } catch (err) {
        console.error('[Eco Solar] Error de inicialización:', err);
        root.classList.add('is-static');
        const loader = $('#loader');
        if (loader) loader.remove();
        document.body.classList.remove('is-loading');
    }
})();
