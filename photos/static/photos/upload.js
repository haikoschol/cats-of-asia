// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// FIXME switch to prod url once this service is out of beta https://www.jsdelivr.com/esm
import {HTTPTransport, RequestManager, Client} from 'https://esm.run/@open-rpc/client-js';

export default () => {};

const transport = new HTTPTransport(jsonRpcUrl, {
    headers: {
        'X-CSRFToken': document.querySelector('input[name="csrfmiddlewaretoken"]').value,
    },
});

const client = new Client(new RequestManager([transport]));
let metadata = {};

async function processPhoto(evt) {
    toggleLoadingState(true);

    const file = evt.target.files[0];
    const img = loadImage(file, document.getElementById('preview'));
    metadata.sha256 = await sha256(file);

    if (await photoExists(metadata.sha256)) {
        // TODO throw up toast message
        resetForm();
        return;
    }

    Object.assign(metadata, await parse(file));
    const location = await getLocation(metadata.latitude, metadata.longitude);
    Object.assign(metadata, location);
    populateForm(metadata);

    await img;
    toggleLoadingState(false);
    document.getElementById('submit').removeAttribute('disabled');
}

async function uploadPhoto(evt) {
    evt.preventDefault();
    toggleLoadingState(true);

    const uploadInfo = await createUploadURL();
    if (uploadInfo === null) {
        resetForm();
        return;
    }

    const file = document.getElementById('photo').files[0];
    const formData = new FormData();
    formData.append('file', file);

    let response = await fetch(uploadInfo.uploadURL, {method: 'POST', body: formData});
    if (response.status > 299) {
        // TODO throw up toast error
        console.error(response);
        resetForm();
        return;
    }

    metadata.id = uploadInfo.id;
    // updated editable fields
    metadata.city = document.getElementById('city').value;
    metadata.country = document.getElementById('country').value;

    await addPhoto(metadata);
    resetForm();
}

function toggleLoadingState(loading) {
    const photo = document.getElementById('photo');
    const submit = document.getElementById('submit');

    if (loading) {
        photo.setAttribute('disabled', 'disabled');
        submit.setAttribute('aria-busy', 'true'); // FIXME has no effect
    } else {
        photo.removeAttribute('disabled');
        submit.removeAttribute('aria-busy');
    }
}

function resetForm() {
    metadata = {};
    const select = document.getElementById('cityCandidates');
    const len = select.options.length;
    for (let i = len; i >= 0; i--) {
        select.remove(i);
    }

    const submit = document.getElementById('submit');
    submit.setAttribute('disabled', 'disabled');
    submit.removeAttribute('aria-busy');

    document.getElementById('form').reset();
    document.getElementById('photo').removeAttribute('disabled');
    document.getElementById('preview').setAttribute('hidden', 'hidden');
    document.getElementById('candidates').setAttribute('hidden', 'hidden');
}

async function photoExists(sha256) {
    try {
        return await client.request({method: "photo_exists", params: [sha256]});
    } catch (e) {
        // TODO throw up toast error
        console.error(e);
    }
    return true;
}

async function getLocation(latitude, longitude) {
    try {
        return await client.request({method: "get_location", params: [latitude, longitude]});
    } catch (e) {
        // TODO throw up toast error
        console.error(e);
    }
    return null;
}

async function createUploadURL() {
    try {
        return await client.request({method: "create_upload_url"});
    } catch (e) {
        // TODO throw up toast error
        console.error(e);
    }
    return null;
}

async function addPhoto(metadata) {
    try {
        return await client.request({method: "add_photo", params: [metadata]});
    } catch (e) {
        // TODO throw up toast error
        console.error(e);
    }
    return null;
}

function populateForm(metadata) {
    document.getElementById('country').value = metadata.country;

    if (metadata.cityCandidates) {
        document.getElementById('candidates').removeAttribute('hidden');
        const select = document.getElementById('cityCandidates');

        for (let candidate of metadata.cityCandidates) {
           const option = document.createElement('option');
           option.value = candidate;
           option.text = candidate;
           select.add(option);
        }
        document.getElementById('city').value = select.selectedOptions[0].value;
    } else {
        document.getElementById('city').value = metadata.city;
        document.getElementById('candidates').setAttribute('hidden', 'hidden');
    }
}

async function parse(file) {
    const exif = await exifr.parse(file);

    if (exif['ComponentsConfiguration']) {
        delete exif['ComponentsConfiguration'];
    }

    const ts = getTimestamp(exif);

    return {
        'filename': extractFilename(file.name),
        'latitude': exif.latitude,
        'longitude': exif.longitude,
        'altitude': attrOr(exif, 'GPSAltitude', 0),
        'timestamp': ts.toISOString(),
        'tzoffset': ts.getTimezoneOffset(),
        'raw': exif,
    }
}

function getTimestamp(exif) {
    for (let attr of ['CreateDate', 'ModifyDate', 'DateTimeOriginal']) {
        if (exif[attr]) {
            return exif[attr];
        }
    }
    return Date.now();
}

function attrOr(obj, attr, def) {
    return obj[attr] ? obj[attr] : def;
}

// https://html.spec.whatwg.org/multipage/input.html#fakepath-srsly
function extractFilename(path) {
    // modern browser
    if (path.substring(0, 12) === "C:\\fakepath\\")
        return path.substring(12);

    // Unix-based path
    let x = path.lastIndexOf('/');
    if (x >= 0)
        return path.substring(x+1);

    // Windows-based path
    x = path.lastIndexOf('\\');
    if (x >= 0)
        return path.substring(x+1);

    return path;
}

function loadImage(file, img) {
    img.src = URL.createObjectURL(file);

    if (img.naturalWidth !== 0) {
        img.removeAttribute('hidden');
        return Promise.resolve();
    } else {
        return new Promise((resolve, reject) => {
            img.onload = () => {
                img.removeAttribute('hidden');
                resolve();
            }
            img.onerror = reject;
        })
    }
}

async function sha256(file) {
    const content = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(digest));

    return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('photo').addEventListener('change', processPhoto);
    document.getElementById('submit').addEventListener('click', uploadPhoto);

    document.getElementById('cityCandidates').addEventListener('change', evt => {
        document.getElementById('city').value = evt.target.selectedOptions[0].value;
    })
});
