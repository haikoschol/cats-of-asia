// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

let map = null;

// TODO use srcset for images everywhere
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
// https://developers.cloudflare.com/images/image-resizing/responsive-images/
function makePopupContent(photo, map, favorites) {
    const {id, sha256, timestamp, urls} = photo;
    const date = new Date(timestamp).toDateString();
    const location = formatLocation(photo);
    const outer = document.createElement('div');
    const catImage = makeImageLink(urls.desktop, urls.smol, `a photo of one or more cats`);
    outer.appendChild(catImage);

    const footer = document.createElement('div');
    footer.className = 'popup-footer';

    const description = document.createElement('div');
    description.innerText = `Taken on ${date} in ${location}`;
    footer.appendChild(description);

    const favButton = makeFavoriteButton(sha256, favorites);
    favButton.mount(footer);

    if (navigator.share) {
        const shareButton = new IconButton(
            shareIcon,
            'share',
            () => shareCatto(id, map.getZoom())
        );

        shareButton.mount(footer);
    }

    outer.appendChild(footer);
    return outer;
}

function makeImageLink(href, src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;

    const a = document.createElement('a');
    a.href = href;
    a.appendChild(img);
    return a;
}

function makeFavoriteButton(photoHash, favorites) {
    const icon = favorites.iconForStatus(photoHash);
    const favButton = new IconButton(icon, 'add/remove this cat to/from your favorites');

    favButton.onclick = () => {
        favorites.toggle(photoHash);
        favButton.src = favorites.iconForStatus(photoHash);
        favorites.write();
    }
    return favButton;
}

class IconButton {
    img;
    button;

    constructor(icon, alt, onClick) {
        this.img = document.createElement('img');
        this.img.className = 'icon';
        this.img.src = icon;
        this.img.alt = alt;

        this.button = document.createElement('button');

        if (onClick) {
            this.button.onclick = onClick;
        }

        this.button.appendChild(this.img);
    }

    set src(src) {
        this.img.src = src;
    }

    set onclick(oc) {
        this.button.onclick = oc;
    }

    mount(container) {
        container.appendChild(this.button);
    }
}

function shareCatto(photoId, zoomLevel) {
    const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
    const maybePort = window.location.hostname === 'localhost' ? ':8000' : '';
    const url = `${protocol}://${window.location.hostname}${maybePort}${window.location.pathname}?id=${photoId}&zoomLevel=${zoomLevel}`;

    navigator.share({
        title: `${document.title} #${photoId}`,
        text: 'Check out this cat!',
        url: url,
    })
        .then(() => console.log('catto sharing is catto caring'))
        .catch(error => console.log('error sharing:', error));
}

function formatLocation(photo) {
    const {city, country} = photo;
    return city ? `${city}, ${country}` : country
}

function addCircle(photo, map, radius, favorites) {
    const color = photo.randomized ? 'blue' : 'red';
    const circle = L.circle([photo.latitude, photo.longitude], {color: color, radius: radius});

    // Passing a function that returns dom elements in order to lazy load the popup images.
    const popup = circle.bindPopup(() => makePopupContent(photo, map, favorites));

    circle.addTo(map);
    return circle;
}

function calculateRadius(zoomLevel) {
    let radius = defaultRadius;
    if (zoomLevel >= 17) {
        radius -= (zoomLevel % 16) * 2;
    }
    return Math.max(radius, 1);
}

function updateCircleRadii(photos, zoomLevel) {
    const radius = calculateRadius(zoomLevel);
    photos.forEach(img => img.circle.setRadius(radius));
}

// When multiple photos have the same coordinates, spread them out so the markers won't overlap completely.
function adjustCoordinates(photos) {
    const imgsByCoords = {};

    photos.forEach(img => {
        img['randomized'] = false;
        const coords = `${img.latitude},${img.longitude}`;
        const imgsAt = imgsByCoords[coords] || [];
        imgsAt.push(img);
        imgsByCoords[coords] = imgsAt;
    });

    for (let c in imgsByCoords) {
        const imgsAt = imgsByCoords[c];
        const count = imgsAt.length;
        if (count < 2) {
            continue;
        }

        imgsAt.forEach(img => {
            img.latitude = randomizeCoordinate(img.latitude);
            img.longitude = randomizeCoordinate(img.longitude);
            img.randomized = true;
        });
    }
}

function randomizeCoordinate(coord) {
    const delta = Math.random() / 2000;
    return Math.random() > 0.5 ? coord + delta : coord - delta;
}

async function init(divId, accessToken) {
    const favorites = new FavoriteStore();

    map = L.map(divId);
    L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${accessToken}`, {
        maxZoom: maxZoomLevel,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1
    }).addTo(map);

    adjustCoordinates(photos);

    const radius = calculateRadius(map.getZoom());
    photos.forEach(p => p['circle'] = addCircle(p, map, radius, favorites));
    setMapView(map, photos);

    map.on('zoomend', () => {
        updateCircleRadii(photos, map.getZoom());
        updateCurrentPosition(map);
    });

    map.on('moveend', () => updateCurrentPosition(map));
    initPlaces(photos, map);
}

// If url params with image id and optional zoom level are present, center map on that, otherwise try
// navigator.geolocation, then last location from local storage and fall back to default values (coords of first image).
function setMapView(map, photos) {
    let {latitude, longitude, zoomLevel} = getCurrentPosition(photos);
    const urlParams = new URLSearchParams(window.location.search);
    const zoomParam = Number(urlParams.get('zoomLevel'));
    const photosFromUrlParam = photos.filter(p => p.id === urlParams.get('id'));

    if (photosFromUrlParam.length === 1) {
        if (zoomParam <= maxZoomLevel && zoomParam >= 1) {
            zoomLevel = zoomParam;
        }
        const photo = photosFromUrlParam[0];

        // bit of a hack to remove the url params. probably would be better to update them if present
        history.pushState(null, '', window.location.pathname);

        map.setView([photo.latitude, photo.longitude], zoomLevel);
        photo.circle.openPopup();
        updateCircleRadii(photos, zoomLevel);
        updateCurrentPosition(map);
        return;
    }

    const gl = navigator.geolocation;
    gl.getCurrentPosition(({coords}) => {
        map.setView([coords.latitude, coords.longitude], zoomLevel);
        updateCurrentPosition(map);
        updateCircleRadii(photos, zoomLevel);
    }, () => {
        map.setView([latitude, longitude], zoomLevel);
        updateCircleRadii(photos, zoomLevel);
    });
}

function initPlaces(photos, map) {
    const places = photosByPlace(photos);
    const sorted = Object.keys(places).sort();
    const placesUl = document.getElementById('placesUl');

    for (const label of sorted) {
        const li = document.createElement('li');
        const a = document.createElement('a');

        a.innerText = label;
        a.onclick = () => {
            const items = places[label];
            const img = items[Math.floor(Math.random() * items.length)];
            document.getElementById('placesDropdown').removeAttribute('open');
            map.setView([img.latitude, img.longitude], defaultZoomLevel);
            updateCurrentPosition(map);
        }

        li.appendChild(a);
        placesUl.appendChild(li);
    }
}

function photosByPlace(photos) {
    const places = {};

    photos.forEach(p => {
        const loc = formatLocation(p);
        const entry = places[loc];

        if(Array.isArray(entry)) {
            entry.push(p)
        } else {
            places[loc] = [p];
        }
    });
    return places;
}

function getCurrentPosition(photos) {
    const [startLatitude, startLongitude] = photos.length ? [photos[0].latitude, photos[0].longitude] : [18.7933987, 98.9841731];
    const lsLat = Number(localStorage.getItem('latitude'));
    const lsLng = Number(localStorage.getItem('longitude'));
    const lsZoom = localStorage.getItem('zoomLevel');

    return {
        latitude: isNaN(lsLat) || lsLat === 0 ? startLatitude : lsLat,
        longitude: isNaN(lsLng) || lsLng === 0 ? startLongitude : lsLng,
        zoomLevel: lsZoom ? Number(lsZoom) : defaultZoomLevel,
    };
}

function updateCurrentPosition(map) {
    const {lat, lng} = map.getCenter();

    localStorage.setItem('latitude', lat);
    localStorage.setItem('longitude', lng);
    localStorage.setItem('zoomLevel', map.getZoom());
}
