# GPS Waypoint Navigation Tool
<img width="1440" alt="Skärmavbild 2025-05-05 kl  09 22 17" src="https://github.com/user-attachments/assets/38f6346b-73c5-4246-81eb-80e4411e37d6" />

The GPS Waypoint Navigation Tool is a precision marine navigation system designed to help ship captains and maritime operators follow predefined routes with second‑level accuracy. Built with Vue.js and the Quasar Framework, this tool integrates real‑time GPS data via a WebSocket-connected GPS bridge server — enabling captains to track their vessel's progress, adjust speed, and receive precise ETAs at each waypoint.

By leveraging detailed route calculations and real‑time updates, the system displays vital navigation metrics on the **IndexPage**. Here, you will see:

- **Current Speed:** This value shows the vessel's speed (in knots) based on real‑time GPS data.
- **Delay Indicator:** This reflects any deviation from the planned schedule. Even second‑level delays are calculated, ensuring high precision.
- **Next Waypoint Information:** Displays the upcoming waypoint position along with the estimated arrival time, so you know the exact time (to the second) when the vessel should reach its next coordinate.
- **Throttle Slider:** The throttle slider offers a visual representation of throttle adjustments required to correct speed or compensate for delays. A positive or negative value indicates an alert to either speed up or decelerate to stay on schedule.

This marine‑oriented solution provides:

- **Second‑precision timing:** Ensure that routes and arrival times are monitored down to the second—a critical factor in tight navigational scenarios.
- **Real‑time feedback:** The integration with a GPS Bridge Server allows data to be streamed live, so captains constantly have the most current information at their fingertips.
- **Intuitive interfaces:** With responsive layouts, interactive maps, and clear data dashboards, even complex information is presented in a user‑friendly way.

Whether you are navigating coastal waters, busy shipping lanes, or open seas, the GPS Waypoint Navigation Tool empowers you with the precision and control you need for safe, timely, and efficient marine navigation.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Calculation Functions Explained](#calculation-functions-explained)
- [GPS Bridge Server](#gps-bridge-server)
- [Issues and Solutions](#issues-and-solutions)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Intuitive UI:** Uses Quasar’s built‑in responsive classes.
- **Route Visualization:** Displays a route on an interactive Leaflet map with waypoints and a navigation boat marker.
- **Dashboard & Controls:** Shows current speed, delay, next waypoint information, and a throttle slider.
- **GPS Integration:** Retrieves GPS data via a WebSocket connection from a locally running GPS Bridge Server.
- **ETA & Delay Calculation:** Computes estimated arrival times for each waypoint and notifies the user if delays occur.
- **GPX File Upload:** Allows users to upload a GPX file to load route waypoints.

## Project Structure

```
├── src
│   ├── boot
│   │   └── gps-listener.js         // Boot file managing GPS WebSocket connection and events
│   ├── layouts
│   │   └── MainLayout.vue          // Main layout with responsive header and burger menu
│   ├── pages
│   │   ├── IndexPage.vue           // Dashboard, map, and navigation controls
│   │   ├── InfoPage.vue            // Route information and waypoint details
│   │   ├── SettingsPage.vue        // Navigation parameters, GPS2IP settings, GPX file upload
│   │   └── ConsolePage.vue         // System log console for monitoring events
│   └── utils
│       ├── calculation_functions.js// All the functions for route calculations, ETAs, and formatting
│       └── gps-bridge-server.mjs   // Node.js script that bridges GPS data to WebSocket clients
├── start-bridge.sh                 // Shell script to start the GPS bridge server
└── README.md                       // Project documentation
```

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/navigation_gps_waypoint_tool.git
   cd navigation_gps_waypoint_tool
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure the Environment:**
   - Ensure that you have Node.js installed.
   - Edit the `start-bridge.sh` file if you need to change the default GPS2IP host and port.

## Usage

### Starting the GPS Bridge Server

Run the shell script to start the GPS bridge server:

```bash
./start-bridge.sh -h <PHONE_SERVER_IP> -p <PORT>
```

This script connects to your GPS2IP device and starts a WebSocket server (listening on port 3001) that streams GPS data to the client application.

### Running the Application

Start the frontend using Quasar CLI:

```bash
quasar dev
```

Navigate to [http://localhost:8080](http://localhost:8080) to access the application. Upload a GPX file from the **Settings** page, view your route on the **Dashboard (IndexPage)**, check route details in **InfoPage**, and monitor system logs in **ConsolePage**.

## Calculation Functions Explained

The core calculations for navigation and route information are handled in `src/utils/calculation_functions.js`:

- **get_time()**  
  Returns the current time as an array `[hours, minutes, seconds, milliseconds]`.

- **get_route_coordinates(index = null)**  
  Parses the GPX file stored in localStorage and returns an array of route waypoints. If an index is provided, returns a specific waypoint.

- **get_2point_route_distance(coord1, coord2)**  
  Uses the Haversine formula to calculate the distance between two GPS coordinates in nautical miles.

- **get_total_route_distance(coordinates_list)**  
  Iterates through all waypoints to sum the distances between consecutive points.

- **convert_unit(operation, value)**  
  Converts between different time units:  
  - `"to-seconds"` transforms a time array (hours, minutes, seconds, milliseconds) into total seconds.  
  - `"format-seconds"` converts total seconds back into a [hours, minutes, seconds, milliseconds] format.

- **get_eta_for_waypoints(planned_start_time, planned_speed, index = null)**  
  Computes estimated arrival times (ETA) for each waypoint based on the planned start time, route distances, and planned speed. Returns ETAs as formatted time arrays.

- **get_estimated_delay(eta_list, waypoint_index, current_speed)**  
  Calculates the delay between the current time and the planned ETA for a waypoint. Returns details such as:
  - Remaining distance to the waypoint
  - Absolute delay in seconds
  - Formatted delay (as time array)
  - A boolean indicating if the delay is positive (late)
  - A throttle alert value to adjust the navigation response

- **get_current_location()**  
  Retrieves the current GPS location from the gpsListener. If data is already available, resolves immediately; otherwise, waits for a new GPS event.

- **updateSpeed(prevPos, prevTime, newPos, currentTime)**  
  Computes the speed between two GPS coordinates over the elapsed time.

- **formatCoordinates(coords)**  
  Formats the latitude and longitude into a human-readable string with degrees and minutes (e.g., “07°48.000'N, 12°34.500'E”).

- **get_bearing(coord1, coord2)**  
  Calculates the bearing (direction) between two geographic coordinates in degrees.

- **calculateRouteMidpoint(coordinates)**  
  Calculates the midpoint of a route by averaging all the waypoints.

- **calculate_dot_product(passed_waypoint, next_waypoint)**  
  Determines if the current position is “past” a particular waypoint by computing the dot product between the route vector and the vector to the current location.

## GPS Bridge Server

The GPS Bridge Server script is located in `src/utils/gps-bridge-server.mjs` and is started via the `start-bridge.sh` script. It:
- Connects to a GPS2IP device via TCP.
- Receives NMEA data from the GPS2IP device.
- Broadcasts the GPS data via a WebSocket server so that the Vue client can receive real‑time location updates.

## Issues and Solutions

Throughout development, several challenges were encountered and solved:

- **Transition from Python to JavaScript:**  
  Initially, much of the calculation logic was written in Python. However, developing the UI with Python libraries proved challenging compared to JavaScript. The decision was then made to translate the code in `calculation_functions.js` from Python to JavaScript, allowing seamless integration with the Quasar app and easier UI development.

- **GPS Data Transmission from iPhone:**  
  As computers tend to not have a gps inside, I had to discover a way to send GPS data from my iPhone. In an early trial, I attempted to use the iPhone Shortcuts app to send GPS data directly from the phone. However, this approach faced significant challenges due to issues with reliability and the limited coding capabilities within the Shortcuts environment. The data often arrived inconsistently, which could lead to gaps in navigation monitoring. Ultimately, these issues led me to adopt the GPS2IP app on the iPhone, which provided a much more stable and reliable connection for streaming GPS data. This change ensured that the system receives GPS data consistently regardless of network connectivity.

- **State Management on Page Change:**  
  A major challenge was that when switching pages, the IndexPage reset its logic, causing a loss of state. This was mitigated by using consistent localStorage memory, ensuring that the program remembers its state (such as current waypoint and navigation status) even when pages change.

## Future Improvements

- **Responsive Design for Tablet and Phone Screens:**  
  Though current layouts work well on a pc, further refinements in the user interface could enhance usability on various screen sizes, such as tablets and phones, including more dynamic layouts for complex data visualization.

- **Alternative Data Transmission Methods:**  
  In addition to WiFi and the current GPS2IP approach, exploring other transmission methods (such as cellular networks or satellite communication) could further improve the reliability of GPS data uptake in areas with limited WiFi connectivity.

- **Offline Capabilities:**  
  Future iterations could integrate offline storage and caching mechanisms to ensure uninterrupted navigation data, even in poor connectivity environments.

- **Advanced Navigation Features:**  
  Integration of weather data, real-time traffic information for shipping lanes, and predictive modeling for speed and fuel consumption might further enhance the navigation experience.

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.