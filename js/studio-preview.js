(() => {
  "use strict";
  const positive = document.querySelector("#positive-dose");
  const negative = document.querySelector("#negative-dose");
  const positiveValue = document.querySelector("#positive-value");
  const negativeValue = document.querySelector("#negative-value");
  const line = document.querySelector("#steered-line");
  const point = document.querySelector("#signal-point");
  const label = document.querySelector("#dose-label");
  if (!positive || !negative || !line || !point) return;

  function update() {
    const up = Number(positive.value);
    const down = Number(negative.value);
    positiveValue.textContent = `+${up.toFixed(2)}`;
    negativeValue.textContent = `${down.toFixed(2).replace("-", "−")}`;
    const magnitude = up - down;
    line.style.transform = `rotate(${-10 - magnitude * 6.5}deg)`;
    point.style.top = `${48 - magnitude * 9}%`;
    label.textContent = magnitude === 0 ? "BASELINE" : "TWO INTERVENTIONS";
  }
  positive.addEventListener("input", update);
  negative.addEventListener("input", update);
  update();
})();

