// Copyright (C) 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

let metadata = {};

async function processPhoto(evt) {
    document.getElementById('photo').setAttribute('disabled', 'disabled');
    document.getElementById('submit').setAttribute('disabled', 'disabled');

    const file = evt.target.files[0];
    metadata = await parse(file);
    const location = await reverseGeocode(metadata.latitude, metadata.longitude);
    Object.assign(metadata, location);
    populateForm(metadata);

    await loadImage(file, document.getElementById('preview'));
    metadata.sha256 = await sha256(file);
    document.getElementById('submit').removeAttribute('disabled');
}

async function uploadPhoto(evt) {
    evt.preventDefault();

    // TODO check if photo already exists
    // TODO show spinner/progress bar

    document.getElementById('photo').setAttribute('disabled', 'disabled');
    evt.target.setAttribute('disabled', 'disabled');

    const uploadInfo = await getUploadInfo();
    if (uploadInfo === null) {
        resetForm();
        return;
    }

    const file = document.getElementById('photo').files[0];
    const formData = new FormData();
    formData.append('file', file);

    let response = await fetch(uploadInfo.uploadURL, {method: 'POST', body: formData});
    if (response.status > 299) {
        console.error(response);
        resetForm();
        return;
    }

    metadata.id = uploadInfo.id;
    metadata.city = document.getElementById('city').value;
    metadata.country = document.getElementById('country').value;
    metadata.timestamp = document.getElementById('timestamp').value;
    metadata.tzoffset = document.getElementById('tzoffset').value;

    await addPhoto(metadata);
    resetForm();
}

function resetForm() {
    metadata = {};

    const select = document.getElementById('cityCandidates');
    const len = select.options.length;
    for (let i = len; i >= 0; i--) {
        select.remove(i);
    }

    document.getElementById('form').reset();
    document.getElementById('photo').removeAttribute('disabled');
    document.getElementById('submit').removeAttribute('disabled');
    document.getElementById('preview').setAttribute('hidden', 'hidden');
    document.getElementById('candidates').setAttribute('hidden', 'hidden');
}

async function addPhoto(metadata) {
    // FIXME get URL from backend
    const response = await fetch('/add_photo', {
        'method': 'POST',
        'headers': {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        'body': JSON.stringify(metadata)}
    );
    if (response.status > 299) {
        console.error(response);
    }
}

async function getUploadInfo() {
    // FIXME get URL from backend
    const response = await fetch('/create_upload_url', {
        'method': 'POST',
        'headers': {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        }
    });

    if (response.status > 299) {
        console.error(await response.json());
        return null;
    }

    const payload = await response.json();
    return payload.result;
}

async function reverseGeocode(latitude, longitude) {
    // FIXME get URL from backend
    const response = await fetch(`/location/${latitude}/${longitude}`);
    return await response.json();
}

function populateForm(metadata) {
    document.getElementById('filename').value = metadata.filename;
    document.getElementById('country').value = metadata.country;
    document.getElementById('timestamp').value = metadata.timestamp.toISOString();
    document.getElementById('tzoffset').value = metadata.timestamp.getTimezoneOffset();

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

function selectCity(sel) {
    document.getElementById('city').value = sel.selectedOptions[0].value;
}

async function parse(file) {
    const exif = await exifr.parse(file);

    if (exif['ComponentsConfiguration']) {
        delete exif['ComponentsConfiguration'];
    }

    return {
        'filename': extractFilename(file.name),
        'latitude': exif.latitude,
        'longitude': exif.longitude,
        'altitude': attrOr(exif, 'GPSAltitude', 0),
        'timestamp': getTimestamp(exif),
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

document.getElementById('photo').addEventListener('change', processPhoto);
document.getElementById('submit').addEventListener('click', uploadPhoto);
