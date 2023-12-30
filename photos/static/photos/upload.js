// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict'

function addUploader(evt) {
    const picker = evt.target
    picker.setAttribute('disabled', 'disabled')
    picker.setAttribute('data-pending', picker.files.length.toString())

    for (let i = 0; i < picker.files.length; i++) {
        const uploader = document.createElement('coa-uploader')
        uploader.setAttribute('id', `uploader-${i}`)
        uploader.setAttribute('picker-id', picker.id)
        uploader.setAttribute('file-idx', i.toString())
        uploader.setAttribute('container-id', 'uploaderContainer')
        document.getElementById('uploaderContainer').appendChild(uploader)
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('picker').addEventListener('change', addUploader)
})
