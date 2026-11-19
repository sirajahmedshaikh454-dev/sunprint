// A short list of places: name, latitude, longitude (east positive), standard UTC offset in hours.
// Standard time only: tick "daylight saving" on the page if your clocks are an hour ahead.
(function (root) {
  const CITIES = [
    ['Karachi', 24.86, 67.01, 5], ['Lahore', 31.55, 74.34, 5], ['Islamabad', 33.68, 73.05, 5], ['Peshawar', 34.01, 71.58, 5],
    ['Quetta', 30.18, 66.99, 5], ['Multan', 30.16, 71.52, 5], ['Faisalabad', 31.42, 73.08, 5], ['Hyderabad (Pakistan)', 25.39, 68.37, 5],
    ['Delhi', 28.61, 77.21, 5.5], ['Mumbai', 19.08, 72.88, 5.5], ['Dhaka', 23.81, 90.41, 6], ['Kathmandu', 27.72, 85.32, 5.75],
    ['Dubai', 25.20, 55.27, 4], ['Riyadh', 24.71, 46.68, 3], ['Tehran', 35.69, 51.39, 3.5], ['Istanbul', 41.01, 28.98, 3],
    ['Cairo', 30.04, 31.24, 2], ['Nairobi', -1.29, 36.82, 3], ['Lagos', 6.52, 3.38, 1], ['Cape Town', -33.92, 18.42, 2],
    ['London', 51.51, -0.13, 0], ['Berlin', 52.52, 13.40, 1], ['Reykjavik', 64.15, -21.94, 0], ['Moscow', 55.76, 37.62, 3],
    ['New York', 40.71, -74.01, -5], ['Toronto', 43.65, -79.38, -5], ['Los Angeles', 34.05, -118.24, -8], ['Mexico City', 19.43, -99.13, -6],
    ['Sao Paulo', -23.55, -46.63, -3], ['Buenos Aires', -34.60, -58.38, -3], ['Singapore', 1.35, 103.82, 8], ['Tokyo', 35.68, 139.69, 9],
    ['Sydney', -33.87, 151.21, 10],
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = { CITIES }; else root.CITIES = CITIES;
})(typeof window !== 'undefined' ? window : globalThis);
