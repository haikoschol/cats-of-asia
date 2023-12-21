// Copyright (C) 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

let metadata = {};

async function processPhoto(evt) {
    document.getElementById('preview').setAttribute('hidden', 'hidden');
    document.getElementById('photo').setAttribute('disabled', 'disabled');
    document.getElementById('submit').setAttribute('disabled', 'disabled');

    const file = evt.target.files[0];
    console.log(file.name);

    metadata = await parse(file);
    await loadImage(file, document.getElementById('preview'));
    populateForm(metadata);

    document.getElementById('submit').removeAttribute('disabled');
    document.getElementById('photo').removeAttribute('disabled');
}

function populateForm(metadata) {
    document.getElementById('filename').value = metadata.filename;
    document.getElementById('city').value = metadata.latitude;
    document.getElementById('timestamp').value = metadata.timestamp.toISOString();
    document.getElementById('tzoffset').value = metadata.timestamp.getTimezoneOffset();
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

document.getElementById('photo').addEventListener('change', processPhoto);
