import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet tidak dapat mendeteksi path ikon bawaan ketika di-bundle webpack.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export function createMap(element, { center = [-2.5, 118], zoom = 5 } = {}) {
  const openStreetMap = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution:
      'Data: &copy; OpenStreetMap contributors, SRTM | Tampilan: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  });

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    },
  );

  const map = L.map(element, { center, zoom, layers: [openStreetMap] });

  L.control
    .layers({
      OpenStreetMap: openStreetMap,
      OpenTopoMap: openTopoMap,
      'Citra Satelit': satellite,
    })
    .addTo(map);

  return map;
}

export { L };
