// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// FIXME stop using esm.run, it's beta and flaky
import {HTTPTransport, RequestManager, Client} from 'https://esm.run/@open-rpc/client-js';

export class JsonRpcClient {
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

