// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/lite.esm.js';

// FIXME stop using esm.run, it's beta and flaky
import {HTTPTransport, RequestManager, Client} from 'https://esm.run/@open-rpc/client-js';

import {Toast, ErrorToast} from './toast.js';

const jsonRpcUrl = document.getElementById('jsonRpcUrl').value;

const transport = new HTTPTransport(jsonRpcUrl, {
    headers: {
        'X-CSRFToken': document.querySelector('input[name="csrfmiddlewaretoken"]').value,
    },
});

const client = new Client(new RequestManager([transport]));

const picker = document.getElementById('picker');
const preview = document.getElementById('preview');
const form = document.getElementById('form');
const submit = document.getElementById('submit');
const city = document.getElementById('city');
const cityCandidates = document.getElementById('cityCandidates');
const candidatesDiv = document.getElementById('candidates');
const country = document.getElementById('country');

let metadata = {};

async function processPhoto(evt) {
    const file = evt.target.files[0];
    const img = loadImage(file, preview);

    metadata.filename = extractFilename(file.name);
    metadata.sha256 = await sha256(file);

    const exists = await photoExists(metadata.sha256);
    if (exists || exists === null) {
        if (exists) {
            Toast(`File ${metadata.filename} already exists`);
        } else {
            ErrorToast(`Unable to check whether file ${metadata.filename} already exists`);
        }
        resetForm();
        return;
    }

    Object.assign(metadata, await parse(file));
    const location = await getLocation(metadata.latitude, metadata.longitude);
    if (location === null) {
        ErrorToast(`Unable to get location for file ${metadata.filename}`);
        resetForm();
        return;
    }

    Object.assign(metadata, location);
    populateForm(metadata);

    await img;
    form.removeAttribute('hidden');
    preview.removeAttribute('hidden');
    submit.removeAttribute('disabled');
}

async function uploadPhoto(evt) {
    evt.preventDefault();
    toggleLoadingState(true);

    const uploadInfo = await createUploadURL(metadata.filename);
    if (uploadInfo === null) {
        ErrorToast(`Unable to create upload URL for file ${metadata.filename}`);
        resetForm();
        return;
    }

    const file = picker.files[0];
    const formData = new FormData();
    formData.append('file', file);

    let response = await fetch(uploadInfo.uploadURL, {method: 'POST', body: formData});
    if (response.status > 299) {
        ErrorToast(`Uploading file ${metadata.filename} to Cloudflare Images failed`);
        console.error(response);
        resetForm();
        return;
    }

    metadata.id = uploadInfo.id;
    // update editable fields
    metadata.city = city.value;
    metadata.country = country.value;

    await addPhoto(metadata);
    Toast(`Uploaded file ${metadata.filename} successfully`);
    resetForm();
}

function toggleLoadingState(loading) {
    const picker = document.getElementById('picker');
    const submit = document.getElementById('submit');

    if (loading) {
        picker.setAttribute('disabled', 'disabled');
        submit.setAttribute('aria-busy', 'true');
    } else {
        picker.removeAttribute('disabled');
        submit.removeAttribute('aria-busy');
    }
}

function resetForm() {
    metadata = {};
    const len = cityCandidates.options.length;
    for (let i = len; i >= 0; i--) {
        cityCandidates.remove(i);
    }

    submit.setAttribute('disabled', 'disabled');
    submit.removeAttribute('aria-busy');

    form.reset();
    form.setAttribute('hidden', 'hidden');

    picker.removeAttribute('disabled');
    picker.value = null;

    preview.setAttribute('hidden', 'hidden');
    candidatesDiv.setAttribute('hidden', 'hidden');
}

async function photoExists(sha256) {
    return await callRpc("photo_exists", sha256);
}

async function getLocation(latitude, longitude) {
    return await callRpc("get_location", [latitude, longitude]);
}

async function createUploadURL() {
    return await callRpc("create_upload_url");
}

async function addPhoto(metadata) {
    return await callRpc("add_photo", metadata);
}

async function callRpc(method, params) {
    const data = {method: method};
    if (params) {
        data.params = Array.isArray(params) ? params : [params];
    }

    try {
        return await client.request(data);
    } catch (e) {
        console.error(e);
    }
    return null;
}

function populateForm(metadata) {
    country.value = metadata.country;

    if (metadata.cityCandidates) {
        candidatesDiv.removeAttribute('hidden');

        for (let candidate of metadata.cityCandidates) {
           const option = document.createElement('option');
           option.value = candidate;
           option.text = candidate;
           cityCandidates.add(option);
        }
        city.value = cityCandidates.selectedOptions[0].value;
    } else {
        city.value = metadata.city;
        candidatesDiv.setAttribute('hidden', 'hidden');
    }
}

async function parse(file) {
    const exif = await exifr.parse(file);

    if (exif['ComponentsConfiguration']) {
        delete exif['ComponentsConfiguration'];
    }

    const ts = getTimestamp(exif);

    return {
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
    picker.addEventListener('change', processPhoto);
    submit.addEventListener('click', uploadPhoto);

    cityCandidates.addEventListener('change', evt => {
        city.value = evt.target.selectedOptions[0].value;
    });
});
