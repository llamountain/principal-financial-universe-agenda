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
  if (social || !item.recommended) labels.append(element("span", "label alternative",
    social ? ((item.tab || item.day) === "tue" ? "Optional add-on" : "Optional social") : "Alternative"));
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
  const requestedDay = new URLSearchParams(window.location.search).get("day");
  const dayTitles = { all: "Wednesday & Thursday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday" };
  const state = { day: Object.hasOwn(dayTitles, requestedDay) ? requestedDay : "all", mode: "primary", query: "" };
  const schedule = document.querySelector("#schedule");
  const results = document.querySelector("#results");
  const socialList = document.querySelector("#social-activities");
  const venueList = document.querySelector("#venues");
  const mappedSocials = document.querySelector("#mapped-socials");
  const unmappedList = document.querySelector("#unmapped-venues");
  const socialDescription = document.querySelector("#social-description");
  const socialNotice = document.querySelector("#social-notice");
  const socialCallout = socialNotice.parentElement;
  const conferenceDescription = socialDescription.textContent;
  const conferenceNotice = socialNotice.textContent;
  const locationsBySource = new Map(data.venues.flatMap(venue => venue.sourceIds.map(id => [id, venue])));
  let map;
  let markers;
  document.querySelector("#primary-count").textContent = data.sessions.filter(s => s.recommended).length;
  document.querySelector("#alternative-count").textContent = data.sessions.filter(s => !s.recommended).length;

  function render() {
    const tuesday = state.day === "tue";
    const matchesDay = item => state.day === "all"
      ? ["wed", "thu"].includes(item.day)
      : (item.tab || item.day) === state.day;
    const query = state.query.trim().toLocaleLowerCase();
    const visible = data.sessions.filter(session =>
      matchesDay(session) &&
      (state.mode === "all" || session.recommended) &&
      [session.title, session.category, session.reason, session.room].join(" ").toLocaleLowerCase().includes(query)
    );
    const visibleSocials = data.socials.filter(social =>
      matchesDay(social) &&
      [social.title, social.category, social.format, social.reason, social.room, social.note,
        locationsBySource.get(social.sourceId).name, locationsBySource.get(social.sourceId).address]
        .join(" ").toLocaleLowerCase().includes(query)
    );
    document.querySelectorAll("button[data-day]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.day === state.day)));
    document.querySelectorAll("[data-mode]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
    results.textContent = tuesday ? "Tuesday planning" : `${visible.length} ${visible.length === 1 ? "session" : "sessions"} \u2022 ${state.mode === "primary" ? "sequenced team itinerary" : "alternatives may overlap; follow replacement notes"}`;
    const socialLink = element("a", "", `${visibleSocials.length} ${tuesday ? "optional programs" : "social activities"}`);
    socialLink.href = "#social-section";
    results.append(" \u2022 ", socialLink);
    const mapLink = element("a", "", "Venue map");
    mapLink.href = "#mapped-socials";
    if (visibleSocials.length) results.append(" \u2022 ", mapLink);
    schedule.replaceChildren();
    schedule.hidden = tuesday;
    document.querySelector("#session-selection").hidden = tuesday;
    if (!visible.length && !tuesday) {
      schedule.append(element("div", "empty", "No sessions match the current filters."));
    }
    for (const session of visible) schedule.append(agendaCard(session));
    document.querySelector("#social-days").textContent = {
      all: "Wednesday & Thursday | October 28-29",
      tue: "Tuesday | October 27 + by-arrangement briefings",
      wed: "Wednesday | October 28",
      thu: "Thursday | October 29"
    }[state.day];
    document.querySelector("#evening-heading").textContent = tuesday ? "Tuesday Welcome Reception and Meeting Briefings" : "Social activities & networking";
    socialDescription.hidden = tuesday;
    socialDescription.textContent = tuesday
      ? ""
      : conferenceDescription;
    socialNotice.textContent = tuesday
      ? "The welcome reception's date, time, and access remain unconfirmed. Both briefings are by arrangement: date, time, location, and organizer approval must be confirmed with your account team. No appointment or invitation is reserved, and executive eligibility does not imply team-wide access or a separate leadership track."
      : conferenceNotice;
    document.querySelector("#social-section").insertBefore(
      socialCallout, tuesday ? mappedSocials : document.querySelector("#social-results"));
    document.querySelector("#social-results").textContent = `${visibleSocials.length} ${tuesday ? "optional programs" : "social activities"} \u2022 optional; access and unconfirmed details are noted below`;
    socialList.replaceChildren();
    if (!visibleSocials.length) socialList.append(element("div", "empty", tuesday ? "No add-on programs match the current filters." : "No social activities match the current filters."));
    for (const [day, title] of [["tue", "Tuesday, October 27 - unconfirmed"], ["wed", "Wednesday, October 28"], ["thu", "Thursday, October 29"], ["undated", "By arrangement - not confirmed for Tuesday"]]) {
      const activities = visibleSocials.filter(social => social.day === day);
      if (activities.length) socialList.append(element("h3", "social-day", title));
      for (const social of activities) socialList.append(agendaCard(social, true));
    }
    renderVenues(visibleSocials);
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
  function activityDetails(social) {
    const detail = element("div", "venue-activity");
    detail.dataset.socialId = social.id;
    detail.append(
      element("strong", "", social.title),
      element("div", "venue-time", `${social.date} \u00b7 ${social.time}`),
      element("p", "", social.note)
    );
    if (social.url) detail.append(externalLink("Event details / RSVP", social.url, "directions"));
    return detail;
  }
  function renderVenues(socials) {
    const venues = data.venues.map(venue => ({
      ...venue, activities: socials.filter(social => venue.sourceIds.includes(social.sourceId))
    })).filter(venue => venue.activities.length);
    const mapped = venues.filter(venue => venue.position);
    const unmapped = venues.filter(venue => !venue.position);
    const mappedCount = mapped.reduce((total, venue) => total + venue.activities.length, 0);
    const unmappedCount = socials.length - mappedCount;
    mappedSocials.hidden = venues.length === 0;
    document.querySelector("#map-heading").textContent = `Venue map: ${dayTitles[state.day]}${state.day === "tue" ? " planning" : ""}`;
    document.querySelector("#map-results").textContent = `${mapped.length} map ${mapped.length === 1 ? "location" : "locations"} covering ${mappedCount} ${mappedCount === 1 ? "activity" : "activities"} \u2022 ${unmappedCount} ${unmappedCount === 1 ? "activity" : "activities"} awaiting an exact venue`;
    document.querySelector("#venue-map-layout").hidden = mapped.length === 0;
    document.querySelector("#unmapped-socials").hidden = unmapped.length === 0;
    venueList.replaceChildren();
    venueList.scrollTop = 0;
    unmappedList.replaceChildren();
    if (markers) markers.clearLayers();
    for (const venue of venues) {
      const card = element("article", "venue-card");
      card.dataset.venueId = venue.id;
      card.append(element("span", venue.provisional ? "number provisional" : "number", venue.number ?? "?"));
      const body = element("div");
      body.append(
        element("h3", "", venue.name),
        element("span", "venue-status", venue.locationNote)
      );
      if (venue.address) body.append(element("span", "address", venue.address));
      if (venue.position) {
        body.append(externalLink(
          venue.provisional ? "Directions to reference location" : "Open directions",
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`, "directions"
        ));
      }
      if (markers && venue.position) {
        const pin = element("span", venue.provisional ? "pin provisional" : "pin", venue.number);
        const icon = L.divIcon({ html: pin, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
        const popup = element("div");
        popup.append(element("strong", "", venue.name), element("p", "", venue.locationNote));
        for (const social of venue.activities) popup.append(activityDetails(social));
        const marker = L.marker(venue.position, { icon, title: venue.name, alt: venue.name })
          .addTo(markers).bindPopup(popup, { maxHeight: 260 });
        const focus = element("button", "directions map-focus", "Show on map");
        focus.type = "button";
        focus.setAttribute("aria-label", `Show ${venue.name} on map`);
        focus.addEventListener("click", () => {
          map.setView(venue.position, 17, { animate: false });
          marker.openPopup();
          document.querySelector("#venue-map").scrollIntoView({ block: "center" });
        });
        body.append(focus);
      }
      for (const social of venue.activities) body.append(activityDetails(social));
      card.append(body);
      (venue.position ? venueList : unmappedList).append(card);
    }
    if (map && mapped.length) {
      map.invalidateSize();
      map.fitBounds(mapped.map(venue => venue.position), { padding: [34, 34], maxZoom: 16, animate: false });
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
  map.on("resize", () => {
    const positions = markers.getLayers().map(marker => marker.getLatLng());
    if (positions.length) map.fitBounds(positions, { padding: [34, 34], maxZoom: 16, animate: false });
  });
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
