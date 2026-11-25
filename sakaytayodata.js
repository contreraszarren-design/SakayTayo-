// Shared data + seat logic for the passenger page (sakaytayorides) and the driver dashboard.
// Both pages read and write the same localStorage keys, so they stay in sync in the same browser.
const RIDES_KEY = "sakaytayo_rides";
const RESV_KEY = "sakaytayo_reservations";

const SEED_RIDES = [
  { id: "r1", driver: "Mark Reyes", car: "Toyota Vios", plate: "ABC 123", from: "San Jose Town Proper / Poblacion", to: "Batangas State University - Alangilan Campus", off: 1, time: "06:30", seats: 4, booked: ["Ana Cruz"], closed: false },
  { id: "r2", driver: "Jane Dizon", car: "Honda City", plate: "XYZ 482", from: "San Jose Public Market", to: "Batangas State University - Alangilan Campus", off: 1, time: "07:00", seats: 3, booked: ["Leo Garcia", "Kim Perez", "Rey Santos"], closed: false },
  { id: "r3", driver: "Paolo Mendoza", car: "Mitsubishi Mirage", plate: "DEF 906", from: "Lipa City Proper / SM City Lipa", to: "Batangas State University - Pablo Borbon Campus", off: 2, time: "06:45", seats: 4, booked: [], closed: false },
  { id: "r4", driver: "Carla Villanueva", car: "Suzuki Ertiga", plate: "GHI 357", from: "San Jose Town Proper / Poblacion", to: "Lipa City Proper / SM City Lipa", off: 3, time: "15:30", seats: 5, booked: ["Ben Lim"], closed: false },
  { id: "r5", driver: "Mark Reyes", car: "Toyota Vios", plate: "ABC 123", from: "San Jose Town Proper / Poblacion", to: "Batangas State University - Alangilan Campus", off: -3, time: "06:30", seats: 4, booked: [], closed: false },
  { id: "r6", driver: "Jane Dizon", car: "Honda City", plate: "XYZ 482", from: "San Jose Public Market", to: "SM City Batangas", off: -6, time: "16:00", seats: 3, booked: ["Kim Perez"], closed: false },
];

// Reservation statuses: Pending -> Approved | Declined (by driver), Cancelled (by passenger or removed by driver)
const SEED_RESV = [
  { id: "s1", rideId: "r5", passenger: "You", status: "Approved" },
  { id: "s2", rideId: "r6", passenger: "You", status: "Approved" },
  { id: "s3", rideId: "r1", passenger: "Miguel Tan", status: "Pending" },
  { id: "s4", rideId: "r1", passenger: "Dan Uy", status: "Pending" },
  { id: "s5", rideId: "r3", passenger: "Sofia Ramos", status: "Pending" },
];

const CURRENT = JSON.parse(localStorage.getItem("sakaytayo_user") || "{}");
const ME_ID = CURRENT.email || "You";
function signOut() {
  localStorage.removeItem("sakaytayo_session");
  localStorage.removeItem("sakaytayo_user");
  localStorage.removeItem("sakaytayo_role");
  location.href = "sakaytayolandingpage.html";
}

const load = (k, seed) => JSON.parse(localStorage.getItem(k) || "null") || seed;
let RIDES = load(RIDES_KEY, SEED_RIDES);
let resv = load(RESV_KEY, SEED_RESV).map((x) => ({ ...x, status: x.status === "Reserved" ? "Approved" : x.status, passenger: (!x.passenger || x.passenger === "You") && CURRENT.role === "passenger" ? ME_ID : x.passenger || "You" }));
function saveRides() { localStorage.setItem(RIDES_KEY, JSON.stringify(RIDES)); }
function save() { localStorage.setItem(RESV_KEY, JSON.stringify(resv)); }

// A registered driver's verified route becomes a ride that passengers can find and request.
(function addRegisteredDriverRide() {
  const u = JSON.parse(localStorage.getItem("sakaytayo_user") || "{}");
  if (u.role !== "driver" || !u.verificationStatus || !u.fullName) return;
  const existing = RIDES.find((r) => r.id === "reg-" + u.email);
  const ride = { id: "reg-" + u.email, driver: u.fullName, car: u.vehicleModel || u.carType, plate: u.plateNumber, from: u.startLocation, to: u.destinationLocation,
    off: existing ? existing.off : 1, time: (u.schedule && u.schedule.startTime) || "07:00", seats: Number(u.availableSeats) || 3,
    booked: existing ? existing.booked : [], closed: existing ? existing.closed : false };
  if (!existing) RIDES.push(ride); // created once, so later seat changes by the driver are kept
})();
saveRides(); save();

const dateOf = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // local date, not UTC
// Posted rides keep their real date; "off" (days from today) is recomputed so the date never drifts.
const offFromDate = (s) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(); return Math.round((new Date(y, m - 1, d) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000); };
RIDES.forEach((r) => { if (r.date) r.off = offFromDate(r.date); });
const nice = (d) => d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
const clock = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const rideById = (id) => RIDES.find((r) => r.id === id);
const mineFor = (id) => resv.find((r) => r.rideId === id && r.passenger === ME_ID && (r.status === "Pending" || r.status === "Approved"));

// Only approved reservations take a seat. Pending requests do not hold one.
const approvedFor = (r) => resv.filter((x) => x.rideId === r.id && x.status === "Approved");
const taken = (r) => r.booked.length + approvedFor(r).length;
const openSeats = (r) => r.seats - taken(r);
const seatsLeft = (r) => (r.closed ? 0 : Math.max(openSeats(r), 0));
