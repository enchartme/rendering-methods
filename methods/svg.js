// ── Chart skeleton (created once) ─────────────────────────────────────────
const margin = { top: 20, right: 20, bottom: 50, left: 55 };

const svg    = d3.select("#scatterplot");
const g      = svg.append("g");
const xScale = d3.scaleLinear().domain([0, 1]);
const yScale = d3.scaleLinear().domain([0, 1]);

// Axis groups + labels – created once, repositioned in resizeChart()
const xAxisG   = g.append("g").attr("class", "axis x-axis");
const xLabelEl = g.append("text").attr("class", "axis-label")
                   .attr("text-anchor", "middle").text("X");
const yAxisG   = g.append("g").attr("class", "axis y-axis");
const yLabelEl = g.append("text").attr("class", "axis-label")
                   .attr("transform", "rotate(-90)").attr("text-anchor", "middle").text("Y");

// ── Resize ────────────────────────────────────────────────────────────────
let chartW = 0, chartH = 0;

function resizeChart() {
  const svgEl = document.getElementById("scatterplot");
  chartW = svgEl.clientWidth  - margin.left - margin.right;
  chartH = svgEl.clientHeight - margin.top  - margin.bottom;

  g.attr("transform", `translate(${margin.left},${margin.top})`);
  xScale.range([0, chartW]);
  yScale.range([chartH, 0]);

  xAxisG
    .attr("transform", `translate(0,${chartH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickSize(-chartH))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick line").attr("stroke", "#2c2c52"));
  xLabelEl.attr("x", chartW / 2).attr("y", chartH + 40);

  yAxisG
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-chartW))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick line").attr("stroke", "#2c2c52"));
  yLabelEl.attr("x", -chartH / 2).attr("y", -44);

  // Snap existing dots to new positions (no animation on resize)
  g.selectAll(".dot")
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y));
}

resizeChart();
updateDots(generateNormal(1000));

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeChart, 40);
});

// ── Update ────────────────────────────────────────────────────────────────
function updateDots(newData) {
  g.selectAll(".dot")
    .data(newData)
    .join(
      enter => enter.append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 4),
      update => update
        .transition().duration(600).ease(d3.easeCubicInOut)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );
}

initControls({ onRender: updateDots });
