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
const agendaCard = (item, social = false) => {
  const card = element("article", social ? "entry social-entry" : "entry");
  card.dataset.id = item.id;
  card.dataset.day = item.day;
  if (social) card.dataset.sourceId = item.sourceId;
  const timing = element("div", "timing", item.time);
  timing.append(element("span", "date", item.date));
  const heading = element("div");
  heading.append(item.url ? externalLink(item.title, item.url, "session-title") : element("span", "session-title", item.title));
  const labels = element("div", "labels");
  labels.append(element("span", "label", item.category));
  if (social || !item.recommended) labels.append(element("span", "label alternative", social ? "Optional social" : "Alternative"));
  heading.append(labels);
  const reason = element("p", "reason", item.reason);
  reason.append(element("span", "location", `${item.format} \u00b7 ${item.room}`));
  if (item.note) reason.append(element("span", "routing", item.note));
  card.append(timing, heading, reason);
  return card;
};

async function start() {
  const response = await fetch("./agenda.json");
  if (!response.ok) throw new Error(`Agenda request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.sessions) || !Array.isArray(data.socials) || !Array.isArray(data.venues)) {
    throw new Error("Agenda data is not in the expected format");
  }
  const state = { day: "all", mode: "primary", query: "" };
  const schedule = document.querySelector("#schedule");
  const results = document.querySelector("#results");
  const socialList = document.querySelector("#social-activities");
  const venueList = document.querySelector("#venues");
  const mappedSocials = document.querySelector("#mapped-socials");
  let map;
  let markers;
  document.querySelector("#primary-count").textContent = data.sessions.filter(s => s.recommended).length;
  document.querySelector("#alternative-count").textContent = data.sessions.filter(s => !s.recommended).length;

  function render() {
    const query = state.query.trim().toLocaleLowerCase();
    const visible = data.sessions.filter(session =>
      (state.day === "all" || state.day === session.day) &&
      (state.mode === "all" || session.recommended) &&
      [session.title, session.category, session.reason, session.room].join(" ").toLocaleLowerCase().includes(query)
    );
    const visibleSocials = data.socials.filter(social =>
      (state.day === "all" || state.day === social.day) &&
      [social.title, social.category, social.format, social.reason, social.room, social.note]
        .join(" ").toLocaleLowerCase().includes(query)
    );
    document.querySelectorAll("button[data-day]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.day === state.day)));
    document.querySelectorAll("[data-mode]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
    results.textContent = `${visible.length} ${visible.length === 1 ? "session" : "sessions"} \u2022 ${state.mode === "primary" ? "sequenced team itinerary" : "alternatives may overlap; follow replacement notes"}`;
    const socialLink = element("a", "", `${visibleSocials.length} social activities`);
    socialLink.href = "#social-section";
    results.append(" \u2022 ", socialLink);
    schedule.replaceChildren();
    if (!visible.length) {
      schedule.append(element("div", "empty", "No sessions match the current filters."));
    }
    for (const session of visible) schedule.append(agendaCard(session));
    document.querySelector("#social-days").textContent = {
      all: "Wednesday & Thursday | October 28-29",
      wed: "Wednesday | October 28",
      thu: "Thursday | October 29"
    }[state.day];
    document.querySelector("#social-results").textContent = `${visibleSocials.length} social activities \u2022 optional; access and unconfirmed details are noted below`;
    socialList.replaceChildren();
    if (!visibleSocials.length) socialList.append(element("div", "empty", "No social activities match the current filters."));
    for (const [day, title] of [["wed", "Wednesday, October 28"], ["thu", "Thursday, October 29"]]) {
      const activities = visibleSocials.filter(social => social.day === day);
      if (activities.length) socialList.append(element("h3", "social-day", title));
      for (const social of activities) socialList.append(agendaCard(social, true));
    }
    const mapped = data.venues.filter(venue => visibleSocials.some(social => social.sourceId === venue.socialId));
    renderVenues(mapped);
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
  function renderVenues(venues) {
    mappedSocials.hidden = venues.length === 0;
    venueList.replaceChildren();
    if (markers) markers.clearLayers();
    for (const venue of venues) {
      const card = element("article", "venue-card");
      card.append(element("span", "number", venue.number));
      const body = element("div");
      body.append(
        element("h3", "", venue.name),
        element("div", "venue-time", `Wed, Oct 28 \u00b7 ${venue.time}`),
        element("p", "", venue.reason),
        element("span", "address", venue.address),
        element("span", "venue-status", venue.status),
        externalLink("Open directions", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`, "directions")
      );
      if (venue.url) body.append(externalLink("Host details / RSVP", venue.url, "directions"));
      card.append(body);
      venueList.append(card);
      if (markers) {
        const pin = element("span", "pin", venue.number);
        const icon = L.divIcon({ html: pin, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
        const popup = element("div");
        popup.append(element("strong", "", venue.name), element("div", "", venue.time), element("div", "", venue.status));
        L.marker(venue.position, { icon, title: venue.name, alt: venue.name }).addTo(markers).bindPopup(popup);
      }
    }
    if (map && venues.length) {
      map.invalidateSize();
      map.fitBounds(venues.map(venue => venue.position), { padding: [34, 34], maxZoom: 16 });
    }
  }
  const container = document.querySelector("#venue-map");
  if (!window.L) {
    container.append(element("p", "map-error", "The map library could not load. Use the venue directions links instead."));
    render();
    return;
  }
  map = L.map(container, { scrollWheelZoom: false });
  markers = L.layerGroup().addTo(map);
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
  render();
}

start().catch(error => {
  console.error(error);
  document.querySelector("#results").textContent = "The agenda could not load. Please reload or contact your account team.";
  document.querySelector("#social-results").textContent = "Social activities could not load. Please reload or contact your account team.";
});
