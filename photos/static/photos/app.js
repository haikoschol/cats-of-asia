// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

let map = null;

// TODO use srcset for images everywhere
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
// https://developers.cloudflare.com/images/image-resizing/responsive-images/
function makePopupContent(image, map, favorites) {
    const {sha256, timestamp, urls} = image;
    const date = new Date(timestamp).toDateString();
    const location = formatLocation(image);
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

function makeFavoriteButton(imageHash, favorites) {
    const icon = favorites.iconForStatus(imageHash);
    const favButton = new IconButton(icon, 'add/remove this cat to/from your favorites');

    favButton.onclick = () => {
        favorites.toggle(imageHash);
        favButton.src = favorites.iconForStatus(imageHash);
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

function shareCatto(imageId, zoomLevel) {
    const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
    const url = `${protocol}://${window.location.hostname}${window.location.pathname}?imageId=${imageId}&zoomLevel=${zoomLevel}`;

    navigator.share({
        title: `${document.title} #${imageId}`,
        text: 'Check out this cat!',
        url: url,
    })
        .then(() => console.log('catto sharing is catto caring'))
        .catch(error => console.log('error sharing:', error));
}

function formatLocation(image) {
    const {city, country} = image;
    return city ? `${city}, ${country}` : country
}

function addCircle(image, map, radius, favorites) {
    const color = image.randomized ? 'blue' : 'red';
    const circle = L.circle([image.latitude, image.longitude], {color: color, radius: radius});

    // Passing a function that returns dom elements in order to lazy load the popup images.
    const popup = circle.bindPopup(() => makePopupContent(image, map, favorites));

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

function updateCircleRadii(images, zoomLevel) {
    const radius = calculateRadius(zoomLevel);
    images.forEach(img => img.circle.setRadius(radius));
}

// When multiple images have the same coordinates, spread them out so the markers won't overlap completely.
function adjustCoordinates(images) {
    const imgsByCoords = {};

    images.forEach(img => {
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

    adjustCoordinates(images);

    const radius = calculateRadius(map.getZoom());
    images.forEach(img => img['circle'] = addCircle(img, map, radius, favorites));
    setMapView(map, images);

    map.on('zoomend', () => {
        updateCircleRadii(images, map.getZoom());
        updateCurrentPosition(map);
    });

    map.on('moveend', () => updateCurrentPosition(map));
    initPlaces(images, map);
}

// If url params with image id and optional zoom level are present, center map on that, otherwise try last location
// from local storage and fall back to default values (coords of first image).
function setMapView(map, images) {
    let {latitude, longitude, zoomLevel} = getCurrentPosition(images)

    const urlParams = new URLSearchParams(window.location.search);
    const imageId = Number(urlParams.get('imageId'));
    const zoomParam = Number(urlParams.get('zoomLevel'));
    const imgsFromUrlParam = images.filter(img => img.id === imageId);

    if (imgsFromUrlParam.length === 1) {
        if (zoomParam <= maxZoomLevel && zoomParam >= 1) {
            zoomLevel = zoomParam;
        }
        const img = imgsFromUrlParam[0];

        // bit of a hack to remove the url params. probably would be better to update them if present
        history.pushState(null, '', window.location.pathname);

        map.setView([img.latitude, img.longitude], zoomLevel);
        img.circle.openPopup();
        updateCurrentPosition(map);
    } else {
        map.setView([latitude, longitude], zoomLevel);
    }

    updateCircleRadii(images, zoomLevel);
}

function initPlaces(images, map) {
    const placesUl = document.getElementById('placesUl');
    const places = {};

    images.forEach(img => places[formatLocation(img)] = img);
    const sorted = Object.keys(places).sort();

    for (const label of sorted) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        const {latitude, longitude} = places[label];

        a.innerText = label;
        a.onclick = () => {
            document.getElementById('placesDropdown').removeAttribute('open');
            map.setView([latitude, longitude], defaultZoomLevel);
            updateCurrentPosition(map);
        }

        li.appendChild(a);
        placesUl.appendChild(li);
    }
}

function getCurrentPosition(images) {
    const [startLatitude, startLongitude] = images.length ? [images[0].latitude, images[0].longitude] : [18.7933987, 98.9841731];
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
