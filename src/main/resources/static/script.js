/* ---------- Date helpers ---------- */
const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

function parseCourseDate(str) {
  if (!str) return null;
  const parts = str.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const [dayStr, monStr, yearStr] = parts;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const monKey = monStr.toLowerCase().replace(/[^a-z]/g, "");
  const month = MONTHS[monKey];
  if (month === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

function daysBetween(a, b) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((b - a) / MS_PER_DAY);
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

/* ---------- Data prep ---------- */
const courses = COURSES.map((c) => ({
  ...c,
  _starts: parseCourseDate(c.course_starts),
  _enrolEnds: parseCourseDate(c.enrolment_ends),
  _examRegEnds: parseCourseDate(c.exam_registration_ends),
  _examDate: parseCourseDate(c.exam_date),
  _durationNum: parseInt(c.duration_weeks, 10) || 0,
}));

function uniqueInstitutes(list) {
  const set = new Set();
  list.forEach((c) => {
    if (!c.institutes) return;
    c.institutes.split(",").forEach((part) => {
      const name = part.trim();
      if (name) set.add(name);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function courseInstitutes(c) {
  return (c.institutes || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueSorted(list, key) {
  return [...new Set(list.map((c) => c[key]).filter((v) => v))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function uniqueDatesSorted(list, dateKey, rawKey) {
  const map = new Map();
  list.forEach((c) => {
    if (c[rawKey]) map.set(c[rawKey], c[dateKey]);
  });
  return [...map.entries()]
    .sort((a, b) => (a[1] && b[1] ? a[1] - b[1] : 0))
    .map((e) => e[0]);
}

/* ---------- Populate filter controls ---------- */
const instituteSelect = document.getElementById("instituteSelect");
const professorList = document.getElementById("professorList");
const durationGroup = document.getElementById("durationGroup");
const courseStartsSelect = document.getElementById("courseStartsSelect");
const enrolmentEndsSelect = document.getElementById("enrolmentEndsSelect");
const examRegSelect = document.getElementById("examRegSelect");
const examDateSelect = document.getElementById("examDateSelect");

uniqueInstitutes(courses).forEach((v) => {
  const opt = document.createElement("option");
  opt.value = v;
  opt.textContent = v;
  instituteSelect.appendChild(opt);
});

uniqueSorted(courses, "professors").forEach((v) => {
  const opt = document.createElement("option");
  opt.value = v;
  professorList.appendChild(opt);
});

const durationValues = [...new Set(courses.map((c) => c._durationNum).filter((v) => v))].sort(
  (a, b) => a - b
);
durationValues.forEach((weeks) => {
  const label = document.createElement("label");
  label.innerHTML = `<input type="checkbox" value="${weeks}" class="durationCheck"> ${weeks} weeks`;
  durationGroup.appendChild(label);
});

function fillDateSelect(select, dateKey, rawKey) {
  uniqueDatesSorted(courses, dateKey, rawKey).forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}
fillDateSelect(courseStartsSelect, "_starts", "course_starts");
fillDateSelect(enrolmentEndsSelect, "_enrolEnds", "enrolment_ends");
fillDateSelect(examRegSelect, "_examRegEnds", "exam_registration_ends");
fillDateSelect(examDateSelect, "_examDate", "exam_date");

/* ---------- Controls ---------- */
const searchInput = document.getElementById("searchInput");
const professorInput = document.getElementById("professorInput");
const badgeSelect = document.getElementById("badgeSelect");
const openOnlyCheck = document.getElementById("openOnlyCheck");
const sortSelect = document.getElementById("sortSelect");
const resetBtn = document.getElementById("resetBtn");
const emptyResetBtn = document.getElementById("emptyResetBtn");

const courseGrid = document.getElementById("courseGrid");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const statTotal = document.getElementById("statTotal");
const statShown = document.getElementById("statShown");

statTotal.textContent = courses.length;

/* ---------- Filtering ---------- */
function getSelectedDurations() {
  return [...document.querySelectorAll(".durationCheck:checked")].map((el) =>
    parseInt(el.value, 10)
  );
}

function matchesFilters(c) {
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    const hay = `${c.course_name} ${c.professors} ${c.institutes}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  const profQ = professorInput.value.trim().toLowerCase();
  if (profQ && !(c.professors || "").toLowerCase().includes(profQ)) return false;

  if (instituteSelect.value && !courseInstitutes(c).includes(instituteSelect.value)) return false;

  if (badgeSelect.value === "__has_badge__" && !c.badge) return false;
  if (badgeSelect.value === "__no_badge__" && c.badge) return false;

  const durations = getSelectedDurations();
  if (durations.length && !durations.includes(c._durationNum)) return false;

  if (courseStartsSelect.value && c.course_starts !== courseStartsSelect.value) return false;
  if (enrolmentEndsSelect.value && c.enrolment_ends !== enrolmentEndsSelect.value) return false;
  if (examRegSelect.value && c.exam_registration_ends !== examRegSelect.value) return false;
  if (examDateSelect.value && c.exam_date !== examDateSelect.value) return false;

  if (openOnlyCheck.checked) {
    if (!c._enrolEnds || c._enrolEnds < TODAY) return false;
  }

  return true;
}

function sortCourses(list) {
  const val = sortSelect.value;
  const byDateAsc = (key) => (a, b) => {
    if (!a[key] && !b[key]) return 0;
    if (!a[key]) return 1;
    if (!b[key]) return -1;
    return a[key] - b[key];
  };
  switch (val) {
    case "name_asc":
      return list.sort((a, b) => a.course_name.localeCompare(b.course_name));
    case "enrolment_ends_soon":
      return list.sort(byDateAsc("_enrolEnds"));
    case "course_starts_soon":
      return list.sort(byDateAsc("_starts"));
    case "exam_reg_soon":
      return list.sort(byDateAsc("_examRegEnds"));
    case "exam_date_soon":
      return list.sort(byDateAsc("_examDate"));
    case "duration_asc":
      return list.sort((a, b) => a._durationNum - b._durationNum);
    case "duration_desc":
      return list.sort((a, b) => b._durationNum - a._durationNum);
    default:
      return list;
  }
}

/* ---------- Deadline meter ---------- */
function deadlineInfo(c) {
  if (!c._enrolEnds) return { status: "open", pct: 100, label: "No deadline data" };

  const daysLeft = daysBetween(TODAY, c._enrolEnds);

  if (daysLeft < 0) {
    return { status: "closed", pct: 0, label: "Enrolment closed" };
  }

  const spanDays = c._starts ? daysBetween(c._starts, c._enrolEnds) : 14;
  const totalSpan = spanDays > 0 ? spanDays : 14;
  const pct = Math.max(0, Math.min(100, (daysLeft / totalSpan) * 100));

  let status = "open";
  let label = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to enrol`;
  if (daysLeft === 0) {
    status = "soon";
    label = "Last day to enrol";
  } else if (daysLeft <= 3) {
    status = "soon";
  }

  return { status, pct, label };
}

/* ---------- Render ---------- */
function renderCard(c) {
  const { status, pct, label } = deadlineInfo(c);
  const statusText =
    status === "closed" ? "Closed" : status === "soon" ? "Closing soon" : "Open";

  const card = document.createElement("article");
  card.className = `course-card status-${status}`;

  card.innerHTML = `
    <div class="card-top">
      <h3 class="course-title">${escapeHtml(c.course_name)}</h3>
    </div>
    ${c.badge ? `<span class="badge">${escapeHtml(c.badge)}</span>` : ""}
    <div class="course-meta">
      <div><strong>${escapeHtml(c.professors || "—")}</strong></div>
      <div>${escapeHtml(c.institutes || "—")}</div>
    </div>
    <div class="meta-row"><span class="k">Duration</span><span class="v">${escapeHtml(c.duration_weeks || "—")}</span></div>
    <div class="meta-row"><span class="k">Course starts</span><span class="v">${escapeHtml(c.course_starts || "—")}</span></div>
    <div class="meta-row"><span class="k">Exam registration ends</span><span class="v">${escapeHtml(c.exam_registration_ends || "—")}</span></div>
    <div class="meta-row"><span class="k">Exam date</span><span class="v">${escapeHtml(c.exam_date || "—")}</span></div>
    <div class="deadline-block">
      <div class="deadline-label"><span>Enrolment ends ${escapeHtml(c.enrolment_ends || "—")}</span><span class="days-left">${label}</span></div>
      <div class="deadline-bar"><div class="deadline-fill" style="width:${pct}%"></div></div>
      <span class="status-tag">${statusText}</span>
    </div>
    ${
      c.register_url
        ? `<a class="register-btn" href="${escapeHtml(c.register_url)}" target="_blank" rel="noopener noreferrer">Register now &rarr;</a>`
        : `<span class="register-btn register-btn-disabled">Registration link unavailable</span>`
    }
  `;
  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  const filtered = sortCourses(courses.filter(matchesFilters));

  courseGrid.innerHTML = "";
  const frag = document.createDocumentFragment();
  filtered.forEach((c) => frag.appendChild(renderCard(c)));
  courseGrid.appendChild(frag);

  statShown.textContent = filtered.length;
  resultCount.textContent =
    filtered.length === courses.length
      ? "Showing all courses"
      : `Showing ${filtered.length} of ${courses.length} courses`;

  emptyState.hidden = filtered.length !== 0;
  courseGrid.hidden = filtered.length === 0;
}

/* ---------- Events ---------- */
[
  searchInput,
  professorInput,
  instituteSelect,
  badgeSelect,
  courseStartsSelect,
  enrolmentEndsSelect,
  examRegSelect,
  examDateSelect,
  sortSelect,
].forEach((el) => el.addEventListener("input", render));

openOnlyCheck.addEventListener("change", render);
durationGroup.addEventListener("change", render);

function resetFilters() {
  searchInput.value = "";
  professorInput.value = "";
  instituteSelect.value = "";
  badgeSelect.value = "";
  courseStartsSelect.value = "";
  enrolmentEndsSelect.value = "";
  examRegSelect.value = "";
  examDateSelect.value = "";
  openOnlyCheck.checked = false;
  sortSelect.value = "name_asc";
  document.querySelectorAll(".durationCheck").forEach((el) => (el.checked = false));
  render();
}

resetBtn.addEventListener("click", resetFilters);
emptyResetBtn.addEventListener("click", resetFilters);

/* ---------- Init ---------- */
sortSelect.value = "name_asc";
render();