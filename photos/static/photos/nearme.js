// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict'

import {JsonRpcClient} from './rpc.js'

function init() {
    const gl = navigator.geolocation
    const container = document.querySelector('#nearmeContainer')
    const noNearme = document.querySelector('#noNearme')
    const errorElem = document.querySelector('#noLoc')

    gl.getCurrentPosition(
        ({coords}) => {
            // TODO error handling
            fetchClosestPhotos(coords.latitude, coords.longitude, container, noNearme).catch(console.error)
        },
        () => handleLocationBlocked(container, errorElem)
    )
}

function handleLocationBlocked(container, errorElem) {
    container.setAttribute('hidden', '')
    errorElem.removeAttribute('hidden')
}

async function fetchClosestPhotos(latitude, longitude, container, noNearme) {
    const client = new JsonRpcClient()
    const photos = await client.call('get_closest_photos', [latitude, longitude])
    container.setAttribute('aria-busy', 'false')

    if (photos.length === 0) {
        noNearme.removeAttribute('hidden')
        return
    }

    renderPhotosNearMe(photos, container)
}

function renderPhotosNearMe(photos, container) {
    photos.forEach(photo => {
        const img = document.createElement('img')
        img.src = photo.urls.smol
        img.alt = `cat photo #${photo.hash}`
        img.className = 'fav-img'

        // DRY
        const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
        const maybePort = window.location.hostname === 'localhost' ? ':8000' : '';
        const url = `${protocol}://${window.location.hostname}${maybePort}/?id=${photo.id}`;

        const a = document.createElement('a')
        a.href = url
        a.appendChild(img)

        const card = document.createElement('article')
        card.className = 'fav-card'
        const footer = document.createElement('footer')

        // DRY
        const date = new Date(photo.timestamp).toDateString();
        const location = photo.city ? `${photo.city}, ${photo.country}` : photo.country
        footer.innerText = `Taken on ${date} in ${location}`

        // TODO add "show on map" link

        card.appendChild(a)
        card.appendChild(footer)
        container.appendChild(card)
    })
}

document.addEventListener('DOMContentLoaded', init)
