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
        return parseFloat(data.battery_level);
      }
      return null;

    default:
      return null;
  }
}

export async function get_route_coordinates(index = null) {
  try {
    // Get GPX data from localStorage
    const data = localStorage.getItem("currentGPXFile");
    if (!data) {
      throw new Error("No GPX file loaded. Please upload a route first.");
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "", // This removes the @ prefix
    });

    let parsedResult = parser.parse(data);

    let route = [];
    let prev_waypoint = null;

    if (
      parsedResult &&
      parsedResult.gpx &&
      parsedResult.gpx.rte &&
      parsedResult.gpx.rte.rtept
    ) {
      parsedResult.gpx.rte.rtept.forEach((rtept) => {
        let lat = parseFloat(rtept["lat"]);
        let lon = parseFloat(rtept["lon"]);
        let waypoint = [lat, lon];

        if (
          prev_waypoint === null ||
          waypoint[0] !== prev_waypoint[0] ||
          waypoint[1] !== prev_waypoint[1]
        ) {
          route.push(waypoint);
          prev_waypoint = waypoint;
        }
      });
    }

    if (!route.length) {
      console.log("Warning: No route points found in GPX file.");
    }

    return index !== null ? route[index] : route;
  } catch (e) {
    console.log("Error reading GPX file:", e);
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
  let throttle_alert;
  if (current_speed < 0.1) {
    throttle_alert = is_late ? 1 : -1;
  } else {
    const fine = 10, coarse = 300;
    if (delay_abs <= fine) {
      throttle_alert = (delay_abs / fine) * 0.5 * (is_late ? -1 : 1);
    } else {
      throttle_alert = (Math.min(delay_abs, coarse) / coarse) * (is_late ? -1 : 1);
    }
  }

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

export function get_bearing(coord1, coord2) {
  // Convert latitudes/longitudes to radians
  const lat1 = (coord1[0] * Math.PI) / 180;
  const lat2 = (coord2[0] * Math.PI) / 180;
  const deltaLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;

  // Calculate bearing using the haversine formula components
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;

  // Ensure the bearing is normalized to 0-360 degrees
  return (brng + 360) % 360;
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

export async function calculate_dot_product(passed_waypoint, next_waypoint) {
  const currentPos = await getLiveData("coordinates");
  if (!currentPos) return false;

  // Create a vector representing the route's direction from the passed waypoint to the next waypoint.
  const direction = [
    next_waypoint[0] - passed_waypoint[0],
    next_waypoint[1] - passed_waypoint[1],
  ];

  // Create a vector from the passed waypoint to the current location.
  const toCurrent = [
    currentPos[0] - passed_waypoint[0],
    currentPos[1] - passed_waypoint[1],
  ];

  // Calculate dot product between the two vectors.
  const dot = direction[0] * toCurrent[0] + direction[1] * toCurrent[1];

  // If dot product is positive, the current location is "past" the passed waypoint.
  return dot > 0;
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
