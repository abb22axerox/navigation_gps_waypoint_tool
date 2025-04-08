import datetime from "datetime";
import time from "time";
import math from "mathjs";
import * as ET from "xml2js";
import * as GPS_location from "./get_gps_location.js";

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
  let GPX_PATH = "test/Skippo_Test rutt_25-03-2025_2232.gpx";
  try {
    // In JS, we need to read and parse the file:
    const fs = await import("fs");
    let data = fs.readFileSync(GPX_PATH, "utf8");

    let route = [];
    let prev_waypoint = null; // Variable to track the previous waypoint

    let parsedResult;
    await new Promise((resolve, reject) => {
      ET.parseString(data, (err, result) => {
        if (err) reject(err);
        parsedResult = result;
        resolve();
      });
    });

    // Find all route points (<rtept>) if they exist
    if (
      parsedResult &&
      parsedResult.gpx &&
      parsedResult.gpx.rte &&
      parsedResult.gpx.rte[0] &&
      parsedResult.gpx.rte[0].rtept
    ) {
      parsedResult.gpx.rte[0].rtept.forEach((rtept) => {
        let lat = parseFloat(rtept.$.lat);
        let lon = parseFloat(rtept.$.lon);
        let waypoint = [lat, lon];

        if (
          prev_waypoint === null ||
          waypoint[0] !== prev_waypoint[0] ||
          waypoint[1] !== prev_waypoint[1]
        ) {
          route.push([lat, lon]); // Add if it's not the same as the previous one
          prev_waypoint = waypoint; // Update previous waypoint
        }
        // else:
        //     print(f"Discarded duplicate waypoint: ({lat}, {lon})")
        // Converted comment, but kept text. (No new comment text added, only the '#' changed to '//')
      });
    }

    if (!route.length) {
      console.log("Warning: No route points found in GPX file.");
    }

    if (index !== null) {
      return route[index];
    } else {
      return route;
    }
  } catch (e) {
    console.log("Error reading GPX file: " + e);
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

export async function get_speed() {
  let current_location = [59.75902, 18.62829];
  let time1 = convert_unit("to-seconds", get_time());

  // Simulate a delay of 0.5 seconds
  await new Promise((r) => setTimeout(r, 500));

  let current_location2 = [59.75903, 18.62831];
  let time2 = convert_unit("to-seconds", get_time());
  let time_diff = time2 - time1;
  let distance = get_2point_route_distance(current_location, current_location2);

  if (time_diff === 0) {
    return 0.0;
  }

  time_diff = time_diff / 3600; // Convert seconds to hours

  return distance / time_diff;
}

export async function calculate_eta_for_waypoints(
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

export async function get_estimated_delay(
  start_time,
  eta_list,
  waypoint_index
) {
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
