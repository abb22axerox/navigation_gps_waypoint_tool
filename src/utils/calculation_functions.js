import { XMLParser } from "fast-xml-parser";
// import * as GPS_location from "./get_gps_location.js";

export function get_time() {
  let now = new Date();
  return [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ];
}

export async function get_route_coordinates(index = null) {
  try {
    // Get GPX data from localStorage
    const data = localStorage.getItem('currentGPXFile');
    if (!data) {
      throw new Error('No GPX file loaded. Please upload a route first.');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "" // This removes the @ prefix
    });
    
    let parsedResult = parser.parse(data);
    console.log("Parsed result:", parsedResult);

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

export async function get_eta_for_waypoints(planned_start_time, planned_speed, index = null) {
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

export async function get_estimated_delay(start_time, eta_list, waypoint_index) {
  let route = await get_route_coordinates();
  // current_location = GPS_location.read_gps_data()
  let current_location = [59.64795, 18.81407];
  let current_speed = await get_speed();

  let planned_start_time = convert_unit("to-seconds", start_time);
  let planned_eta = convert_unit("to-seconds", eta_list[waypoint_index][1]);
  let remaining_distance = get_2point_route_distance(
    current_location,
    route[waypoint_index]
  );
  let travel_time_seconds = (remaining_distance / current_speed) * 3600;
  let current_eta = planned_start_time + travel_time_seconds;

  // Calculate delay with tolerance for floating-point precision
  let raw_delay = current_eta - planned_eta;
  raw_delay = Math.abs(raw_delay) < 1e-6 ? 0 : raw_delay;

  // True if late, False if early
  let is_delay_positive = raw_delay > 0;
  let delay = Math.abs(raw_delay);
  let formatted_delay = convert_unit("format-seconds", delay);

  // Calculate throttle_alert
  let max_delay_threshold = 300; // 5 minutes
  let throttle_alert =
    (Math.min(delay, max_delay_threshold) / max_delay_threshold) *
    (is_delay_positive ? 1 : -1);

  return [
    [remaining_distance, formatted_delay, is_delay_positive, throttle_alert],
  ];
}

export function get_current_location() {
  function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }
  // Simulate GPS readings by returning random coordinates near a base location
  const baseLocation = [59.75803, 18.62731]; // Replace with your base location
  const randomOffset = () => (getRandomInRange(0.3, 0.8)) * 0.0001; // Small random offset
  return [
    baseLocation[0] + randomOffset(), // Random latitude
    baseLocation[1] + randomOffset(), // Random longitude
  ];
}

export function formatCoordinates(coords) {
  if (!Array.isArray(coords)) return coords;
  
  const [lat, lon] = coords;
  
  function formatLatLon(value, isLat) {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    const direction = isLat 
      ? (value >= 0 ? 'N' : 'S')
      : (value >= 0 ? 'E' : 'W');
    
    return `${String(degrees).padStart(2, '0')}°${minutes.toFixed(3)}'${direction}`;
  }

  return `${formatLatLon(lat, true)}, ${formatLatLon(lon, false)}`;
}