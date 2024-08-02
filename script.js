document.addEventListener("DOMContentLoaded", function() {
    var map;
    var markers = [];
    var addresses = [];
    var maxMarkers = 10;
    var key = '71af4547-aa05-429b-a7ea-c162dcca9e82';
    var matrix = [];
    var normalIcon = DG.icon({
        iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
        iconSize: [32, 32]
    });
    var highlightIcon = DG.icon({
        iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png',
        iconSize: [32, 32]
    });

    DG.then(function() {
        map = DG.map('map', {
            center: [55.7306, 37.4673], // Центр на Кунцево
            zoom: 14,
            geoclicker: true
        });

        map.on('click', function(e) {
            if (markers.length < maxMarkers) {
                var marker = DG.marker([e.latlng.lat, e.latlng.lng], {icon: normalIcon}).addTo(map);
                markers.push(marker);

                // Получаем адрес по координатам
                getAddress(e.latlng.lat, e.latlng.lng).then(address => {
                    addresses.push(address);
                    updateMarkersLegend();
                });
            }
        });

        document.getElementById('calculateRoutes').addEventListener('click', updateDistanceMatrix);
        document.getElementById('findMinimaxPoint').addEventListener('click', highlightMinimaxPoint);
    });

    function getAddress(lat, lng) {
        return fetch(`https://catalog.api.2gis.com/3.0/items/geocode?lat=${lat}&lon=${lng}&key=${key}`)
            .then(response => response.json())
            .then(data => {
                if (data.result && data.result.items.length > 0) {
                    return data.result.items[0].full_name;
                } else {
                    return "Неизвестный адрес";
                }
            })
            .catch(() => "Неизвестный адрес");
    }

    function updateMarkersLegend() {
        var legend = document.getElementById('markersLegend');
        legend.innerHTML = '';
        markers.forEach((marker, index) => {
            var address = addresses[index] || 'Неизвестный адрес';
            legend.innerHTML += `
                <div>
                    M${index + 1}: ${address} <span class="remove-marker" data-index="${index}">[x]</span>
                </div>
            `;
        });

        document.querySelectorAll('.remove-marker').forEach(element => {
            element.addEventListener('click', function() {
                var index = parseInt(this.getAttribute('data-index'));
                removeMarker(index);
            });
        });
    }

    function removeMarker(index) {
        map.removeLayer(markers[index]);
        markers.splice(index, 1);
        addresses.splice(index, 1);
        updateMarkersLegend();
        updateDistanceMatrix();
    }

    function updateDistanceMatrix() {
        if (markers.length < 2) return;

        var promises = [];
        for (var i = 0; i < markers.length; i++) {
            matrix[i] = [];
            for (var j = 0; j < markers.length; j++) {
                if (i === j) {
                    matrix[i][j] = 0;
                } else {
                    promises.push((function(i, j) {
                        return calculateDistance(markers[i], markers[j], i, j);
                    })(i, j));
                }
            }
        }

        Promise.all(promises).then(function() {
            renderMatrix();
        });
    }

    function calculateDistance(marker1, marker2, i, j) {
        var point1 = marker1.getLatLng();
        var point2 = marker2.getLatLng();

        return fetch(`https://routing.api.2gis.com/routing/7.0.0/global?key=${key}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                points: [
                    {type: "stop", lon: point1.lng, lat: point1.lat},
                    {type: "stop", lon: point2.lng, lat: point2.lat}
                ],
                locale: "ru",
                transport: "car",
                route_mode: "fastest",
                traffic_mode: "jam"
            })
        }).then(function(response) {
            return response.json();
        }).then(function(data) {
            if (data.result && data.result[0]) {
                matrix[i][j] = Math.round(data.result[0].total_duration / 60); // Время в минутах, округленное до целого
            } else {
                matrix[i][j] = Infinity;
            }
        }).catch(function() {
            matrix[i][j] = Infinity;
        });
    }

    function renderMatrix() {
        var table = document.getElementById('distanceMatrix');
        table.innerHTML = '';

        var headerRow = document.createElement('tr');
        var emptyHeader = document.createElement('th');
        headerRow.appendChild(emptyHeader);

        for (var i = 0; i < matrix.length; i++) {
            var th = document.createElement('th');
            th.textContent = 'M' + (i + 1);
            headerRow.appendChild(th);
        }
        table.appendChild(headerRow);

        for (var i = 0; i < matrix.length; i++) {
            var row = document.createElement('tr');
            var rowHeader = document.createElement('th');
            rowHeader.textContent = 'M' + (i + 1);
            row.appendChild(rowHeader);

            for (var j = 0; j < matrix[i].length; j++) {
                var cell = document.createElement('td');
                cell.textContent = matrix[i][j] + ' мин';
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
    }

    function findMinimaxPoint(matrix) {
        var maxDistances = matrix.map(row => Math.max(...row));
        var minIndex = maxDistances.indexOf(Math.min(...maxDistances));
        return minIndex;
    }

    function highlightMinimaxPoint() {
        if (markers.length < 2) return;

        var minimaxIndex = findMinimaxPoint(matrix);

        // Установим нормальную иконку для всех маркеров
        markers.forEach(function(marker, index) {
            marker.setIcon(normalIcon);
        });

        // Подсветим минимаксный маркер
        markers[minimaxIndex].setIcon(highlightIcon);

        alert('Минимаксная метка: M' + (minimaxIndex + 1));
    }
});
