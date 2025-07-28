import { XMLParser } from "fast-xml-parser";
import { liveGpsData, lastGpsUpdate } from "src/boot/live-gps";

export function get_time() {
  let now = new Date();
  return [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ];
}

export function isLiveDataFresh(thresholdSeconds = 2) {
  if (!liveGpsData.value) return false;
  const now = Date.now();
  return (now - lastGpsUpdate.value) <= thresholdSeconds * 1000;
}

export async function getLiveData(type) {
  // Wait until liveGpsData is available
  const waitForData = () => new Promise((resolve) => {
    const stop = setInterval(() => {
      if (liveGpsData.value) {
        clearInterval(stop);
        resolve(liveGpsData.value);
      }
    }, 100);
  });

  const data = liveGpsData.value || await waitForData();

  switch (type) {
    case "coordinates":
      if (data.lat !== undefined && data.lon !== undefined) {
        return [parseFloat(data.lat), parseFloat(data.lon)];
      }
      return null;

    case "speed":
      if (data.speed !== undefined) {
        // SensorLog speed is in m/s, convert to knots
        return parseFloat(data.speed) * 1.94384;
      }
      return null;

    case "course":
      if (data.course !== undefined) {
        // Some SensorLog data uses -1 for invalid course
        const course = parseFloat(data.course);
        return course >= 0 ? course : null;
      }
      return null;

    case "trueHeading":
      if (data.trueHeading !== undefined) {
        // Some SensorLog data uses -1 for invalid course
        const trueHeading = parseFloat(data.trueHeading);
        return trueHeading >= 0 ? trueHeading : null;
      }
      return null;

    case "altitude":
      if (data.altitude !== undefined) {
        return parseFloat(data.altitude);
      }
      return null;

    case "time":
      if (data.time !== undefined) {
        // Return as string or parse as needed
        return data.time;
      }
      return null;

    case "device_id":
      if (data.device_id !== undefined) {
        return data.device_id;
      }
      return null;

    case "battery_level":
      if (data.battery_level !== undefined) {
        return parseFloat(data.battery_level) * 100; // ← Multiply by 100
      }
      return null;

    default:
      return null;
  }
}

export async function get_route_coordinates(index = null) {
  try {
    // Get raw GPX XML from localStorage
    const data = localStorage.getItem("currentGPXFile");
    if (!data) {
      throw new Error("No GPX file loaded. Please upload a route first.");
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "", // Remove the '@' prefix
    });
    const parsed = parser.parse(data);
    const route = [];
    let prevWaypoint = null;

    // Utility to append unique points
    function addPoints(ptArray) {
      ptArray.forEach((pt) => {
        const lat = parseFloat(pt.lat ?? pt['@lat']);
        const lon = parseFloat(pt.lon ?? pt['@lon']);
        if (isNaN(lat) || isNaN(lon)) return;
        const wp = [lat, lon];
        if (
          !prevWaypoint ||
          wp[0] !== prevWaypoint[0] ||
          wp[1] !== prevWaypoint[1]
        ) {
          route.push(wp);
          prevWaypoint = wp;
        }
      });
    }

    // 1️⃣ Handle <rte><rtept>
    if (
      parsed.gpx?.rte?.rtept
    ) {
      const rtepts = Array.isArray(parsed.gpx.rte.rtept)
        ? parsed.gpx.rte.rtept
        : [parsed.gpx.rte.rtept];
      addPoints(rtepts);
    }

    // 2️⃣ Handle <trk><trkseg><trkpt>
    if (parsed.gpx?.trk) {
      const trks = Array.isArray(parsed.gpx.trk)
        ? parsed.gpx.trk
        : [parsed.gpx.trk];
      trks.forEach((trk) => {
        const segs = Array.isArray(trk.trkseg)
          ? trk.trkseg
          : [trk.trkseg];
        segs.forEach((seg) => {
          if (!seg.trkpt) return;
          const trkpts = Array.isArray(seg.trkpt)
            ? seg.trkpt
            : [seg.trkpt];
          addPoints(trkpts);
        });
      });
    }

    if (!route.length) {
      console.warn("Warning: No route points found in GPX file.");
    }

    return index !== null ? route[index] : route;
  } catch (err) {
    console.error("Error reading GPX file:", err);
    return [];
  }
}

export function get_2point_route_distance(coord1, coord2) {
  // Extract latitude and longitude from both coordinate pairs
  let lat1 = coord1[0];
  let lon1 = coord1[1];
  let lat2 = coord2[0];
  let lon2 = coord2[1];

  // Convert latitude and longitude from degrees to radians
  lat1 = (lat1 * Math.PI) / 180;
  lon1 = (lon1 * Math.PI) / 180;
  lat2 = (lat2 * Math.PI) / 180;
  lon2 = (lon2 * Math.PI) / 180;

  // Haversine formula
  let dlat = lat2 - lat1;
  let dlon = lon2 - lon1;
  let a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Earth's radius in nautical miles
  let R = 3440.065; // Nautical miles
  let distance = R * c;

  return distance;
}

export function get_total_route_distance(coordinates_list) {
  let total_distance = 0.0;

  // Iterate through coordinate pairs
  for (let i = 0; i < coordinates_list.length - 1; i++) {
    total_distance += get_2point_route_distance(
      coordinates_list[i],
      coordinates_list[i + 1]
    );
  }

  return total_distance;
}

export function convert_unit(operation, value) {
  if (operation === "to-seconds") {
    // Convert [hour, minute, second, millisecond] to total seconds
    let seconds =
      value[0] * 3600 + // Hours to seconds
      value[1] * 60 + // Minutes to seconds
      value[2] + // Add seconds
      value[3] / 1000; // Milliseconds to seconds
    return seconds;
  } else if (operation === "format-seconds") {
    // Convert total seconds to [hour, minute, second, millisecond]
    let value_h = Math.floor(value / 3600) % 24; // Extract hours (mod 24 for 24-hour format)
    let remaining_seconds = value % 3600;
    let value_m = Math.floor(remaining_seconds / 60); // Extract minutes
    let value_s = Math.floor(remaining_seconds % 60); // Extract seconds
    let fraction = value - Math.floor(value); // Fractional part of seconds
    let value_milli = Math.round(fraction * 1000); // Convert fraction to milliseconds

    return [value_h, value_m, value_s, value_milli];
  }
}

export async function get_eta_for_waypoints(
  planned_start_time,
  planned_speed,
  index = null
) {
  let route = await get_route_coordinates(); // Assumes route[0] is the planned starting waypoint
  let start_time = convert_unit("to-seconds", planned_start_time);

  let route_eta_list = [];
  let cumulative_distance = 0.0;
  let prev_waypoint = route[0];

  // Add the start waypoint (ETA is the start time)
  route_eta_list.push([prev_waypoint, planned_start_time]);

  for (let i = 1; i < route.length; i++) {
    let waypoint = route[i];
    cumulative_distance += get_2point_route_distance(prev_waypoint, waypoint);
    let travel_time_seconds = (cumulative_distance / planned_speed) * 3600;
    let eta_seconds = start_time + travel_time_seconds;

    let formatted_eta = convert_unit("format-seconds", eta_seconds);
    route_eta_list.push([waypoint, formatted_eta]);
    prev_waypoint = waypoint; // Update previous waypoint for next iteration
  }

  if (index !== null) {
    return route_eta_list[index];
  } else {
    return route_eta_list;
  }
}

export async function get_estimated_delay(eta_list, waypoint_index, current_speed) {
  const route = await get_route_coordinates();
  const current_location = await getLiveData("coordinates");
  const next_waypoint = route[waypoint_index];

  // 1. Remaining distance in NM
  const remaining_distance = get_2point_route_distance(current_location, next_waypoint);

  // 2. Planned ETA (seconds)
  const planned_eta_seconds = convert_unit("to-seconds", eta_list[waypoint_index][1]);

  // 3. Predict arrival time at current speed
  let predicted_eta_seconds;
  if (current_speed > 0.1) {
    const now_seconds = convert_unit("to-seconds", get_time());
    const travel_time = (remaining_distance / current_speed) * 3600;
    predicted_eta_seconds = now_seconds + travel_time;
  } else {
    predicted_eta_seconds = Infinity;
  }

  // 4. Compute raw_delay (force to 0 if predicted ETA is infinite)
  let raw_delay;
  if (!isFinite(predicted_eta_seconds)) {
    raw_delay = 0;
  } else {
    raw_delay = predicted_eta_seconds - planned_eta_seconds;  // +ve = late, –ve = early
  }

  const is_late = raw_delay > 0;
  const delay_abs = Math.abs(raw_delay);
  const formatted_delay = convert_unit("format-seconds", delay_abs);

  // 5. Throttle suggestion
  const coarse = 300;
  const exponent = 0.3; // Updated exponent for 0.7 at 15 sec

  const clamped_delay = Math.min(delay_abs, coarse);
  const scaled = Math.pow(clamped_delay / coarse, exponent);
  let throttle_alert = scaled * (is_late ? 1 : -1);

  // console.log(raw_delay, formatted_delay, is_late, throttle_alert);

  // ─── Return in [distance, rawDelay, formattedDelay, isLate, throttle] ───
  return [
    remaining_distance,  // [0]
    raw_delay,           // [1] now 0 if predicted ETA was Infinity
    formatted_delay,     // [2]
    is_late,             // [3]
    throttle_alert       // [4]
  ];
}

export function formatCoordinates(coords) {
  if (!Array.isArray(coords)) return coords;

  const [lat, lon] = coords;

  function formatLatLon(value, isLat) {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    const direction = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

    return `${String(degrees).padStart(2, "0")}°${minutes.toFixed(
      3
    )}'${direction}`;
  }

  return `${formatLatLon(lat, true)}, ${formatLatLon(lon, false)}`;
}

// Add this new function to your calculation_functions.js
export function calculateRouteMidpoint(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  // Calculate the average of all latitudes and longitudes
  const sumLat = coordinates.reduce((sum, coord) => sum + coord[0], 0);
  const sumLng = coordinates.reduce((sum, coord) => sum + coord[1], 0);

  return [sumLat / coordinates.length, sumLng / coordinates.length];
}

// Helper functions for equirectangular projection using p2 as reference point
const R = 6371000;
const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

function projectToXY([lat, lon], refLat, refLon) {
  const lat0 = toRad(refLat);
  return {
    x: toRad(lon - refLon) * R * Math.cos(lat0),
    y: toRad(lat - refLat) * R
  };
}

function projectToLatLon({ x, y }, refLat, refLon) {
  const lat = refLat + toDeg(y / R);
  const lon = refLon + toDeg(x / (R * Math.cos(toRad(refLat))));
  return [lat, lon];
}

/**
 * Returns a cutline (angle bisector) through p2 between segments p1->p2 and p2->p3,
 * extended symmetrically by `extension` meters.
 */
export function get_crossing_outline(p1, p2, p3, extension = 50) {
  // Project points into local XY with p2 as origin
  const A = projectToXY(p1, p2[0], p2[1]);
  const B = projectToXY(p3, p2[0], p2[1]);

  // Vectors from p2 to p1 and p3
  const v1 = { x: -A.x, y: -A.y };
  const v2 = { x: B.x, y: B.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (!n1 || !n2) return null;

  // Unit directions
  const u1 = { x: v1.x / n1, y: v1.y / n1 };
  const u2 = { x: v2.x / n2, y: v2.y / n2 };

  // Angle bisector direction
  const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
  const bisLen = Math.hypot(bis.x, bis.y);
  if (!bisLen) return null;
  const bisUnit = { x: bis.x / bisLen, y: bis.y / bisLen };

  // Perpendicular to bisector (cut direction)
  const cutDir = { x: -bisUnit.y, y: bisUnit.x };

  // Extend both ways by `extension` meters
  const E1 = { x: cutDir.x * extension, y: cutDir.y * extension };
  const E2 = { x: -cutDir.x * extension, y: -cutDir.y * extension };

  // Debug: verify distances
  const checkE1 = projectToXY(projectToLatLon(E1, p2[0], p2[1]), p2[0], p2[1]);
  const checkE2 = projectToXY(projectToLatLon(E2, p2[0], p2[1]), p2[0], p2[1]);
  // console.log(
  //   'Cutline lengths (m):',
  //   Math.hypot(checkE1.x, checkE1.y).toFixed(2),
  //   Math.hypot(checkE2.x, checkE2.y).toFixed(2),
  //   'expected:', extension
  // );

  // Return endpoints in [lat, lon] form
  return [
    projectToLatLon(E1, p2[0], p2[1]),
    projectToLatLon(E2, p2[0], p2[1])
  ];
};

export async function check_crossing_status(p1, p2, p3, extension = 50) {
  const currentPos = await getLiveData('coordinates');
  if (!currentPos) return { dot: null, cutLine: null };

  const cutLine = get_crossing_outline(p1, p2, p3, extension);
  if (!cutLine) return { dot: null, cutLine: null };

  // Recompute bisector & cutDir (as in get_crossing_outline)
  const A = projectToXY(p1, p2[0], p2[1]);
  const B = projectToXY(p3, p2[0], p2[1]);
  const v1 = { x: -A.x, y: -A.y };
  const v2 = { x:  B.x, y:  B.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  const u1 = { x: v1.x / n1, y: v1.y / n1 };
  const u2 = { x: v2.x / n2, y: v2.y / n2 };

  const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
  const bisLen = Math.hypot(bis.x, bis.y);
  if (!bisLen) return { dot: null, cutLine };
  const bisUnit = { x: bis.x / bisLen, y: bis.y / bisLen };

  // Perp to bisector is your segment direction:
  const cutDir = { x: -bisUnit.y, y: bisUnit.x };

  // Boat in XY relative to p2:
  const boatXY = projectToXY(currentPos, p2[0], p2[1]);

  // 1) Check segment extent
  const projection = boatXY.x * cutDir.x + boatXY.y * cutDir.y;
  if (Math.abs(projection) > extension) {
    return { dot: null, cutLine };
  }

  // 2) Now side-of-bisector
  const dot = boatXY.x * bisUnit.x + boatXY.y * bisUnit.y;
  return { dot, cutLine };
}

/**
 * Read the planned speed (knots) from localStorage.
 */
export function get_target_speed() {
  const v = localStorage.getItem('plannedSpeed');
  return v !== null ? parseFloat(v) : 0;
}

/**
 * Compute bearing (° from North) from coord1 → coord2.
 * coord = [lat, lon]
 */
export function calculate_bearing(coord1, coord2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;

  const [φ1, λ1] = coord1.map(toRad);
  const [φ2, λ2] = coord2.map(toRad);
  const Δλ = λ2 - λ1;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = toDeg(Math.atan2(y, x));
  // Normalize to [0,360)
  return (θ + 360) % 360;
}

/**
 * Given current course and target course, return a normalized
 * “course alert” in [-1 … +1], where ±1 = 90° off, 0 = on‑course.
 */
export function get_course_alert(currentCourse, targetCourse) {
  // Shortest signed angular difference in [−180, +180]
  let diff = ((targetCourse - currentCourse + 540) % 360) - 180;

  // Scale linearly: ±90° → ±1, clamp to [-1, +1]
  let scaled = diff / 90;
  return Math.max(-1, Math.min(1, scaled));
}

// Add proper error handling for async operations
export async function sendMessage(message) {
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, 5000); // 5 second timeout

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  } catch (error) {
    console.warn("Message error:", error);
    return null; // or a suitable fallback value
  }
}
