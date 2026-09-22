"use strict";

const element = (tag, className, content) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
};
const externalLink = (label, url, className) => {
  const link = element("a", className, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
};

async function start() {
  const response = await fetch("./agenda.json");
  if (!response.ok) throw new Error(`Agenda request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.sessions) || !Array.isArray(data.venues)) {
    throw new Error("Agenda data is not in the expected format");
  }
  const state = { day: "all", mode: "primary", query: "" };
  const schedule = document.querySelector("#schedule");
  const results = document.querySelector("#results");
  document.querySelector("#primary-count").textContent = data.sessions.filter(s => s.recommended).length;
  document.querySelector("#alternative-count").textContent = data.sessions.filter(s => !s.recommended).length;

  function render() {
    const query = state.query.trim().toLocaleLowerCase();
    const visible = data.sessions.filter(session =>
      (state.day === "all" || state.day === session.day) &&
      (state.mode === "all" || session.recommended) &&
      [session.title, session.category, session.reason, session.room].join(" ").toLocaleLowerCase().includes(query)
    );
    document.querySelectorAll("button[data-day]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.day === state.day)));
    document.querySelectorAll("[data-mode]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
    results.textContent = `${visible.length} ${visible.length === 1 ? "session" : "sessions"} \u2022 ${state.mode === "primary" ? "sequenced team itinerary" : "alternatives may overlap; follow replacement notes"}`;
    schedule.replaceChildren();
    if (!visible.length) {
      schedule.append(element("div", "empty", "No sessions match the current filters."));
    }
    for (const session of visible) {
      const card = element("article", "entry");
      card.dataset.id = session.id;
      card.dataset.day = session.day;
      const timing = element("div", "timing", session.time);
      timing.append(element("span", "date", session.date));
      const heading = element("div");
      heading.append(externalLink(session.title, session.url, "session-title"));
      const labels = element("div", "labels");
      labels.append(element("span", "label", session.category));
      if (!session.recommended) labels.append(element("span", "label alternative", "Alternative"));
      heading.append(labels);
      const reason = element("p", "reason", session.reason);
      reason.append(element("span", "location", `${session.format} \u00b7 ${session.room}`));
      if (session.note) reason.append(element("span", "routing", session.note));
      card.append(timing, heading, reason);
      schedule.append(card);
    }
  }
  document.querySelectorAll("button[data-day]").forEach(button => button.addEventListener("click", () => {
    state.day = button.dataset.day;
    render();
  }));
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    render();
  }));
  document.querySelector("#query").addEventListener("input", event => {
    state.query = event.target.value;
    render();
  });
  render();

  const venueList = document.querySelector("#venues");
  for (const venue of data.venues) {
    const card = element("article", "venue-card");
    card.append(element("span", "number", venue.number));
    const body = element("div");
    body.append(
      element("h3", "", venue.name),
      element("div", "venue-time", venue.time),
      element("p", "", venue.reason),
      element("span", "address", venue.address),
      element("span", "venue-status", venue.status),
      externalLink("Open directions", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`, "directions")
    );
    if (venue.url) body.append(externalLink("Host details / RSVP", venue.url, "directions"));
    card.append(body);
    venueList.append(card);
  }
  const container = document.querySelector("#venue-map");
  if (!window.L) {
    container.append(element("p", "map-error", "The map library could not load. Use the venue directions links instead."));
    return;
  }
  const map = L.map(container, { scrollWheelZoom: false });
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  let mapError;
  tiles.on("tileerror", () => {
    if (!mapError) {
      mapError = element("p", "map-note", "Some map tiles could not load. Venue addresses and directions remain available.");
      container.after(mapError);
    }
  });
  tiles.addTo(map);
  for (const venue of data.venues) {
    const pin = element("span", "pin", venue.number);
    const icon = L.divIcon({ html: pin, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
    const popup = element("div");
    popup.append(element("strong", "", venue.name), element("div", "", venue.time), element("div", "", venue.status));
    L.marker(venue.position, { icon, title: venue.name, alt: venue.name }).addTo(map).bindPopup(popup);
  }
  map.fitBounds(data.venues.map(venue => venue.position), { padding: [34, 34] });
}

start().catch(error => {
  console.error(error);
  document.querySelector("#results").textContent = "The agenda could not load. Please reload or contact your account team.";
});
