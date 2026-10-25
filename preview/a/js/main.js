(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = window.matchMedia("(min-width: 1021px)").matches;
  const stories = Array.from(document.querySelectorAll("[data-product-story]"));
  const stage = document.querySelector("[data-product-stage]");
  const device = document.querySelector("[data-device]");
  const stageName = document.querySelector("[data-stage-name]");
  const stageImages = Array.from(document.querySelectorAll("[data-stage-image]"));
  const sequence = document.querySelector("[data-product-sequence]");

  const setImage = (name) => {
    stageImages.forEach((image) => {
      const active = image.dataset.stageImage === name;
      image.classList.toggle("is-current", active);
      image.setAttribute("aria-hidden", active ? "false" : "true");
    });
    if (stageName) stageName.textContent = name === "echo" ? "Echo" : "Mara";
  };

  if (stageImages.length) setImage("mara-home");

  if (!reducedMotion && desktop && stage && device && sequence && stories.length) {
    document.documentElement.classList.add("has-motion");

    let sequenceVisible = false;
    let pageVisible = !document.hidden;
    let framePending = false;
    let lastImage = "mara-home";
    let pointerX = 0;
    let pointerY = 0;

    const updateStage = () => {
      framePending = false;
      if (!sequenceVisible || !pageVisible) return;

      const sequenceRect = sequence.getBoundingClientRect();
      const center = innerHeight * 0.5;
      const focused = stories.reduce((best, story) => {
        const rect = story.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        return !best || distance < best.distance ? { story, distance, rect } : best;
      }, null);

      if (focused) {
        const product = focused.story.dataset.product;
        let imageName = product === "echo" ? "echo" : "mara-home";
        if (product === "mara") {
          const progress = Math.max(0, Math.min(1,
            (center - focused.rect.top) / Math.max(1, focused.rect.height)));
          imageName = progress > 0.48 ? "mara-chat" : "mara-home";
        }
        if (imageName !== lastImage) {
          setImage(imageName);
          lastImage = imageName;
        }
      }

      const travel = Math.max(1, sequenceRect.height + innerHeight);
      const progress = Math.max(0, Math.min(1, (innerHeight - sequenceRect.top) / travel));
      const turn = -10 + progress * 6 + pointerX * 4;
      const tilt = 4 - progress * 6 + pointerY * -3;
      const lift = 18 - progress * 36;
      device.style.setProperty("--device-turn", `${turn.toFixed(2)}deg`);
      device.style.setProperty("--device-tilt", `${tilt.toFixed(2)}deg`);
      device.style.setProperty("--device-lift", `${lift.toFixed(1)}px`);
    };

    const requestStageUpdate = () => {
      if (framePending || !sequenceVisible || !pageVisible) return;
      framePending = true;
      requestAnimationFrame(updateStage);
    };

    const sequenceObserver = new IntersectionObserver(([entry]) => {
      sequenceVisible = entry.isIntersecting;
      if (sequenceVisible) requestStageUpdate();
    }, { rootMargin: "140px 0px" });
    sequenceObserver.observe(sequence);

    window.addEventListener("scroll", requestStageUpdate, { passive: true });
    window.addEventListener("resize", requestStageUpdate, { passive: true });
    document.addEventListener("visibilitychange", () => {
      pageVisible = !document.hidden;
      if (pageVisible) requestStageUpdate();
    });

    if (window.matchMedia("(pointer: fine)").matches) {
      let pointerFrame = false;
      stage.addEventListener("pointermove", (event) => {
        const rect = stage.getBoundingClientRect();
        pointerX = (event.clientX - rect.left) / rect.width - 0.5;
        pointerY = (event.clientY - rect.top) / rect.height - 0.5;
        if (pointerFrame) return;
        pointerFrame = true;
        stage.classList.add("is-tilting");
        requestAnimationFrame(() => {
          pointerFrame = false;
          requestStageUpdate();
        });
      });
      stage.addEventListener("pointerleave", () => {
        pointerX = 0;
        pointerY = 0;
        stage.classList.remove("is-tilting");
        requestStageUpdate();
      });
    }
  }

  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const format = new Intl.NumberFormat("en");
  const animateCounter = (element) => {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target) || reducedMotion) return;
    const duration = 980;
    const start = performance.now();
    const draw = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = format.format(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  };

  if ("IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.7 });
    counters.forEach((counter) => counterObserver.observe(counter));
  }

  const mobileMenu = document.querySelector(".mobile-nav");
  if (mobileMenu) {
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => mobileMenu.removeAttribute("open"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenu.open) {
        mobileMenu.removeAttribute("open");
        mobileMenu.querySelector("summary").focus();
      }
    });
  }

  const copyButton = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector("[data-copy-status]");
  if (copyButton && copyStatus) {
    copyButton.addEventListener("click", async () => {
      const email = copyButton.dataset.email;
      try {
        await navigator.clipboard.writeText(email);
        copyStatus.textContent = "Email copied";
      } catch {
        const field = document.createElement("textarea");
        field.value = email;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        let copied = false;
        try {
          copied = document.execCommand("copy");
        } catch {
          copied = false;
        }
        field.remove();
        copyStatus.textContent = copied ? "Email copied" : "Unable to copy email";
      }
    });
  }
})();
