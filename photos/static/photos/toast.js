// SPDX-FileCopyrightText: 2021 Adam Argyle
// SPDX-License-Identifier: Apache-2.0
// https://web.dev/articles/building/a-toast-component

const Toaster = init()

function init() {
    const node = document.createElement('section')
    node.classList.add('gui-toast-group')

    document.firstElementChild.insertBefore(node, document.body)
    return node
}

const createToast = text => {
    const node = document.createElement('output')

    node.innerText = text
    node.classList.add('gui-toast')
    node.setAttribute('role', 'status')

    return node
}

const addToast = toast => {
    const { matches:motionOK } = window.matchMedia(
        '(prefers-reduced-motion: no-preference)'
    )

    Toaster.children.length && motionOK
        ? flipToast(toast)
        : Toaster.appendChild(toast)
}

const flipToast = toast => {
    // FIRST
    const first = Toaster.offsetHeight

    // add new child to change container size
    Toaster.appendChild(toast)

    // LAST
    const last = Toaster.offsetHeight

    // INVERT
    const invert = last - first

    // PLAY
    const animation = Toaster.animate([
        { transform: `translateY(${invert}px)` },
        { transform: 'translateY(0)' }
    ], {
        duration: 150,
        easing: 'ease-out',
    })
}

export const Toast = (text, isError) => {
    let toast = createToast(text)

    if (isError) {
        toast.classList.add('error')
    }
    addToast(toast)

    return new Promise(async (resolve) => {
        await Promise.allSettled(
            toast.getAnimations().map(animation =>
                animation.finished
            )
        )
        Toaster.removeChild(toast)
        resolve()
    })
}

export const ErrorToast = (text) => Toast(text, true)
