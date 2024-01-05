// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict'

import exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/lite.esm.js'

// FIXME stop using esm.run, it's beta and flaky
import {HTTPTransport, RequestManager, Client} from 'https://esm.run/@open-rpc/client-js'

import {Toast, ErrorToast} from '../toast.js'

const template = `<article style="margin: 1vh 3vh 0 3vh; padding: 4vh 3vh 0 3vh;">
    <div class="grid">
        <img
            id="preview"
            src=""
            alt="Preview of the photo you selected"
            hidden="hidden"
            style="max-height: 450px"
        />
        
        <form id="form" hidden="hidden">
            <label for="city">City</label>
            <input type="text" id="city" name="city" />

            <div id="candidatesDiv" hidden="hidden">
                <label for="cityCandidates">City Candidates</label>
                <select id="cityCandidates"></select>
            </div>

            <label for="country">Country</label>
            <input type="text" id="country" name="country" />

            <button id="submit" disabled>Upload</button>
        </form>
    </div>
</article>`

class CoaUploader extends HTMLElement {
    static observedAttributes = ['file-idx', 'picker-id', 'container-id']

    constructor() {
        super()
        this.pickerId = null
        this.fileIdx = null
        this.file = null
        this.container = null
        this.tmplId = 'coaUploaderTmpl'
        this.metadata = {}
        this.preview = null
        this.form = null
        this.submit = null
        this.city = null
        this.cityCandidates = null
        this.candidatesDiv = null
        this.country = null
        this.shadow = this.attachShadow({ mode: "closed" })
        this.rpc = new JsonRpcClient()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'picker-id':
                this.pickerId = newValue
                this.setFile()
                break
            case 'file-idx':
                this.fileIdx = Number(newValue)
                this.setFile()
                break
            case 'container-id':
                this.container = document.getElementById(newValue)
                break
            default:
                console.error(`unobserved attribute is unobserved: ${name}`)
        }
    }

    connectedCallback() {
        const clone = this.cloneNode()
        this.attachStylesheet(clone)

        this.preview = clone.getElementById('preview')
        this.form = clone.getElementById('form')
        this.submit = clone.getElementById('submit')
        this.city = clone.getElementById('city')
        this.cityCandidates = clone.getElementById('cityCandidates')
        this.candidatesDiv = clone.getElementById('candidatesDiv')
        this.country = clone.getElementById('country')

        this.cityCandidates.addEventListener('change', evt => {
            this.city.value = evt.target.selectedOptions[0].value
        })

        this.submit.addEventListener('click', async evt => {
            evt.preventDefault()
            this.submit.setAttribute('aria-busy', 'true')
            await this.uploadPhoto()
            this.updatePicker()
            this.remove()
        })

        this.shadow.appendChild(clone)

        this.loadImage().then(() => {
            this.form.removeAttribute('hidden')
            this.submit.removeAttribute('disabled')
        })
        this.processPhoto()
    }

    async processPhoto() {
        const img = this.loadImage()

        this.metadata.filename = extractFilename(this.file.name)
        this.metadata.sha256 = await sha256(this.file)

        const exists = await this.photoExists(this.metadata.sha256)
        if (exists || exists === null) {
            if (exists) {
                Toast(`File ${this.metadata.filename} already exists`)
            } else {
                ErrorToast(`Unable to check whether file ${this.metadata.filename} already exists`)
            }
            this.updatePicker()
            this._remove()
            return
        }

        Object.assign(this.metadata, await parse(this.file))
        const location = await this.getLocation(this.metadata.latitude, this.metadata.longitude)
        if (location === null) {
            ErrorToast(`Unable to get location for file ${this.metadata.filename}`)
            return
        }
        Object.assign(this.metadata, location)

        this.populateForm()
        await img
        this.form.removeAttribute('hidden')
        this.preview.removeAttribute('hidden')
        this.submit.removeAttribute('disabled')
    }

    async uploadPhoto() {
        const uploadInfo = await this.createUploadURL(this.metadata.filename)
        if (uploadInfo === null) {
            ErrorToast(`Unable to create upload URL for file ${this.metadata.filename}`)
            return
        }

        const formData = new FormData()
        formData.append('file', this.file)

        let response = await fetch(uploadInfo.uploadURL, {method: 'POST', body: formData})
        if (response.status > 299) {
            ErrorToast(`Uploading file ${this.metadata.filename} to Cloudflare Images failed`)
            console.error(response)
            return
        }

        this.metadata.id = uploadInfo.id
        // update editable fields
        this.metadata.city = this.city.value
        this.metadata.country = this.country.value

        await this.addPhoto(this.metadata)
        Toast(`Uploaded file ${this.metadata.filename} successfully`)
    }

    populateForm() {
        this.country.value = this.metadata.country

        if (this.metadata.cityCandidates) {
            this.candidatesDiv.removeAttribute('hidden')

            for (let candidate of this.metadata.cityCandidates) {
                const option = document.createElement('option')
                option.value = candidate
                option.text = candidate
                this.cityCandidates.add(option)
            }
            this.city.value = this.cityCandidates.selectedOptions[0].value
        } else {
            this.city.value = this.metadata.city
            this.candidatesDiv.setAttribute('hidden', 'hidden')
        }
    }

    async photoExists(sha256) {
        return await this.rpc.call("photo_exists", sha256)
    }

    async getLocation(latitude, longitude) {
        return await this.rpc.call("get_location", [latitude, longitude])
    }

    async createUploadURL() {
        return await this.rpc.call("create_upload_url")
    }

    async addPhoto(metadata) {
        return await this.rpc.call("add_photo", metadata)
    }

    updatePicker() {
        const picker = document.getElementById(this.pickerId)
        const pending = Number(picker.getAttribute('data-pending')) - 1

        if (pending > 0) {
            picker.setAttribute('data-pending', pending.toString())
        } else {
            picker.removeAttribute('data-pending')
            picker.removeAttribute('disabled')
            picker.value = null
        }
    }

    cloneNode() {
        let tmpl = document.getElementById(this.tmplId)
        if (!tmpl) {
            tmpl = document.createElement('template')
            tmpl.id = this.tmplId
            tmpl.innerHTML = template
            this.container.appendChild(tmpl)
            tmpl = document.getElementById(this.tmplId)
        }
        return tmpl.content.cloneNode(true)
    }

    attachStylesheet(node) {
        const style = document.createElement('link')
        style.setAttribute('rel', 'stylesheet')
        style.setAttribute('href', 'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css')
        node.appendChild(style)
    }

    loadImage() {
        this.preview.src = URL.createObjectURL(this.file)

        if (this.preview.naturalWidth !== 0) {
            this.preview.removeAttribute('hidden')
            return Promise.resolve()
        } else {
            return new Promise((resolve, reject) => {
                this.preview.onload = () => {
                    this.preview.removeAttribute('hidden')
                    resolve()
                }
                this.preview.onerror = reject
            })
        }
    }

    setFile() {
        if (this.file || this.pickerId === null || this.fileIdx === null) {
            return
        }

        this.file = document.getElementById(this.pickerId).files[this.fileIdx]
    }

    _remove() {
        document.getElementById(this.id).remove()
    }
}

customElements.define('coa-uploader', CoaUploader)

async function sha256(file) {
    const content = await file.arrayBuffer()
    const digest = await window.crypto.subtle.digest('SHA-256', content)
    const hashArray = Array.from(new Uint8Array(digest))

    return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

async function parse(file) {
    const exif = await exifr.parse(file)

    if (exif['ComponentsConfiguration']) {
        delete exif['ComponentsConfiguration']
    }

    const ts = getTimestamp(exif)

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
            return exif[attr]
        }
    }

    // When images with metadata added using https://github.com/haikoschol/check-exif/tree/write-gps are parsed with
    // exifr.js, the DateTimeOriginal tag is not properly recognized and translated from its integer to string
    // representation and the timestamp string is not converted to a Date object.
    // https://www.awaresystems.be/imaging/tiff/tifftags/privateifd/exif/datetimeoriginal.html
    if (exif['36867']) {
        const [date, time] = exif['36867'].split(' ')
        const ts = `${date.replaceAll(':', '-')} ${time}`
        return new Date(ts)
    }

    return new Date()
}

function attrOr(obj, attr, def) {
    return obj[attr] ? obj[attr] : def
}

// https://html.spec.whatwg.org/multipage/input.html#fakepath-srsly
function extractFilename(path) {
    // modern browser
    if (path.substring(0, 12) === "C:\\fakepath\\")
        return path.substring(12)

    // Unix-based path
    let x = path.lastIndexOf('/')
    if (x >= 0)
        return path.substring(x+1)

    // Windows-based path
    x = path.lastIndexOf('\\')
    if (x >= 0)
        return path.substring(x+1)

    return path
}

class JsonRpcClient {
    constructor() {
        const jsonRpcUrl = document.getElementById('jsonRpcUrl').value

        const transport = new HTTPTransport(jsonRpcUrl, {
            headers: {
                'X-CSRFToken': document.querySelector('input[name="csrfmiddlewaretoken"]').value,
            },
        })

        this.client = new Client(new RequestManager([transport]))
    }

    async call(method, params) {
        const data = {method: method}
        if (params) {
            data.params = Array.isArray(params) ? params : [params]
        }

        try {
            return await this.client.request(data)
        } catch (e) {
            console.error(e)
        }
        return null
    }
}
